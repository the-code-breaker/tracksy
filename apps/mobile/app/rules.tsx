import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { rpc, supabase } from "../src/lib/supabase";
import {
  Screen,
  Card,
  Label,
  Button,
  Field,
  Notice,
  Loading,
  ErrorBox,
} from "../src/components/ui";
type Rule = {
  id: string;
  name: string;
  split_method: string;
  participants: { user_id: string; value: number }[];
};
export default function Rules() {
  const { group, expense } = useLocalSearchParams<{
    group: string;
    expense?: string;
  }>();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const cache = useQueryClient();
  const q = useQuery({
    queryKey: ["rules", group],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_split_rules")
        .select("*")
        .eq("group_id", group)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Rule[];
    },
  });
  return (
    <Screen
      title="A fair split, on repeat."
      subtitle="Save the way your group shares. Review before each use."
      back
    >
      <Notice>
        Group managers with Plus can save an expense’s split as a rule. Applying
        a rule opens a new expense for review; it never creates an obligation
        automatically.
      </Notice>
      {expense && (
        <Card style={{ gap: 14, maxWidth: 600 }}>
          <Field
            label="Rule name"
            placeholder="Rent 40/30/30, internet equally…"
            value={name}
            onChangeText={setName}
          />
          <Button
            title="Save this expense’s split rule"
            loading={busy}
            disabled={!name.trim()}
            onPress={async () => {
              setBusy(true);
              setError("");
              try {
                await rpc("rule_from_expense", {
                  p_expense: expense,
                  p_name: name,
                });
                await cache.invalidateQueries();
                router.setParams({ expense: "" });
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          />
        </Card>
      )}
      {error && <ErrorBox message={error} />}{" "}
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorBox message={q.error.message} />
      ) : q.data.length ? (
        q.data.map((rule) => (
          <Card key={rule.id} style={{ gap: 12 }}>
            <Label size={19} weight="700">
              {rule.name}
            </Label>
            <Label muted>
              {rule.split_method} · {rule.participants.length} participants
            </Label>
            <Button
              title="Review and use this rule"
              variant="secondary"
              onPress={() =>
                router.push({
                  pathname: "/expense/new",
                  params: { group, rule: rule.id },
                })
              }
            />
          </Card>
        ))
      ) : (
        <Card>
          <Label muted>
            No split rules yet. Open an expense and choose “Save split as rule”.
          </Label>
        </Card>
      )}
    </Screen>
  );
}
