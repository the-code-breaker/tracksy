import "react-native-url-polyfill/auto";
import { createClient, processLock } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { AppState, Platform } from "react-native";
import { authFlow } from "./auth-flow";
import { browserStorage } from "./browser-storage";
import { createAuthFetch } from "./auth-fetch";

const secureStorage = {
  async getItem(key: string) {
    if (Platform.OS === "web")
      return key.endsWith("-code-verifier")
        ? authFlow.get(key)
        : browserStorage.getItem(key);
    const count = Number((await SecureStore.getItemAsync(`${key}.count`)) ?? 0);
    if (!count) return null;
    const pieces = await Promise.all(
      Array.from({ length: count }, (_, i) =>
        SecureStore.getItemAsync(`${key}.${i}`),
      ),
    );
    return pieces.every((p) => p !== null) ? pieces.join("") : null;
  },
  async setItem(key: string, value: string) {
    if (Platform.OS === "web") {
      if (key.endsWith("-code-verifier")) {
        await authFlow.set(key, value);
        return;
      }
      await browserStorage.setItem(key, value);
      return;
    }
    const old = Number((await SecureStore.getItemAsync(`${key}.count`)) ?? 0);
    const pieces = value.match(/[\s\S]{1,1500}/g) ?? [];
    // Each chunk remains in Keychain/Keystore; no plaintext fallback.
    for (let i = 0; i < pieces.length; i++)
      await SecureStore.setItemAsync(`${key}.${i}`, pieces[i]!, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    await SecureStore.setItemAsync(`${key}.count`, String(pieces.length));
    for (let i = pieces.length; i < old; i++)
      await SecureStore.deleteItemAsync(`${key}.${i}`);
  },
  async removeItem(key: string) {
    if (Platform.OS === "web") {
      if (key.endsWith("-code-verifier")) {
        await authFlow.remove(key);
        return;
      }
      await browserStorage.removeItem(key);
      return;
    }
    const count = Number((await SecureStore.getItemAsync(`${key}.count`)) ?? 0);
    await SecureStore.deleteItemAsync(`${key}.count`);
    for (let i = 0; i < count; i++)
      await SecureStore.deleteItemAsync(`${key}.${i}`);
  },
};
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
export const isConfigured = Boolean(url && key);
export const supabase = createClient(
  url || "http://127.0.0.1:54321",
  key || "configuration-required",
  {
    global: { fetch: createAuthFetch(fetch) },
    auth: {
      storage: secureStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: "pkce",
      lock: processLock,
    },
  },
);
if (Platform.OS !== "web")
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
export async function rpc<T>(
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}
const exchanges = new Map<
  string,
  ReturnType<typeof supabase.auth.exchangeCodeForSession>
>();
export function exchangeAuthCode(code: string) {
  let request = exchanges.get(code);
  if (!request) {
    request = supabase.auth.exchangeCodeForSession(code);
    exchanges.set(code, request);
    if (exchanges.size > 5) exchanges.delete(exchanges.keys().next().value!);
  }
  return request;
}
