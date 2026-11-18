import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, isConfigured } from "./supabase";
import { useQueryClient } from "@tanstack/react-query";
import {
  restoreQueryCache,
  watchQueryCache,
  clearQueryCache,
} from "./query-cache";
import { usePreferences, restoreInvitation } from "./state";
const Context = createContext<{ session: Session | null; loading: boolean }>({
  session: null,
  loading: true,
});
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const cache = useQueryClient();
  const previousUser = useRef<string | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    if (!isConfigured) {
      setLoading(false);
      return;
    }
    let initialized = false,
      version = 0,
      stopCache: (() => Promise<void>) | undefined;
    async function receive(s: Session | null) {
      if (!alive) return;
      const user = s?.user.id;
      if (initialized && previousUser.current === user) {
        setSession(s);
        return;
      }
      initialized = true;
      const current = ++version,
        previous = previousUser.current;
      previousUser.current = user;
      const stopping = stopCache?.();
      stopCache = undefined;
      // Local logout is already complete when SIGNED_OUT arrives. Never keep
      // the navigation tree behind an unbounded encrypted-cache cleanup.
      if (!user && previous) {
        cache.clear();
        usePreferences.setState({ theme: "system", language: "en" });
        setSession(null);
        setLoading(false);
        void Promise.resolve(stopping)
          .then(() => clearQueryCache(previous))
          .catch(() => {});
        return;
      }
      setLoading(true);
      setSession(s);
      await stopping;
      if (!alive || current !== version) return;
      cache.clear();
      usePreferences.setState({ theme: "system", language: "en" });
      await restoreInvitation();
      if (previous && previous !== user) await clearQueryCache(previous);
      if (!alive || current !== version) return;
      if (user) {
        await restoreQueryCache(cache, user);
        if (!alive || current !== version) return;
        const saved = cache.getQueryData<{
          preferences: { theme: "system" | "light" | "dark" };
          profile: { language: "en" | "hi" };
        }>(["profile", user]);
        if (saved)
          usePreferences.setState({
            theme: saved.preferences.theme,
            language: saved.profile.language,
          });
        stopCache = watchQueryCache(cache, user);
      }
      if (alive && current === version) setLoading(false);
    }
    void supabase.auth
      .getSession()
      .then(({ data }) => receive(data.session))
      .catch(() => {
        if (alive) setLoading(false);
      });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      queueMicrotask(() => void receive(s));
    });
    return () => {
      alive = false;
      version++;
      void stopCache?.();
      data.subscription.unsubscribe();
    };
  }, [cache]);
  return (
    <Context.Provider value={{ session, loading }}>{children}</Context.Provider>
  );
}
export const useAuth = () => useContext(Context);
