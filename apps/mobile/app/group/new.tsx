import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { groupSchema } from "@tracksy/validation";
import { rpc } from "../../src/lib/supabase";
import type { Currency } from "@tracksy/domain";
import { SelectField } from "../../src/components/select-field";
import {
  Screen,
  Field,
  Chips,
  Button,
  Label,
  ErrorBox,
} from "../../src/components/ui";
export default function NewGroup() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState<Currency>("INR");
  const [kind, setKind] = useState("friends");
  const [icon, setIcon] = useState("🏡");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const cache = useQueryClient();
  async function save() {
    setBusy(true);
    setError("");
    try {
      const v = groupSchema.parse({ name, description, currency, kind, icon });
      const id = await rpc<string>("create_group", {
        p_name: v.name,
        p_description: v.description,
        p_currency: v.currency,
        p_kind: v.kind,
        p_icon: v.icon,
      });
      await cache.invalidateQueries();
      router.replace(`/group/${id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen
      title="Create group"
      subtitle="Choose a name, group type, and base currency."
      back
      footer={
        <Button
          title="Create group"
          loading={busy}
          disabled={!name.trim()}
          onPress={() => void save()}
        />
      }
    >
      <View style={{ gap: 20 }}>
        <Label weight="600">Group icon</Label>
        <Chips
          options={["🏡", "🏖️", "🍜", "✈️", "🎉", "💛", "💼", "◈"]}
          value={icon}
          onChange={setIcon}
        />
        <Field
          label="Group name"
          placeholder="The apartment, Goa crew, Friday table…"
          value={name}
          onChangeText={setName}
          maxLength={80}
        />
        <Field
          label="Description (optional)"
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={500}
        />
        <SelectField
          label="Group type"
          options={[
            "friends",
            "roommates",
            "couples",
            "family",
            "travel",
            "events",
            "office",
            "custom",
          ]}
          value={kind}
          onChange={setKind}
        />
        <SelectField
          label="Base currency"
          options={["INR", "USD", "EUR", "GBP", "JPY", "KWD"] as const}
          value={currency}
          onChange={setCurrency}
        />
        {error && <ErrorBox message={error} />}
      </View>
    </Screen>
  );
}
