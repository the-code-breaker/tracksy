import { useMemo, useEffect, useSyncExternalStore } from "react";
import { createSettingQueue } from "./setting-queue";
export function useSetting<T>(
  id: string,
  value: T,
  options: {
    save: (value: T) => Promise<unknown>;
    optimistic: (value: T) => void;
    failed: (error: unknown) => void;
  },
) {
  // A new account/setting gets its own callbacks; pending writes for a former
  // account retain their original target instead of using the next user's ID.
  const callbacks = useMemo(() => ({ current: options }), [id]);
  callbacks.current = options;
  const queue = useMemo(
    () =>
      createSettingQueue(
        value,
        (v) => callbacks.current.save(v),
        (v) => callbacks.current.optimistic(v),
        (e) => callbacks.current.failed(e),
      ),
    [id, callbacks],
  );
  const state = useSyncExternalStore(
    queue.subscribe,
    queue.getSnapshot,
    queue.getSnapshot,
  );
  useEffect(() => queue.synchronize(value), [queue, value]);
  return { ...state, choose: queue.choose };
}
