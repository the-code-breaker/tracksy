import { useState } from "react";
import { GroupMembers } from "../../src/components/group-members";
import { GroupSettings } from "../../src/components/group-settings";
import { ReminderPanel } from "../../src/components/reminder-panel";
import { SettingsRow } from "../../src/components/settings";
import { View, Pressable, Share, Platform } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import { useGroup, isPremium } from "../../src/lib/data";
import { useAuth } from "../../src/lib/auth";
import { rpc, supabase } from "../../src/lib/supabase";
import { exportReport } from "../../src/lib/reports";
import { formatMoney, parseMoney } from "@tracksy/finance";
import type { Expense, Currency } from "@tracksy/domain";
import {
  GroupHero,
  Segmented,
  CategoryIcon,
} from "../../src/components/mobile";
import {
  Screen,
  Card,
  Label,
  Button,
  Chips,
  Field,
  Loading,
  ErrorBox,
  Notice,
  Empty,
  Section,
  Money,
  Badge,
  s,
  useColors,
} from "../../src/components/ui";
export default function GroupScreen() {
  const { id, tab: initialTab } = useLocalSearchParams<{
    id: string;
    tab?: string;
  }>();
  const q = useGroup(id || "");
  const { session } = useAuth();
  const cache = useQueryClient();
  const c = useColors();
  const [tab, setTab] = useState(
    ["Expenses", "Balances", "Members", "Settings"].includes(initialTab || "")
      ? initialTab!
      : "Expenses",
  );
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [email, setEmail] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [budget, setBudget] = useState("");
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const [rename, setRename] = useState("");
  const [description, setDescription] = useState("");
  const expenses = useQuery({
    queryKey: ["expenses", id, page, search],
    enabled: !!id,
    queryFn: async () => {
      let query = supabase
        .from("expenses")
        .select("*")
        .eq("group_id", id)
        .is("reversed_at", null)
        .order("created_at", { ascending: false })
        .order("id")
        .range(page * 25, page * 25 + 24);
      if (search)
        query = query.ilike(
          "description",
          `%${search.replaceAll("%", "").replaceAll("_", "")}%`,
        );
      const { data, error } = await query;
      if (error) throw error;
      return data as Expense[];
    },
  });
  async function act(fn: () => Promise<unknown>, message = "") {
    setError("");
    setNotice("");
    try {
      await fn();
      await cache.invalidateQueries();
      if (message) setNotice(message);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const current = q.data?.members.find((m) => m.user_id === session?.user.id);
  const manager = current?.role === "owner" || current?.role === "admin";
  const owner = current?.role === "owner";
  const premium = isPremium(q.data?.entitlement, q.data?.earlyAccess);
  const plan = useQuery({
    queryKey: ["settlement-plan", id],
    enabled:
      !!id &&
      premium &&
      tab === "Balances" &&
      !!q.data?.group.simplified_settlements,
    queryFn: () =>
      rpc<
        {
          from_user: string;
          to_user: string;
          amount_minor: number;
          currency: Currency;
        }[]
      >("settlement_plan", { p_group: id }),
  });
  async function exportCsv() {
    const year = new Date().getFullYear();
    const rows = await rpc<Record<string, unknown>[]>("export_group", {
      p_group: id,
      p_start: `${year}-01-01`,
      p_end: `${year}-12-31`,
    });
    const columns = [
      "id",
      "description",
      "amount_minor",
      "currency",
      "category",
      "expense_date",
      "reversed_at",
    ];
    const escape = (v: unknown) =>
      `"${String(v ?? "")
        .replaceAll('"', '""')
        .replace(/^[=+@-]/, "'$&")}"`;
    const csv = [
      columns.join(","),
      ...rows.map((r) => columns.map((k) => escape(r[k])).join(",")),
    ].join("\r\n");
    if (Platform.OS === "web") {
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tracksy-${year}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else await Share.share({ message: csv, title: `Tracksy ${year} export` });
  }
  return (
    <Screen
      header={!q.data}
      title={
        q.data
          ? `${q.data.group.icon} ${q.data.group.name}`
          : "Your shared group"
      }
      subtitle={
        q.data
          ? `${q.data.members.filter((m) => m.active).length} members · ${q.data.group.currency} · ${q.data.group.kind}`
          : undefined
      }
      back
      action={
        q.data && !q.data.group.archived_at ? (
          <Button
            title="Add expense"
            onPress={() =>
              router.push({ pathname: "/expense/new", params: { group: id } })
            }
          />
        ) : undefined
      }
    >
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorBox message={q.error.message} retry={() => void q.refetch()} />
      ) : (
        q.data && (
          <>
            <GroupHero
              title={q.data.group.name}
              subtitle={`${q.data.members.filter((m) => m.active).length} members · ${q.data.group.currency} · ${q.data.group.kind}`}
              members={q.data.members.filter((m) => m.active)}
              onBack={() =>
                router.canGoBack()
                  ? router.back()
                  : router.replace("/(tabs)/groups")
              }
              onSettings={() => setTab("Settings")}
              onMembers={() => setTab("Members")}
            />
            {q.data.group.archived_at && (
              <Notice>
                This group is archived. Financial records are preserved and new
                activity is disabled.
              </Notice>
            )}
            {error && <ErrorBox message={error} />}{" "}
            {notice && <Notice>{notice}</Notice>}
            <Card
              style={{
                backgroundColor: c.tint,
                borderColor: c.tint,
                gap: 8,
                padding: 18,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Label size={12} style={{ color: c.primary }}>
                  Your group balance
                </Label>
                {premium && <Badge text="GROUP PLUS" />}
              </View>
              {q.data.balances
                .filter((b) => b.user_id === session?.user.id)
                .map((b) => (
                  <View key={b.currency} style={{ gap: 2 }}>
                    <Money
                      amount={Math.abs(b.balance_minor)}
                      currency={b.currency}
                      size={29}
                    />
                    <Label
                      size={12}
                      style={{
                        color: b.balance_minor < 0 ? c.danger : c.primary,
                      }}
                    >
                      {b.balance_minor < 0
                        ? "You owe"
                        : b.balance_minor > 0
                          ? "You are owed"
                          : "All settled up"}
                    </Label>
                  </View>
                ))}
              {!q.data.balances.some((b) => b.user_id === session?.user.id) && (
                <Label size={25} weight="700">
                  All settled up
                </Label>
              )}
              {!q.data.group.archived_at && (
                <View style={{ flexDirection: "row", gap: 9, marginTop: 6 }}>
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Add expense"
                      onPress={() =>
                        router.push({
                          pathname: "/expense/new",
                          params: { group: id },
                        })
                      }
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Settle up"
                      variant="secondary"
                      onPress={() => setTab("Balances")}
                    />
                  </View>
                </View>
              )}
            </Card>
            <Segmented
              options={["Expenses", "Balances", "Members", "Settings"]}
              value={tab}
              onChange={setTab}
            />
            {tab === "Expenses" && (
              <>
                <Field
                  label="Search expenses"
                  value={search}
                  onChangeText={(v) => {
                    setPage(0);
                    setSearch(v);
                  }}
                  placeholder="Dinner, groceries, tickets…"
                />
                {expenses.isPending ? (
                  <Loading />
                ) : expenses.error ? (
                  <ErrorBox message={expenses.error.message} />
                ) : expenses.data.length ? (
                  <Card>
                    {expenses.data.map((e) => (
                      <Pressable
                        key={e.id}
                        accessibilityRole="button"
                        accessibilityLabel={`View expense ${e.description}`}
                        onPress={() => router.push(`/expense/${e.id}`)}
                        style={[
                          s.row,
                          {
                            paddingVertical: 18,
                            borderBottomWidth: 1,
                            borderColor: c.border,
                            opacity: e.reversed_at ? 0.5 : 1,
                          },
                        ]}
                      >
                        <CategoryIcon category={e.category} />
                        <View style={{ flex: 1 }}>
                          <Label weight="600">{e.description}</Label>
                          <Label muted size={12}>
                            {e.category} · {e.expense_date}
                            {e.reversed_at ? " · Reversed" : ""}
                          </Label>
                        </View>
                        <Money
                          size={17}
                          amount={e.amount_minor}
                          currency={e.currency}
                        />
                      </Pressable>
                    ))}
                  </Card>
                ) : (
                  <Empty
                    title="First shared expense?"
                    body="From the big adventures to the everyday things, keep it all together."
                    action={
                      <Button
                        title="Add expense"
                        onPress={() =>
                          router.push({
                            pathname: "/expense/new",
                            params: { group: id },
                          })
                        }
                      />
                    }
                  />
                )}
                <View style={s.row}>
                  <Button
                    title="Previous"
                    variant="secondary"
                    disabled={!page}
                    onPress={() => setPage((p) => p - 1)}
                  />
                  <Label muted>Page {page + 1}</Label>
                  <Button
                    title="Next"
                    variant="secondary"
                    disabled={(expenses.data?.length ?? 0) < 25}
                    onPress={() => setPage((p) => p + 1)}
                  />
                </View>
              </>
            )}
            {tab === "Balances" && (
              <>
                <Section title="Everyone’s balance">
                  <Card>
                    {q.data.balances.length ? (
                      q.data.balances.map((b) => (
                        <View
                          key={`${b.user_id}-${b.currency}`}
                          style={[
                            s.row,
                            {
                              justifyContent: "space-between",
                              paddingVertical: 12,
                            },
                          ]}
                        >
                          <View>
                            <Label weight="600">
                              {q.data!.members.find(
                                (m) => m.user_id === b.user_id,
                              )?.display_name || "Former member"}
                            </Label>
                            <Label muted size={12}>
                              {b.balance_minor < 0
                                ? "Owes the group"
                                : "Is owed by the group"}
                            </Label>
                          </View>
                          <Money
                            size={18}
                            amount={Math.abs(b.balance_minor)}
                            currency={b.currency}
                          />
                        </View>
                      ))
                    ) : (
                      <Label muted>
                        Everything is balanced. No expenses yet.
                      </Label>
                    )}
                  </Card>
                </Section>
                <Button
                  title="Record a payment"
                  onPress={() =>
                    router.push({ pathname: "/settle", params: { group: id } })
                  }
                  disabled={!!q.data.group.archived_at}
                />
                <ReminderPanel id={id} />
                <Section title="Payment history">
                  {q.data.settlements.length ? (
                    q.data.settlements.map((p) => (
                      <Card key={p.id} style={{ gap: 12 }}>
                        <View
                          style={[s.row, { justifyContent: "space-between" }]}
                        >
                          <Label weight="600">
                            {
                              q.data!.members.find(
                                (m) => m.user_id === p.from_user,
                              )?.display_name
                            }{" "}
                            →{" "}
                            {
                              q.data!.members.find(
                                (m) => m.user_id === p.to_user,
                              )?.display_name
                            }
                          </Label>
                          <Money
                            size={17}
                            amount={p.amount_minor}
                            currency={p.currency}
                          />
                        </View>
                        <Label muted size={12}>
                          {p.status} · {p.method} · User reported, not provider
                          verified
                        </Label>
                        {(session?.user.id === p.from_user ||
                          session?.user.id === p.to_user) && (
                          <View style={s.wrap}>
                            {p.status === "pending" && (
                              <>
                                <Button
                                  title={
                                    session?.user.id === p.created_by
                                      ? "Awaiting counterparty confirmation"
                                      : "Confirm received / paid"
                                  }
                                  disabled={session?.user.id === p.created_by}
                                  onPress={() =>
                                    void act(() =>
                                      rpc("respond_settlement", {
                                        p_id: p.id,
                                        p_action: "confirm",
                                      }),
                                    )
                                  }
                                />
                                <Button
                                  title="Dispute"
                                  variant="secondary"
                                  onPress={() =>
                                    void act(() =>
                                      rpc("respond_settlement", {
                                        p_id: p.id,
                                        p_action: "dispute",
                                      }),
                                    )
                                  }
                                />
                              </>
                            )}
                            {p.status === "confirmed" && (
                              <Button
                                title="Reverse payment record"
                                variant="secondary"
                                onPress={() =>
                                  void act(() =>
                                    rpc("respond_settlement", {
                                      p_id: p.id,
                                      p_action: "reverse",
                                    }),
                                  )
                                }
                              />
                            )}
                          </View>
                        )}
                      </Card>
                    ))
                  ) : (
                    <Card>
                      <Label muted>No payment records yet.</Label>
                    </Card>
                  )}
                </Section>
                {premium && (
                  <Section title="Suggested settlement plan">
                    <Notice>
                      Optional suggestions use net balances and may route
                      payments through different members. These suggestions do
                      not change anyone’s obligations. Agree with your group
                      before paying.
                    </Notice>
                    {!q.data.group.simplified_settlements ? (
                      <Label muted>
                        Suggestions are disabled for this group.
                      </Label>
                    ) : plan.isPending ? (
                      <Loading />
                    ) : plan.error ? (
                      <ErrorBox message={plan.error.message} />
                    ) : (
                      <Card>
                        {plan.data?.length ? (
                          plan.data.map((t, i) => (
                            <Label key={i}>
                              {
                                q.data!.members.find(
                                  (m) => m.user_id === t.from_user,
                                )?.display_name
                              }{" "}
                              →{" "}
                              {
                                q.data!.members.find(
                                  (m) => m.user_id === t.to_user,
                                )?.display_name
                              }
                              : {formatMoney(t.amount_minor, t.currency)}
                            </Label>
                          ))
                        ) : (
                          <Label muted>Everything is settled.</Label>
                        )}
                      </Card>
                    )}
                  </Section>
                )}
              </>
            )}
            {tab === "Members" && <GroupMembers id={id} />}
            {tab === "Settings" && (
              <GroupSettings id={id} exportCsv={exportCsv} />
            )}
          </>
        )
      )}
    </Screen>
  );
}
