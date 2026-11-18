import { create } from "zustand";
import { readCached, writeCached, removeCached } from "./cache-storage";
type State = {
  theme: "system" | "light" | "dark";
  language: "en" | "hi";
  setTheme: (theme: State["theme"]) => void;
  setLanguage: (language: State["language"]) => void;
};
export const usePreferences = create<State>((set) => ({
  theme: "system",
  language: "en",
  setTheme: (theme) => set({ theme }),
  setLanguage: (language) => set({ language }),
}));
export const useInvitation = create<{
  token?: string;
  setToken: (token?: string) => void;
}>((set) => ({
  token: undefined,
  setToken: (token) => {
    set({ token });
    if (token)
      void writeCached(
        "tracksy.pending-invite",
        JSON.stringify({ token, expires: Date.now() + 7 * 86400000 }),
      ).catch(() => {});
    else void removeCached("tracksy.pending-invite").catch(() => {});
  },
}));
export async function restoreInvitation() {
  if (useInvitation.getState().token) return;
  try {
    const value = await readCached("tracksy.pending-invite");
    if (!value) return;
    const parsed = JSON.parse(value);
    if (parsed.expires > Date.now() && /^[a-f0-9]{64}$/.test(parsed.token))
      useInvitation.setState({ token: parsed.token });
  } catch {}
}
