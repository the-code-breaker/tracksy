import { describe, it, expect, vi, beforeEach } from "vitest";
const secure = vi.hoisted(() => ({
  values: new Map<string, string>(),
  writes: 0,
  failAt: Infinity,
}));
vi.mock("expo-secure-store", () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: "device-only",
  getItemAsync: async (key: string) => secure.values.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    if (++secure.writes === secure.failAt)
      throw Error("Interrupted secure write");
    secure.values.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    secure.values.delete(key);
  },
}));
import {
  readCached,
  writeCached,
  removeCached,
} from "../apps/mobile/src/lib/cache-storage.native";
beforeEach(() => {
  secure.values.clear();
  secure.writes = 0;
  secure.failAt = Infinity;
});
describe("encrypted device cache durability and account isolation", () => {
  it("retains the last complete cache when an update is interrupted", async () => {
    await writeCached("account-a", "previous data");
    secure.failAt = secure.writes + 2;
    await expect(writeCached("account-a", "new".repeat(2000))).rejects.toThrow(
      "Interrupted",
    );
    expect(await readCached("account-a")).toBe("previous data");
  });
  it("keeps users separate and removes only the signed-out account", async () => {
    await writeCached("account-a", "private A");
    await writeCached("account-b", "private B");
    await removeCached("account-a");
    expect(await readCached("account-a")).toBeNull();
    expect(await readCached("account-b")).toBe("private B");
  });
  it("restores long cached overviews without truncating chunks", async () => {
    const value = JSON.stringify({
      groups: Array.from({ length: 80 }, (_, i) => ({
        id: i,
        name: "Weekend group " + i,
      })),
    });
    await writeCached("account-a", value);
    expect(await readCached("account-a")).toBe(value);
  });
});
