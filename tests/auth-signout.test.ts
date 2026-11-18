import { describe, it, expect, vi } from "vitest";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
const require = createRequire(import.meta.url);
it("finishes signed-out navigation while encrypted cache writes are still pending", async () => {
  const values: unknown[] = [],
    effects: (() => unknown)[] = [];
  let position = 0,
    receive!: (event: string, session: unknown) => void,
    finish!: () => void;
  const stopping = new Promise<void>((done) => {
    finish = done;
  });
  const cache = { clear: vi.fn(), getQueryData: vi.fn() },
    clearStored = vi.fn().mockResolvedValue(undefined);
  const current = { user: { id: "synthetic-account" } };
  const mockReact = {
    createContext: () => ({ Provider: "Provider" }),
    useContext: vi.fn(),
    useState(initial: unknown) {
      const index = position++;
      values[index] = initial;
      return [
        initial,
        (value: unknown) => {
          values[index] = value;
        },
      ];
    },
    useEffect(effect: () => unknown) {
      effects.push(effect);
    },
    useRef: (value: unknown) => ({ current: value }),
  };
  const modules: Record<string, unknown> = {
    react: mockReact,
    "react/jsx-runtime": require("react/jsx-runtime"),
    "./supabase": {
      isConfigured: true,
      supabase: {
        auth: {
          getSession: async () => ({ data: { session: current } }),
          onAuthStateChange(callback: typeof receive) {
            receive = callback;
            return { data: { subscription: { unsubscribe: vi.fn() } } };
          },
        },
      },
    },
    "@tanstack/react-query": { useQueryClient: () => cache },
    "./query-cache": {
      restoreQueryCache: vi.fn().mockResolvedValue(undefined),
      watchQueryCache: () => () => stopping,
      clearQueryCache: clearStored,
    },
    "./state": {
      usePreferences: { setState: vi.fn() },
      restoreInvitation: vi.fn().mockResolvedValue(undefined),
    },
  };
  const filename = resolve("apps/mobile/src/lib/auth.tsx");
  const { code } = require("@babel/core").transformSync(
    readFileSync(filename, "utf8"),
    {
      filename,
      configFile: resolve("apps/mobile/babel.config.cjs"),
      caller: { name: "metro", platform: "android", supportsStaticESM: false },
    },
  );
  const exports: Record<string, any> = {};
  runInNewContext(code, {
    exports,
    queueMicrotask,
    require: (name: string) =>
      name.startsWith("@babel/runtime/") ? require(name) : modules[name],
  });
  exports.AuthProvider({ children: null });
  effects[0]!();
  await new Promise((done) => setTimeout(done, 0));
  expect(values).toEqual([current, false]);
  receive("SIGNED_OUT", null);
  await new Promise((done) => setTimeout(done, 0));
  expect(values).toEqual([null, false]);
  expect(cache.clear).toHaveBeenCalledTimes(2);
  expect(clearStored).not.toHaveBeenCalled();
  finish();
  await new Promise((done) => setTimeout(done, 0));
  expect(clearStored).toHaveBeenCalledWith("synthetic-account");
});
