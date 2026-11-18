import { describe, it, expect, vi } from "vitest";
import { createSettingQueue } from "../apps/mobile/src/lib/setting-queue";
function deferred() {
  let resolve!: () => void, reject!: (e: Error) => void;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
describe("settings with slow or failed connections", () => {
  it("changes immediately, coalesces rapid choices and persists the final choice in order", async () => {
    const first = deferred(),
      second = deferred(),
      optimistic = vi.fn();
    const save = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const queue = createSettingQueue<string>(
      "system",
      save,
      optimistic,
      vi.fn(),
    );
    queue.choose("dark");
    expect(queue.getSnapshot()).toEqual({ value: "dark", pending: true });
    queue.choose("light");
    queue.choose("system");
    queue.choose("light");
    expect(queue.getSnapshot().value).toBe("light");
    expect(save).toHaveBeenCalledTimes(1);
    first.resolve();
    await tick();
    expect(save.mock.calls).toEqual([["dark"], ["light"]]);
    second.resolve();
    await tick();
    expect(queue.getSnapshot()).toEqual({ value: "light", pending: false });
  });
  it("rolls back a failed final save and reports the failure", async () => {
    const request = deferred(),
      optimistic = vi.fn(),
      failed = vi.fn();
    const queue = createSettingQueue<boolean>(
      false,
      () => request.promise,
      optimistic,
      failed,
    );
    queue.choose(true);
    request.reject(Error("Offline"));
    await tick();
    expect(queue.getSnapshot()).toEqual({ value: false, pending: false });
    expect(optimistic.mock.calls).toEqual([[true], [false]]);
    expect(failed).toHaveBeenCalledOnce();
  });
  it("keeps a newer choice when an older request fails, and ignores stale server values while saving", async () => {
    const request = deferred(),
      save = vi
        .fn()
        .mockReturnValueOnce(request.promise)
        .mockResolvedValue(undefined),
      failed = vi.fn();
    const queue = createSettingQueue<string>("INR", save, vi.fn(), failed);
    queue.choose("EUR");
    queue.choose("USD");
    queue.synchronize("INR");
    expect(queue.getSnapshot().value).toBe("USD");
    request.reject(Error("Offline"));
    await tick();
    expect(save.mock.calls).toEqual([["EUR"], ["USD"]]);
    expect(queue.getSnapshot()).toEqual({ value: "USD", pending: false });
    expect(failed).not.toHaveBeenCalled();
  });
});
