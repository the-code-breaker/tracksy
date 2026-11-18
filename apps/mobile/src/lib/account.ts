import { useQuery } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import type { Currency } from "@tracksy/domain";
import { useAuth } from "./auth";
import { supabase } from "./supabase";
export function accountName(
  user: User | null | undefined,
  stored?: string,
): string {
  const values = [
    stored,
    user?.user_metadata?.display_name,
    user?.user_metadata?.full_name,
    user?.user_metadata?.name,
  ];
  return (
    values
      .find(
        (v) =>
          typeof v === "string" &&
          v.trim() &&
          !/^tracksy member$/i.test(v.trim()),
      )
      ?.trim()
      .slice(0, 80) || ""
  );
}
export function useAccount() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["profile", session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const [p, prefs, notifications] = await Promise.all([
        supabase
          .from("profiles")
          .select("*")
          .eq("id", session!.user.id)
          .single(),
        supabase
          .from("user_preferences")
          .select("*")
          .eq("user_id", session!.user.id)
          .single(),
        supabase
          .from("notification_preferences")
          .select("*")
          .eq("user_id", session!.user.id)
          .single(),
      ]);
      for (const r of [p, prefs, notifications]) if (r.error) throw r.error;
      return {
        profile: p.data as {
          display_name: string;
          avatar_path: string | null;
          currency: Currency;
          language: "en" | "hi";
        },
        preferences: prefs.data as {
          theme: "system" | "light" | "dark";
          detailed_previews: boolean;
        },
        notifications: notifications.data as {
          expenses: boolean;
          settlements: boolean;
          reminders: boolean;
        },
      };
    },
  });
}
