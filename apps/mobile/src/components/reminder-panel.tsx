import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { Mail } from "lucide-react-native";
import type { Currency } from "@tracksy/domain";
import { formatMoney } from "@tracksy/finance";
import { rpc } from "../lib/supabase";
import { sendGroupMail } from "../lib/group-mail";
import { Sheet } from "./sheet";
import { SettingsRow, SettingsSection } from "./settings";
import { Label, Button, Notice, ErrorBox, useColors } from "./ui";
type Target = {
  user_id: string;
  display_name: string;
  currency: Currency;
  balance_minor: number;
  can_remind: boolean;
  last_sent_at: string | null;
};
export function ReminderPanel({ id }: { id: string }) {
  const c = useColors(),
    cache = useQueryClient(),
    [target, setTarget] = useState<Target | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [key, setKey] = useState("");
  const q = useQuery({
    queryKey: ["reminder-targets", id],
    queryFn: () => rpc<Target[]>("reminder_targets", { p_group: id }),
  });
  const targets = q.data?.filter((t) => t.can_remind) || [];
  if (!targets.length && !target)
    return notice ? <Notice>{notice}</Notice> : null;
  return (
    <>
      <SettingsSection title="Payment reminders">
        {targets.map((t) => (
          <SettingsRow
            key={t.user_id + t.currency}
            title={t.display_name}
            subtitle={`${formatMoney(-t.balance_minor, t.currency)} outstanding in this group`}
            icon={<Mail size={19} color={c.primary} />}
            onPress={() => {
              setTarget(t);
              setKey(Crypto.randomUUID());
              setError("");
            }}
            last
          />
        ))}
      </SettingsSection>
      {notice && <Notice>{notice}</Notice>}
      <Sheet
        title="Send a reminder"
        open={!!target}
        onClose={() => {
          if (!busy) setTarget(null);
        }}
      >
        <Label size={14}>
          Email {target?.display_name} a friendly reminder to check their
          outstanding group balance?
        </Label>
        <Label muted size={12}>
          No amounts or expense details are included in the email. Reminders are
          limited to once per person, per currency, every 24 hours.
        </Label>
        {error && <ErrorBox message={error} />}
        <Button
          title="Send email"
          icon={<Mail size={18} color="#fff" />}
          loading={busy}
          onPress={async () => {
            if (!target || busy) return;
            setBusy(true);
            setError("");
            try {
              await sendGroupMail({
                kind: "reminder",
                group_id: id,
                recipient_id: target.user_id,
                currency: target.currency,
                request_key: key,
              });
              setNotice(`Reminder emailed to ${target.display_name}.`);
              setTarget(null);
              await cache.invalidateQueries({
                queryKey: ["reminder-targets", id],
              });
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
      </Sheet>
    </>
  );
}
