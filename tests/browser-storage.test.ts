import "fake-indexeddb/auto";
import { describe, it, expect, vi } from "vitest";
import { browserStorage } from "../apps/mobile/src/lib/browser-storage";
describe("hosted browser session storage", () => {
  it("restores a session across module reloads and removes it on sign-out", async () => {
    await browserStorage.setItem("test-session", "synthetic-session-token");
    vi.resetModules();
    const restored = (await import("../apps/mobile/src/lib/browser-storage"))
      .browserStorage;
    expect(await restored.getItem("test-session")).toBe(
      "synthetic-session-token",
    );
    await restored.removeItem("test-session");
    expect(await restored.getItem("test-session")).toBeNull();
  });
  it("expires persistent browser records after seven days", async () => {
    await browserStorage.setItem("expired-session", "old-session");
    const time = vi
      .spyOn(Date, "now")
      .mockReturnValue(Date.now() + 7 * 86400000 + 1);
    try {
      expect(await browserStorage.getItem("expired-session")).toBeNull();
    } finally {
      time.mockRestore();
    }
  });
});
