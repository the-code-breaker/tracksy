import type { QueryClient } from "@tanstack/react-query";
import { readCached, writeCached, removeCached } from "./cache-storage";
const allowed = new Set(["overview", "groups", "profile"]);
const key = (user: string) => `tracksy.cache.v1.${user}`;
type Entry = { queryKey: readonly unknown[]; data: unknown; updatedAt: number };
export async function restoreQueryCache(client: QueryClient, user: string) {
  try {
    const value = await readCached(key(user));
    if (!value) return;
    const record = JSON.parse(value) as {
      user: string;
      writtenAt: number;
      entries: Entry[];
    };
    if (record.user !== user || Date.now() - record.writtenAt > 7 * 86400000)
      return;
    for (const e of record.entries)
      if (allowed.has(String(e.queryKey[0])) && e.queryKey[1] === user)
        client.setQueryData(e.queryKey, e.data, { updatedAt: e.updatedAt });
  } catch {
    /* A cache failure never blocks access to the app. */
  }
}
export function watchQueryCache(client: QueryClient, user: string) {
  let timer: ReturnType<typeof setTimeout> | undefined,
    stopped = false,
    chain = Promise.resolve();
  const save = () => {
    const entries = client
      .getQueryCache()
      .getAll()
      .filter(
        (q) =>
          allowed.has(String(q.queryKey[0])) &&
          q.queryKey[1] === user &&
          q.state.status === "success",
      )
      .map((q) => ({
        queryKey: q.queryKey,
        data: q.state.data,
        updatedAt: q.state.dataUpdatedAt,
      }));
    chain = chain
      .then(() =>
        stopped
          ? undefined
          : writeCached(
              key(user),
              JSON.stringify({ user, writtenAt: Date.now(), entries }),
            ),
      )
      .catch(() => {});
  };
  const unsubscribe = client.getQueryCache().subscribe((event) => {
    if (event.type === "updated" && event.action.type === "success") {
      clearTimeout(timer);
      timer = setTimeout(save, 600);
    }
  });
  return async () => {
    stopped = true;
    clearTimeout(timer);
    unsubscribe();
    await chain;
  };
}
export async function clearQueryCache(user: string) {
  await removeCached(key(user)).catch(() => {});
}
