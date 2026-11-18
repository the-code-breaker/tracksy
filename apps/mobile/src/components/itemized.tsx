import { View } from "react-native";
import { Card, Label, Field, Button, s } from "./ui";
import { parseMoney } from "@tracksy/finance";
import type { Currency, Member, ReceiptItem } from "@tracksy/domain";
export type ItemDraft = {
  description: string;
  amount: string;
  quantities: Record<string, string>;
};
export function buildItems(
  rows: ItemDraft[],
  currency: Currency,
): ReceiptItem[] {
  return rows.map((r) => ({
    description: r.description,
    amount_minor: r.amount.startsWith("-")
      ? -parseMoney(r.amount.slice(1), currency)
      : parseMoney(r.amount, currency),
    allocations: Object.entries(r.quantities)
      .filter(([, v]) => Number(v) > 0)
      .map(([user_id, v]) => ({ user_id, value: Number(v) })),
  }));
}
export function ItemizedEditor({
  rows,
  onChange,
  members,
  currency,
}: {
  rows: ItemDraft[];
  onChange: (rows: ItemDraft[]) => void;
  members: Member[];
  currency: Currency;
}) {
  function edit(i: number, patch: Partial<ItemDraft>) {
    onChange(rows.map((r, n) => (n === i ? { ...r, ...patch } : r)));
  }
  return (
    <View style={{ gap: 14 }}>
      <Label muted size={12}>
        Add items, tax, tip, or a negative discount line. Quantity shares assign
        each line to people. The server calculates and validates every
        allocation.
      </Label>
      {rows.map((row, i) => (
        <Card key={i} style={{ gap: 10 }}>
          <Field
            label={`Item ${i + 1}`}
            value={row.description}
            onChangeText={(v) => edit(i, { description: v })}
            placeholder="Meal, tax, tip, discount…"
          />
          <Field
            label={`Line total (${currency})`}
            value={row.amount}
            onChangeText={(v) => edit(i, { amount: v })}
            keyboardType="numbers-and-punctuation"
          />
          <Label size={12} weight="600">
            Quantity shares (0 excludes a person)
          </Label>
          {members
            .filter((m) => m.active)
            .map((m) => (
              <View
                key={m.user_id}
                style={[s.row, { justifyContent: "space-between" }]}
              >
                <Label size={13}>{m.display_name}</Label>
                <View style={{ width: 95 }}>
                  <Field
                    label="Shares"
                    value={row.quantities[m.user_id] || ""}
                    onChangeText={(v) =>
                      edit(i, {
                        quantities: { ...row.quantities, [m.user_id]: v },
                      })
                    }
                    keyboardType="number-pad"
                  />
                </View>
              </View>
            ))}
          <Button
            title="Remove line"
            variant="secondary"
            onPress={() => onChange(rows.filter((_, n) => n !== i))}
          />
        </Card>
      ))}
      <Button
        title="＋ Add receipt line"
        variant="secondary"
        onPress={() =>
          onChange([
            ...rows,
            {
              description: "",
              amount: "",
              quantities: Object.fromEntries(
                members.filter((m) => m.active).map((m) => [m.user_id, "1"]),
              ),
            },
          ])
        }
      />
    </View>
  );
}
