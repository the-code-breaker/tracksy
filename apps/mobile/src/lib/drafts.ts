import type { ExpenseInput } from "@tracksy/domain";
export interface Draft {
  id: string;
  user_id: string;
  payload: ExpenseInput;
  saved_at: string;
}
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("tracksy-drafts", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("drafts", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function saveDraft(user: string, payload: ExpenseInput) {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("drafts", "readwrite");
    tx.objectStore("drafts").put({
      id: payload.idempotency_key,
      user_id: user,
      payload,
      saved_at: new Date().toISOString(),
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
export async function listDrafts(user: string): Promise<Draft[]> {
  const db = await database();
  const rows = await new Promise<Draft[]>((resolve, reject) => {
    const request = db.transaction("drafts").objectStore("drafts").getAll();
    request.onsuccess = () => resolve(request.result as Draft[]);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return rows.filter((d) => d.user_id === user);
}
export async function removeDraft(id: string) {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("drafts", "readwrite");
    tx.objectStore("drafts").delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
