// Browser records are encrypted with an origin-scoped, non-extractable key.
// PKCE proofs expire in one hour; opted-in app session/cache records in seven days.
type Entry = { iv: Uint8Array; ciphertext: ArrayBuffer; expires: number };
async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("tracksy-auth-flow", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("flow");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(new Error("Secure browser sign-in storage is unavailable"));
  });
}
async function read<T>(db: IDBDatabase, name: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const r = db.transaction("flow").objectStore("flow").get(name);
    r.onsuccess = () => resolve(r.result as T | undefined);
    r.onerror = () => reject(r.error);
  });
}
async function write(db: IDBDatabase, name: string, value: unknown) {
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("flow", "readwrite");
    tx.objectStore("flow").put(value, name);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function encryptionKey(db: IDBDatabase) {
  const existing = await read<CryptoKey>(db, "key");
  if (existing) return existing;
  const candidate = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  return new Promise<CryptoKey>((resolve, reject) => {
    const tx = db.transaction("flow", "readwrite");
    const store = tx.objectStore("flow");
    let chosen = candidate;
    const request = store.get("key");
    request.onsuccess = () => {
      if (request.result) chosen = request.result as CryptoKey;
      else store.put(candidate, "key");
    };
    tx.oncomplete = () => resolve(chosen);
    tx.onerror = () => reject(tx.error);
  });
}
export const authFlow = {
  async get(key: string) {
    const db = await database();
    try {
      const entry = await read<Entry>(db, key);
      if (!entry || entry.expires < Date.now()) return null;
      const cryptoKey = await encryptionKey(db);
      const plaintext = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: entry.iv as Uint8Array<ArrayBuffer> },
        cryptoKey,
        entry.ciphertext,
      );
      return new TextDecoder().decode(plaintext);
    } finally {
      db.close();
    }
  },
  async set(key: string, value: string, ttl = 3600000) {
    const db = await database();
    try {
      const cryptoKey = await encryptionKey(db);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        cryptoKey,
        new TextEncoder().encode(value),
      );
      await write(db, key, { iv, ciphertext, expires: Date.now() + ttl });
    } finally {
      db.close();
    }
  },
  async remove(key: string) {
    const db = await database();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("flow", "readwrite");
        tx.objectStore("flow").delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  },
};
