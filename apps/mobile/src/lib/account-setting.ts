import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./auth";
import { useSetting } from "./use-setting";
import { supabase } from "./supabase";
import { usePreferences } from "./state";
export function useAccountSetting<T extends string | boolean>(
  section: "profile" | "preferences" | "notifications",
  field: string,
  value: T,
  onError: (message: string) => void,
) {
  const { session } = useAuth(),
    cache = useQueryClient(),
    user = session?.user.id;
  const key = ["profile", user];
  return useSetting(`${user}:${section}:${field}`, value, {
    optimistic(next) {
      void cache.cancelQueries(
        { queryKey: key },
        { revert: false, silent: true },
      );
      cache.setQueryData(key, (old: any) =>
        old ? { ...old, [section]: { ...old[section], [field]: next } } : old,
      );
      if (section === "preferences" && field === "theme")
        usePreferences.getState().setTheme(next as "system" | "light" | "dark");
      if (section === "profile" && field === "language")
        usePreferences.getState().setLanguage(next as "en" | "hi");
    },
    async save(next) {
      if (!user) throw Error("Sign in again to save this setting.");
      const table =
        section === "profile"
          ? "profiles"
          : section === "preferences"
            ? "user_preferences"
            : "notification_preferences";
      const result = await supabase
        .from(table)
        .update({ [field]: next })
        .eq(section === "profile" ? "id" : "user_id", user)
        .select(field)
        .single();
      if (result.error) throw result.error;
    },
    failed(error) {
      onError(
        error instanceof Error
          ? error.message
          : "Couldn't save that change. Your previous setting was restored.",
      );
    },
  });
}
