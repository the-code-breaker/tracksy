export type SettingSnapshot<T> = { value: T; pending: boolean };
// One ordered request per setting; intermediate taps are coalesced into the
// latest intention. A failed older request must never undo a newer choice.
export function createSettingQueue<T>(
  initial: T,
  save: (value: T) => Promise<unknown>,
  optimistic: (value: T) => void,
  failed: (error: unknown) => void,
) {
  let confirmed = initial,
    desired = initial,
    revision = 0,
    running = false;
  let snapshot: SettingSnapshot<T> = { value: initial, pending: false };
  const listeners = new Set<() => void>();
  const emit = () => {
    if (Object.is(snapshot.value, desired) && snapshot.pending === running)
      return;
    snapshot = { value: desired, pending: running };
    listeners.forEach((listener) => listener());
  };
  async function flush() {
    running = true;
    emit();
    while (!Object.is(desired, confirmed)) {
      const target = desired,
        current = revision;
      try {
        await save(target);
        confirmed = target;
      } catch (error) {
        if (current === revision) {
          desired = confirmed;
          optimistic(confirmed);
          failed(error);
        }
      }
    }
    running = false;
    emit();
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    choose(value: T) {
      desired = value;
      revision++;
      optimistic(value);
      if (!running && !Object.is(desired, confirmed)) void flush();
      else emit();
    },
    synchronize(value: T) {
      if (running) return;
      desired = confirmed = value;
      emit();
    },
  };
}
