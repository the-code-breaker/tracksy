import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { ChartNoAxesCombined } from "lucide-react-native";
import { useGroups, useGroup, isPremium } from "../../src/lib/data";
import { rpc, supabase } from "../../src/lib/supabase";
import type { Currency } from "@tracksy/domain";
import { formatMoney } from "@tracksy/finance";
import {
  Screen,
  Card,
  Label,
  Button,
  Loading,
  ErrorBox,
  Empty,
  Section,
  TextLink,
  useColors,
} from "../../src/components/ui";
import { Segmented } from "../../src/components/mobile";
import { SelectField } from "../../src/components/select-field";
import { SpendingDonut, MonthlyBars } from "../../src/components/charts";
type Row = {
  currency: Currency;
  category: string;
  month: string;
  amount_minor: number;
  count: number;
};
export default function Insights() {
  const groups = useGroups(),
    [selected, setSelected] = useState(""),
    [chosen, setChosen] = useState<Currency>(),
    [period, setPeriod] = useState("This year"),
    c = useColors();
  const groupId =
      selected || groups.data?.find((g) => !g.archived_at)?.id || "",
    group = useGroup(groupId),
    premium = isPremium(group.data?.entitlement, group.data?.earlyAccess),
    now = new Date(),
    year = now.getFullYear(),
    month = String(now.getMonth() + 1).padStart(2, "0"),
    currency = chosen || group.data?.group.currency || "INR";
  const q = useQuery({
    queryKey: ["analytics", groupId, year],
    enabled: !!groupId && premium,
    queryFn: () =>
      rpc<Row[]>("group_analytics", {
        p_group: groupId,
        p_start: `${year}-01-01`,
        p_end: `${year}-12-31`,
      }),
  });
  const budgets = useQuery({
    queryKey: ["budgets", groupId],
    enabled: !!groupId && premium,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budgets")
        .select("*")
        .eq("group_id", groupId)
        .eq("month", `${year}-${month}-01`);
      if (error) throw error;
      return data as { id: string; amount_minor: number; currency: Currency }[];
    },
  });
  const allRows = (q.data ?? []).filter((r) => r.currency === currency),
    rows = allRows.filter(
      (r) => period === "This year" || r.month.startsWith(`${year}-${month}`),
    );
  const categories = new Map<string, number>();
  for (const row of rows)
    categories.set(
      row.category,
      (categories.get(row.category) || 0) + Number(row.amount_minor),
    );
  const series = [...categories]
      .map(([label, amount]) => ({ label, amount }))
      .sort((a, b) => b.amount - a.amount),
    total = series.reduce((s, r) => s + r.amount, 0);
  const months = Array.from(
    { length: Math.min(now.getMonth() + 1, 6) },
    (_, i) => {
      const index = now.getMonth() - Math.min(now.getMonth() + 1, 6) + 1 + i,
        date = new Date(year, index, 1),
        key = `${year}-${String(index + 1).padStart(2, "0")}`;
      return {
        label: date.toLocaleDateString("en", { month: "short" }),
        amount: allRows
          .filter((r) => r.month.startsWith(key))
          .reduce((s, r) => s + Number(r.amount_minor), 0),
      };
    },
  );
  return (
    <Screen
      title="Analytics"
      subtitle={`${year} · your shared spending at a glance`}
    >
      {groups.isPending ? (
        <Loading />
      ) : groups.error ? (
        <ErrorBox message={groups.error.message} />
      ) : !groupId ? (
        <Empty
          title="Your spending, made clear"
          body="Create a group to start building your shared expense history."
          action={
            <Button
              title="Create group"
              onPress={() => router.push("/group/new")}
            />
          }
        />
      ) : (
        <>
          <SelectField
            label="Group"
            value={groupId}
            options={(groups.data ?? [])
              .filter((g) => !g.archived_at)
              .map((g) => ({ value: g.id, label: `${g.icon} ${g.name}` }))}
            onChange={(id) => {
              setSelected(id);
              setChosen(undefined);
            }}
          />
          {group.isPending ? (
            <Loading />
          ) : group.error ? (
            <ErrorBox message={group.error.message} />
          ) : !premium ? (
            <Card style={{ gap: 14, alignItems: "center", padding: 25 }}>
              <View
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: 20,
                  backgroundColor: c.tint,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ChartNoAxesCombined size={28} color={c.primary} />
              </View>
              <Label size={22} weight="700" style={{ textAlign: "center" }}>
                See the bigger picture
              </Label>
              <Label size={13} muted style={{ textAlign: "center" }}>
                Group Plus adds spending charts, monthly trends and budgets for
                everyone in this group.
              </Label>
              <Button
                title="Explore Group Plus"
                onPress={() =>
                  router.push({ pathname: "/plus", params: { group: groupId } })
                }
              />
            </Card>
          ) : (
            <>
              <Segmented
                options={["This month", "This year"]}
                value={period}
                onChange={setPeriod}
              />
              <SelectField
                label="Currency"
                hideLabel
                compact
                value={currency}
                options={(
                  ["INR", "USD", "EUR", "GBP", "JPY", "KWD"] as Currency[]
                ).map((value) => ({ value, label: value }))}
                onChange={setChosen}
              />
              {q.isPending ? (
                <Loading />
              ) : q.error ? (
                <ErrorBox
                  message={q.error.message}
                  retry={() => void q.refetch()}
                />
              ) : (
                <>
                  <Card style={{ gap: 6 }}>
                    <Label size={12} muted>
                      Total spending · {period.toLowerCase()}
                    </Label>
                    <Label
                      size={31}
                      weight="700"
                      style={{
                        letterSpacing: -0.8,
                        fontVariant: ["tabular-nums"],
                      }}
                    >
                      {formatMoney(total, currency)}
                    </Label>
                    <Label size={11} muted>
                      {rows.reduce((sum, r) => sum + Number(r.count), 0)}{" "}
                      expenses recorded · {group.data?.group.name}
                    </Label>
                  </Card>
                  <Card style={{ gap: 19 }}>
                    <Label size={15} weight="700">
                      Spending by category
                    </Label>
                    <SpendingDonut series={series} currency={currency} />
                  </Card>
                  <Card style={{ gap: 12 }}>
                    <Label size={15} weight="700">
                      Monthly spending
                    </Label>
                    <MonthlyBars series={months} currency={currency} />
                  </Card>
                  <Section title="This month’s budget">
                    {budgets.error ? (
                      <ErrorBox message={budgets.error.message} />
                    ) : budgets.isPending ? (
                      <Loading />
                    ) : budgets.data?.filter((b) => b.currency === currency)
                        .length ? (
                      budgets.data
                        .filter((b) => b.currency === currency)
                        .map((b) => {
                          const spent = allRows
                            .filter((r) =>
                              r.month.startsWith(`${year}-${month}`),
                            )
                            .reduce((s, r) => s + Number(r.amount_minor), 0);
                          return (
                            <Card key={b.id} style={{ gap: 9 }}>
                              <Label size={20} weight="700">
                                {formatMoney(
                                  Number(b.amount_minor) - spent,
                                  currency,
                                )}{" "}
                                remaining
                              </Label>
                              <Label size={12} muted>
                                {formatMoney(spent, currency)} of{" "}
                                {formatMoney(b.amount_minor, currency)} used
                              </Label>
                              <View
                                style={{
                                  height: 8,
                                  borderRadius: 4,
                                  backgroundColor: c.surfaceAlt,
                                }}
                              >
                                <View
                                  style={{
                                    height: 8,
                                    borderRadius: 4,
                                    width: `${Math.min(100, Math.max(0, (spent / Number(b.amount_minor)) * 100))}%`,
                                    backgroundColor:
                                      spent > b.amount_minor
                                        ? c.danger
                                        : c.primary,
                                  }}
                                />
                              </View>
                            </Card>
                          );
                        })
                    ) : (
                      <Card>
                        <Label size={13} muted>
                          No budget set for {currency}. A group manager can add
                          one in group settings.
                        </Label>
                      </Card>
                    )}
                  </Section>
                  {!!group.data?.settlements.filter(
                    (s) => s.status === "pending",
                  ).length && (
                    <Section
                      title="Pending settlements"
                      action={
                        <TextLink
                          title="See all"
                          onPress={() =>
                            router.push({
                              pathname: "/group/[id]",
                              params: { id: groupId, tab: "Balances" },
                            })
                          }
                        />
                      }
                    >
                      {group.data.settlements
                        .filter((s) => s.status === "pending")
                        .slice(0, 3)
                        .map((payment) => (
                          <Card
                            key={payment.id}
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 10,
                            }}
                          >
                            <View style={{ flex: 1, gap: 4 }}>
                              <Label size={13} weight="600">
                                Awaiting confirmation
                              </Label>
                              <Label size={11} muted>
                                {group.data?.group.name}
                              </Label>
                            </View>
                            <Label size={15} weight="700">
                              {formatMoney(
                                payment.amount_minor,
                                payment.currency,
                              )}
                            </Label>
                          </Card>
                        ))}
                    </Section>
                  )}
                </>
              )}
            </>
          )}
        </>
      )}
    </Screen>
  );
}
