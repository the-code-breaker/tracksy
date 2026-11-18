import { describe, it, expect, vi } from "vitest";
import { authSchema, loginSchema } from "@tracksy/validation";
import { authErrorMessage } from "../apps/mobile/src/lib/auth-errors";
import { createAuthFetch } from "../apps/mobile/src/lib/auth-fetch";

describe("authentication failures and retry", () => {
  it("normalizes mobile email input and preserves existing-account password rules", () => {
    expect(
      loginSchema.parse({
        email: "  Tester@Example.com ",
        password: "old-pass",
      }),
    ).toEqual({ email: "tester@example.com", password: "old-pass" });
    expect(
      authSchema.safeParse({
        email: "tester@example.com",
        password: "old-pass",
      }).success,
    ).toBe(false);
    expect(
      authSchema.safeParse({
        email: "tester@example.com",
        password: "new-password-123",
      }).success,
    ).toBe(true);
  });
  it("explains failed signup delivery separately from incorrect or unconfirmed credentials", () => {
    expect(
      authErrorMessage({
        message: "Error sending confirmation email",
        status: 500,
      }),
    ).toContain("may not have been created");
    expect(authErrorMessage({ code: "email_not_confirmed" })).toContain(
      "Confirm your email",
    );
    expect(authErrorMessage({ code: "invalid_credentials" })).toContain(
      "signup previously failed",
    );
  });
  it("aborts stalled Auth requests and permits a later successful retry", async () => {
    vi.useFakeTimers();
    try {
      const stalled = vi.fn<typeof fetch>(
        (_input, init) =>
          new Promise<Response>((_resolve, reject) =>
            init?.signal?.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            ),
          ),
      );
      const request = createAuthFetch(
        stalled,
        20,
      )("https://test.supabase.co/auth/v1/token");
      const failure = expect(request).rejects.toMatchObject({
        name: "AbortError",
      });
      await vi.advanceTimersByTimeAsync(21);
      await failure;
      const response = new Response("{}");
      expect(
        await createAuthFetch(vi.fn().mockResolvedValue(response))(
          "https://test.supabase.co/auth/v1/signup",
        ),
      ).toBe(response);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
  it("preserves caller cancellation and leaves non-Auth fetches untouched", async () => {
    const original = new AbortController();
    original.abort();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("{}"));
    await createAuthFetch(fetcher)("https://test.supabase.co/auth/v1/token", {
      signal: original.signal,
    });
    expect(fetcher.mock.calls[0]![1]!.signal!.aborted).toBe(true);
    const init = { headers: { Accept: "application/json" } };
    await createAuthFetch(fetcher)(
      "https://test.supabase.co/rest/v1/groups",
      init,
    );
    expect(fetcher.mock.calls[1]![1]).toBe(init);
  });
});
