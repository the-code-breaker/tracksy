import { useState } from "react";
import { View, Pressable } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import {
  Pencil,
  Plus,
  Trash2,
  Mail,
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react-native";
import type { Activity, Currency } from "@tracksy/domain";
import { formatMoney } from "@tracksy/finance";
import { useGroups } from "../lib/data";
import { useAuth } from "../lib/auth";
import { supabase, rpc } from "../lib/supabase";
import {
  Screen,
  Card,
  Label,
  Loading,
  ErrorBox,
  Empty,
  useColors,
} from "../components/ui";
import { Segmented, IconButton } from "../components/mobile";
function summary(event: Activity, name: string) {
  const description =
    typeof event.detail.description === "string"
      ? event.detail.description
      : "an expense";
  const labels: Record<string, string> = {
    expense_added: `${name} added ${description}`,
    expense_corrected: `${name} edited ${description}`,
    expense_reversed: `${name} deleted ${description}`,
    invitation_created: `${name} created an invitation`,
    invitation_emailed: `${name} emailed an invitation`,
    reminder_emailed: `${name} sent a payment reminder`,
    group_created: `${name} created the group`,
    group_archived: `${name} archived the group`,
    group_restored: `${name} restored the group`,
    member_joined: `${name} joined the group`,
  };
  return (
    labels[event.event_type] ||
    `${name} ${event.event_type.replaceAll("_", " ")}`
  );
}
export default function ActivityScreen() {
  const [page, setPage] = useState(0),
    [filter, setFilter] = useState("All"),
    groups = useGroups(),
    { session } = useAuth(),
    c = useColors();
  const people = useQuery({
    queryKey: [
      "activity-people",
      session?.user.id,
      groups.data?.map((g) => g.id).join(","),
    ],
    enabled: !!groups.data,
    queryFn: async () =>
      Object.fromEntries(
        (
          await Promise.all(
            groups.data!.map((g) =>
              rpc<{ user_id: string; display_name: string }[]>("list_members", {
                p_group: g.id,
              }),
            ),
          )
        )
          .flat()
          .map((m) => [m.user_id, m.display_name]),
      ),
  });
  const q = useQuery({
    queryKey: ["activity", session?.user.id, page, filter],
    queryFn: async () => {
      let query = supabase
        .from("expense_audit_events")
        .select("*")
        .order("created_at", { ascending: false })
        .order("id")
        .range(page * 30, page * 30 + 29);
      if (filter === "Expenses") query = query.like("event_type", "expense_%");
      if (filter === "Payments")
        query = query.like("event_type", "settlement_%");
      const r = await query;
      if (r.error) throw r.error;
      return r.data as Activity[];
    },
  });
  return (
    <Screen title="Activity" back>
      <Segmented
        options={["All", "Expenses", "Payments"]}
        value={filter}
        onChange={(v) => {
          setPage(0);
          setFilter(v);
        }}
      />
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorBox message={q.error.message} />
      ) : !q.data.length ? (
        <Empty
          artwork="settled"
          title="No activity yet"
          body="Group updates and expense edits will appear here."
        />
      ) : (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          {q.data.map((a, i) => {
            const name =
                people.data?.[a.actor_id] ||
                (a.actor_id === session?.user.id ? "You" : "A member"),
              Icon =
                a.event_type === "expense_corrected"
                  ? Pencil
                  : a.event_type === "expense_reversed"
                    ? Trash2
                    : a.event_type.includes("invitation") ||
                        a.event_type.includes("reminder")
                      ? Mail
                      : a.event_type.startsWith("settlement_")
                        ? ArrowLeftRight
                        : Plus;
            const before = a.detail.before as
                { amount_minor?: number; currency?: Currency } | undefined,
              after = a.detail.after as
                { amount_minor?: number; currency?: Currency } | undefined;
            return (
              <Pressable
                key={a.id}
                accessibilityRole="button"
                accessibilityLabel={summary(a, name)}
                onPress={() =>
                  router.push(
                    a.event_type.startsWith("expense_") && a.entity_id
                      ? `/expense/${a.entity_id}`
                      : `/group/${a.group_id}`,
                  )
                }
                style={{
                  padding: 16,
                  flexDirection: "row",
                  gap: 12,
                  borderTopWidth: i ? 1 : 0,
                  borderColor: c.border,
                }}
              >
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    backgroundColor: c.tint,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon size={17} color={c.primary} />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Label size={14} weight="500">
                    {summary(a, name)}
                  </Label>
                  {before?.currency &&
                    after?.currency &&
                    before.amount_minor !== after.amount_minor && (
                      <Label size={12} muted>
                        {formatMoney(
                          Number(before.amount_minor),
                          before.currency,
                        )}{" "}
                        →{" "}
                        {formatMoney(
                          Number(after.amount_minor),
                          after.currency,
                        )}
                      </Label>
                    )}
                  <Label size={11} muted>
                    {groups.data?.find((g) => g.id === a.group_id)?.name} ·{" "}
                    {new Date(a.created_at).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </Label>
                </View>
              </Pressable>
            );
          })}
        </Card>
      )}
      {(page > 0 || (q.data?.length || 0) >= 30) && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <IconButton
            label="Previous page"
            onPress={() => setPage((p) => Math.max(0, p - 1))}
          >
            <ChevronLeft size={22} color={c.text} />
          </IconButton>
          <Label size={12} muted>
            Page {page + 1}
          </Label>
          <IconButton
            label="Next page"
            onPress={() => {
              if ((q.data?.length || 0) >= 30) setPage((p) => p + 1);
            }}
          >
            <ChevronRight size={22} color={c.text} />
          </IconButton>
        </View>
      )}
    </Screen>
  );
}
