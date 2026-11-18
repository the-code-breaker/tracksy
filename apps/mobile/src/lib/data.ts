import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase, rpc } from "./supabase";
import { useAuth } from "./auth";
import { readPhoneAlerts, showOpenAppAlert } from "./device-alerts";
import type {
  Group,
  Balance,
  Member,
  Expense,
  Activity,
  Settlement,
  Entitlement,
} from "@tracksy/domain";
export function useGroups() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["groups", session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Group[];
    },
  });
}
export function useOverview() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["overview", session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const groups = data as Group[];
      const all = await Promise.all(
        groups.map((g) => rpc<Balance[]>("group_balances", { p_group: g.id })),
      );
      const recent = await supabase
        .from("expense_audit_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(12);
      if (recent.error) throw recent.error;
      const pending = await supabase
        .from("settlements")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(20);
      if (pending.error) throw pending.error;
      const earlyAccess = await rpc<boolean>("group_plus_early_access");
      const premium = await supabase
        .from("group_subscription_entitlements")
        .select("*");
      if (premium.error) throw premium.error;
      const expenses = await supabase
        .from("expenses")
        .select("*")
        .is("reversed_at", null)
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(6);
      if (expenses.error) throw expenses.error;
      return {
        groups,
        balances: all.flat(),
        activity: recent.data as Activity[],
        settlements: pending.data as Settlement[],
        entitlements: premium.data as Entitlement[],
        earlyAccess,
        expenses: expenses.data as Expense[],
      };
    },
  });
}
export function useGroup(id: string) {
  return useQuery({
    queryKey: ["group", id],
    enabled: !!id,
    queryFn: async () => {
      const [
        group,
        members,
        balances,
        expenses,
        settlements,
        entitlement,
        earlyAccess,
      ] = await Promise.all([
        supabase.from("groups").select("*").eq("id", id).single(),
        rpc<Member[]>("list_members", { p_group: id }),
        rpc<Balance[]>("group_balances", { p_group: id }),
        supabase
          .from("expenses")
          .select("*")
          .eq("group_id", id)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("settlements")
          .select("*")
          .eq("group_id", id)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("group_subscription_entitlements")
          .select("*")
          .eq("group_id", id)
          .maybeSingle(),
        rpc<boolean>("group_plus_early_access"),
      ]);
      for (const r of [group, expenses, settlements, entitlement])
        if (r.error) throw r.error;
      return {
        group: group.data as Group,
        members,
        balances,
        expenses: expenses.data as Expense[],
        settlements: settlements.data as Settlement[],
        entitlement: entitlement.data as Entitlement | null,
        earlyAccess,
      };
    },
  });
}
export function useRealtime() {
  const cache = useQueryClient();
  const { session } = useAuth();
  useEffect(() => {
    if (!session) return;
    void readPhoneAlerts(session.user.id).catch(() => {});
    let active = true;
    const channel = supabase.channel(`tracksy:${session.user.id}`);
    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${session.user.id}`,
      },
      (payload) => {
        const kind = String(payload.new.kind || "");
        const account = cache.getQueryData<{
          notifications?: { expenses: boolean; settlements: boolean };
          preferences?: { detailed_previews: boolean };
        }>(["profile", session.user.id]);
        if (
          (kind === "expense_added" &&
            account?.notifications?.expenses === false) ||
          (kind.startsWith("settlement_") &&
            account?.notifications?.settlements === false)
        )
          return;
        const overview = cache.getQueryData<{ groups: Group[] }>([
          "overview",
          session.user.id,
        ]);
        const groupName = overview?.groups.find(
          (g) => g.id === payload.new.group_id,
        )?.name;
        void showOpenAppAlert(
          account?.preferences?.detailed_previews && groupName
            ? `There is an update in ${groupName}.`
            : undefined,
        );
      },
    );
    for (const table of [
      "expenses",
      "settlements",
      "group_members",
      "group_subscription_entitlements",
    ])
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => {
          void cache.invalidateQueries();
        },
      );
    // Authenticate before subscribing; the initial login can race SDK token propagation.
    void supabase.realtime
      .setAuth(session.access_token)
      .then(() => {
        if (!active) return;
        channel.subscribe((status) => {
          if (status === "SUBSCRIBED") void cache.invalidateQueries();
        });
      })
      .catch(() => {
        if (active) void cache.invalidateQueries();
      });
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [cache, session?.user.id, session?.access_token]);
}
export function isPremium(
  e: Entitlement | null | undefined,
  earlyAccess = false,
) {
  return (
    earlyAccess ||
    (!!e &&
      ["active", "grace", "cancelled"].includes(e.status) &&
      Date.parse(e.expires_at) > Date.now())
  );
}
