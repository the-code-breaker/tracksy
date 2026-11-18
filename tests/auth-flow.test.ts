import "fake-indexeddb/auto";
import { describe, it, expect, vi } from "vitest";
import { authFlow } from "../apps/mobile/src/lib/auth-flow";
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open("tracksy-auth-flow", 1);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
describe("encrypted browser PKCE flow storage", () => {
  it("persists and decrypts proof keys while never storing plaintext", async () => {
    const value = "private-pkce-proof-key";
    await authFlow.set("test-code-verifier", value);
    expect(await authFlow.get("test-code-verifier")).toBe(value);
    const db = await database();
    const rows = await new Promise<unknown[]>((resolve, reject) => {
      const r = db.transaction("flow").objectStore("flow").getAll();
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    expect(JSON.stringify(rows)).not.toContain(value);
    const key = await new Promise<CryptoKey>((resolve) => {
      const r = db.transaction("flow").objectStore("flow").get("key");
      r.onsuccess = () => resolve(r.result);
    });
    expect(key.extractable).toBe(false);
    db.close();
  });
  it("handles concurrent proof-key writes with one stable encryption key", async () => {
    await Promise.all([
      authFlow.set("a-code-verifier", "a-proof"),
      authFlow.set("b-code-verifier", "b-proof"),
    ]);
    expect(await authFlow.get("a-code-verifier")).toBe("a-proof");
    expect(await authFlow.get("b-code-verifier")).toBe("b-proof");
  });
  it("expires proof keys and removes consumed verifiers", async () => {
    await authFlow.set("expiry-code-verifier", "proof");
    const now = Date.now();
    const spy = vi.spyOn(Date, "now").mockReturnValue(now + 3600001);
    try {
      expect(await authFlow.get("expiry-code-verifier")).toBeNull();
    } finally {
      spy.mockRestore();
    }
    await authFlow.remove("test-code-verifier");
    expect(await authFlow.get("test-code-verifier")).toBeNull();
  });
});
