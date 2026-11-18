import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Linking, View } from "react-native";
import { SelectField } from "../src/components/select-field";
import * as Crypto from "expo-crypto";
import { useQueryClient } from "@tanstack/react-query";
import { useGroup } from "../src/lib/data";
import { useAuth } from "../src/lib/auth";
import { rpc } from "../src/lib/supabase";
import { parseMoney } from "@tracksy/finance";
import type { Currency } from "@tracksy/domain";
import {
  Screen,
  Field,
  Button,
  Label,
  ErrorBox,
  Notice,
  Loading,
} from "../src/components/ui";
export default function Settle() {
  const { group } = useLocalSearchParams<{ group: string }>();
  const q = useGroup(group || "");
  const { session } = useAuth();
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [currency, setCurrency] = useState<Currency>("INR");
  const [notes, setNotes] = useState("");
  const [reference, setReference] = useState("");
  const [upi, setUpi] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [key] = useState(Crypto.randomUUID());
  const cache = useQueryClient();
  async function recordPayment() {
    setBusy(true);
    setError("");
    try {
      await rpc("create_settlement", {
        p: {
          group_id: group,
          from_user: session?.user.id,
          to_user: to,
          amount_minor: parseMoney(amount, currency),
          currency,
          method,
          notes,
          payment_reference: reference,
          idempotency_key: key,
        },
      });
      await cache.invalidateQueries();
      router.back();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen
      title="Settle up"
      back
      footer={
        !!q.data &&
        !q.error && (
          <Button
            title="Record payment"
            loading={busy}
            disabled={!to || !amount}
            onPress={() => void recordPayment()}
          />
        )
      }
    >
      <View style={{ gap: 20 }}>
        <Notice>
          Payments are user reported. Balances update after the other party
          confirms. Opening a payment app does not verify a transfer.
        </Notice>
        {q.isPending ? (
          <Loading />
        ) : q.error ? (
          <ErrorBox message={q.error.message} />
        ) : (
          <>
            <SelectField
              label="Paid to"
              value={to}
              onChange={setTo}
              options={(q.data?.members || [])
                .filter((m) => m.user_id !== session?.user.id)
                .map((m) => ({ value: m.user_id, label: m.display_name }))}
            />
            <Field
              label="Amount paid"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />
            <SelectField
              label="Currency"
              options={["INR", "USD", "EUR", "GBP", "JPY", "KWD"] as const}
              value={currency}
              onChange={setCurrency}
            />
            <SelectField
              label="Payment method"
              options={[
                { value: "cash", label: "Cash" },
                { value: "bank", label: "Bank transfer" },
                { value: "upi", label: "UPI" },
                { value: "other", label: "Other" },
              ]}
              value={method}
              onChange={setMethod}
            />
            {method === "upi" && (
              <>
                <Field
                  label="Recipient UPI ID (optional)"
                  value={upi}
                  onChangeText={setUpi}
                  autoCapitalize="none"
                />
                <Button
                  title="Open UPI app"
                  variant="secondary"
                  disabled={!upi || currency !== "INR"}
                  onPress={async () => {
                    try {
                      if (!/^[\w.\-]+@[\w.\-]+$/.test(upi))
                        throw new Error("Enter a valid UPI ID");
                      parseMoney(amount, "INR");
                      await Linking.openURL(
                        `upi://pay?pa=${encodeURIComponent(upi)}&pn=${encodeURIComponent(q.data?.members.find((m) => m.user_id === to)?.display_name || "Member")}&am=${encodeURIComponent(amount)}&cu=INR&tn=Tracksy%20settlement`,
                      );
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                />
              </>
            )}
            <Field
              label="Payment reference (optional)"
              value={reference}
              onChangeText={setReference}
            />
            <Field
              label="Notes (optional)"
              value={notes}
              onChangeText={setNotes}
              multiline
            />
            {error && <ErrorBox message={error} />}
          </>
        )}
      </View>
    </Screen>
  );
}
