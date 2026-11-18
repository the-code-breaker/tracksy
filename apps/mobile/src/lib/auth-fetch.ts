// Bound Auth network requests so a lost connection does not leave the form busy.
// Preserve caller cancellation, and leave non-Auth requests untouched.
export function createAuthFetch(
  fetcher: typeof fetch,
  timeoutMs = 20000,
): typeof fetch {
  return async (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    if (!new URL(url).pathname.startsWith("/auth/v1/"))
      return fetcher(input, init);
    const controller = new AbortController();
    const signal =
      init?.signal ??
      (typeof Request !== "undefined" && input instanceof Request
        ? input.signal
        : undefined);
    const cancel = () => controller.abort();
    if (signal?.aborted) cancel();
    signal?.addEventListener("abort", cancel, { once: true });
    const timer = setTimeout(cancel, timeoutMs);
    try {
      return await fetcher(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
    }
  };
}
