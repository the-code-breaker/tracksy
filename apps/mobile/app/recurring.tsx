import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { rpc, supabase } from "../src/lib/supabase";
import { formatMoney } from "@tracksy/finance";
import type { Currency } from "@tracksy/domain";
import {
  Screen,
  Card,
  Label,
  Field,
  Button,
  Chips,
  Notice,
  Loading,
  ErrorBox,
  s,
} from "../src/components/ui";
type Rule = {
  id: string;
  template: { description: string; amount_minor: number; currency: Currency };
  next_date: string;
  auto_post: boolean;
  active: boolean;
};
type Run = {
  id: string;
  recurring_id: string;
  scheduled_date: string;
  status: string;
};
export default function Recurring() {
  const { group, expense } = useLocalSearchParams<{
    group: string;
    expense?: string;
  }>();
  const cache = useQueryClient();
  const [start, setStart] = useState(new Date().toISOString().slice(0, 10));
  const [end, setEnd] = useState("");
  const [interval, setInterval] = useState("1");
  const [mode, setMode] = useState("Approve each time");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const q = useQuery({
    queryKey: ["recurring", group],
    queryFn: async () => {
      const [rules, runs] = await Promise.all([
        supabase
          .from("recurring_expenses")
          .select("*")
          .eq("group_id", group)
          .order("next_date"),
        supabase
          .from("recurring_expense_runs")
          .select("*")
          .eq("group_id", group)
          .order("scheduled_date", { ascending: false })
          .limit(50),
      ]);
      if (rules.error) throw rules.error;
      if (runs.error) throw runs.error;
      return { rules: rules.data as Rule[], runs: runs.data as Run[] };
    },
  });
  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      await cache.invalidateQueries();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen
      title="A little less to remember."
      subtitle="Recurring bills, with you in control."
      back
    >
      <Notice>
        Only group managers with Group Plus can create or approve recurring
        expenses. Automatic posting uses the explicitly authorized fixed amounts
        and participants. Changed memberships require review.
      </Notice>
      {expense && (
        <Card style={{ gap: 14, maxWidth: 650 }}>
          <Label size={20} weight="700">
            Repeat this expense
          </Label>
          <Field
            label="First scheduled date (YYYY-MM-DD)"
            value={start}
            onChangeText={setStart}
          />
          <Field
            label="End date (optional)"
            value={end}
            onChangeText={setEnd}
          />
          <Field
            label="Repeat every N months (1–12)"
            value={interval}
            onChangeText={setInterval}
            keyboardType="number-pad"
          />
          <Chips
            options={["Approve each time", "Automatically post fixed expense"]}
            value={mode}
            onChange={setMode}
          />
          {mode !== "Approve each time" && (
            <Notice>
              Saving authorizes future financial obligations using this
              expense’s fixed payers, participants, amount, and currency until
              you stop the rule. Review the original expense before continuing.
            </Notice>
          )}
          <Button
            title="Save recurring schedule"
            loading={busy}
            onPress={() =>
              void act(async () => {
                await rpc("create_recurring", {
                  p_expense: expense,
                  p_start: start,
                  p_end: end || null,
                  p_interval: Number(interval),
                  p_auto: mode !== "Approve each time",
                });
                router.setParams({ expense: "" });
              })
            }
          />
        </Card>
      )}
      {error && <ErrorBox message={error} />}{" "}
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorBox message={q.error.message} />
      ) : (
        <>
          {q.data.rules.map((r) => (
            <Card key={r.id} style={{ gap: 12 }}>
              <Label weight="700">{r.template.description}</Label>
              <Label>
                {formatMoney(r.template.amount_minor, r.template.currency)} ·
                Next: {r.next_date}
              </Label>
              <Label muted size={12}>
                {r.active
                  ? r.auto_post
                    ? "Automatic, explicitly authorized"
                    : "Approval required"
                  : "Stopped"}
              </Label>
              {r.active && (
                <Button
                  title="Stop recurrence"
                  variant="secondary"
                  loading={busy}
                  onPress={() =>
                    void act(() => rpc("stop_recurring", { p_id: r.id }))
                  }
                />
              )}
            </Card>
          ))}
          <Label size={19} weight="700">
            Scheduled runs
          </Label>
          {q.data.runs.length ? (
            q.data.runs.map((r) => (
              <Card key={r.id} style={{ gap: 12 }}>
                <Label>
                  {
                    q.data.rules.find((rule) => rule.id === r.recurring_id)
                      ?.template.description
                  }{" "}
                  · {r.scheduled_date}
                </Label>
                <Label muted>{r.status.replaceAll("_", " ")}</Label>
                {r.status === "awaiting_approval" && (
                  <Button
                    title="Approve and post expense"
                    loading={busy}
                    onPress={() =>
                      void act(() =>
                        rpc("approve_recurring_run", { p_run: r.id }),
                      )
                    }
                  />
                )}
              </Card>
            ))
          ) : (
            <Card>
              <Label muted>
                No scheduled runs yet. The server worker generates due runs when
                configured.
              </Label>
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}
