import { useState } from "react";
import { View, Share, Keyboard } from "react-native";
import * as Clipboard from "expo-clipboard";
import * as Crypto from "expo-crypto";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MoreHorizontal,
  Mail,
  Link as LinkIcon,
  Copy,
  Share2,
  UserPlus,
} from "lucide-react-native";
import type { Member } from "@tracksy/domain";
import { useGroup } from "../lib/data";
import { useAuth } from "../lib/auth";
import { rpc, supabase } from "../lib/supabase";
import { invitationUrl, sendGroupMail } from "../lib/group-mail";
import { Label, Button, Field, Card, ErrorBox, Notice, useColors } from "./ui";
import { Avatar, IconButton } from "./mobile";
import { Sheet } from "./sheet";
import { SettingsRow, SettingsSection } from "./settings";
export function GroupMembers({ id }: { id: string }) {
  const q = useGroup(id),
    { session } = useAuth(),
    c = useColors(),
    cache = useQueryClient();
  const [member, setMember] = useState<Member | null>(null),
    [invite, setInvite] = useState(false),
    [email, setEmail] = useState(""),
    [link, setLink] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [confirmation, setConfirmation] = useState<"remove" | "transfer" | null>(
      null,
    ),
    [mailKey, setMailKey] = useState(Crypto.randomUUID());
  const owner = q.data?.members.some(
    (m) => m.user_id === session?.user.id && m.role === "owner" && m.active,
  );
  const invites = useQuery({
    queryKey: ["invitations", id],
    queryFn: async () => {
      const r = await supabase
        .from("group_invitations")
        .select("id,email,expires_at,accepted_at")
        .eq("group_id", id)
        .is("accepted_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });
      if (r.error) throw r.error;
      return r.data as {
        id: string;
        email: string | null;
        expires_at: string;
      }[];
    },
  });
  async function action(task: () => Promise<unknown>, success = "") {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await task();
      void cache.invalidateQueries({ queryKey: ["invitations", id] });
      void cache.invalidateQueries({ queryKey: ["group", id] });
      if (success) setNotice(success);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function manage(kind: string) {
    if (!member) return;
    await action(async () => {
      await rpc("manage_member", {
        p_group: id,
        p_user: member.user_id,
        p_action: kind,
      });
      setMember(null);
      setConfirmation(null);
    }, "Member updated.");
  }
  return (
    <>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Label size={16} weight="700">
          {q.data?.members.filter((m) => m.active).length || 0} members
        </Label>
        <Button
          title="Invite"
          icon={<UserPlus size={17} color="#fff" />}
          disabled={busy || !!q.data?.group.archived_at}
          onPress={() => {
            setInvite(true);
            setEmail("");
            setLink("");
            setError("");
            setNotice("");
            setMailKey(Crypto.randomUUID());
          }}
        />
      </View>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        {q.data?.members
          .filter((m) => m.active)
          .map((m, i) => (
            <View
              key={m.user_id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                padding: 15,
                borderTopWidth: i ? 1 : 0,
                borderColor: c.border,
              }}
            >
              <Avatar name={m.display_name} size={42} />
              <View style={{ flex: 1, gap: 3 }}>
                <Label weight="600" size={14}>
                  {m.display_name}
                  {m.user_id === session?.user.id ? " (you)" : ""}
                </Label>
                <Label muted size={11}>
                  {m.role === "owner"
                    ? "Group owner"
                    : m.role === "admin"
                      ? "Group admin"
                      : "Member"}
                </Label>
              </View>
              {owner && m.user_id !== session?.user.id && (
                <IconButton
                  label={`Manage ${m.display_name}`}
                  onPress={() => {
                    setMember(m);
                    setConfirmation(null);
                    setError("");
                  }}
                >
                  <MoreHorizontal size={21} color={c.muted} />
                </IconButton>
              )}
            </View>
          ))}
      </Card>
      {!!invites.data?.length && (
        <SettingsSection title="Pending invitations">
          {invites.data.map((v, i) => (
            <SettingsRow
              key={v.id}
              title={v.email || "Shared invitation link"}
              subtitle={`Awaiting acceptance · expires ${new Date(v.expires_at).toLocaleDateString()}`}
              icon={<Mail size={19} color={c.muted} />}
              last={i === invites.data.length - 1}
            />
          ))}
        </SettingsSection>
      )}
      <Label size={12} muted>
        Only the people selected on an expense share its cost. Inviting or
        adding someone does not change earlier expenses.
      </Label>
      {notice && !invite && <Notice>{notice}</Notice>}
      {error && !invite && !member && <ErrorBox message={error} />}
      <Sheet
        title="Invite a friend"
        open={invite}
        onClose={() => {
          setInvite(false);
        }}
      >
        <Label size={13} muted>
          Send an invitation by email, or share a link.
        </Label>
        <Field
          label="Email address"
          placeholder="friend@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          returnKeyType="done"
          onSubmitEditing={() => Keyboard.dismiss()}
          value={email}
          editable={!busy}
          onChangeText={(v) => {
            setEmail(v);
            setMailKey(Crypto.randomUUID());
          }}
        />
        <Button
          title="Send invitation"
          loading={busy}
          disabled={!email.trim()}
          icon={<Mail size={18} color="#fff" />}
          onPress={() =>
            void action(async () => {
              const result = await sendGroupMail({
                kind: "invite",
                group_id: id,
                email: email.trim().toLowerCase(),
                request_key: mailKey,
              });
              if (result.link) setLink(result.link);
            }, `Invitation sent to ${email.trim()}.`)
          }
        />
        <SettingsRow
          title="Create a shareable link"
          disabled={busy}
          icon={<LinkIcon size={19} color={c.primary} />}
          onPress={() =>
            void action(async () => {
              const token = await rpc<string>("invite_member", {
                p_group: id,
                p_email: null,
              });
              setLink(invitationUrl(token));
            }, "Invitation link is ready.")
          }
          last
        />
        {link && (
          <Card style={{ gap: 10, backgroundColor: c.tint }}>
            <Label size={13} weight="600">
              Invitation link
            </Label>
            <Label size={12} muted>
              tracksy-support.coralprawn64.chatgpt.site/join/…
            </Label>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Button
                  title="Copy link"
                  disabled={busy}
                  variant="secondary"
                  icon={<Copy size={16} color={c.text} />}
                  onPress={() =>
                    void action(async () => {
                      if (!(await Clipboard.setStringAsync(link)))
                        throw Error(
                          "Could not copy the link. Try Share instead.",
                        );
                    }, "Invitation link copied.")
                  }
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title="Share"
                  disabled={busy}
                  variant="secondary"
                  icon={<Share2 size={17} color={c.text} />}
                  onPress={() =>
                    void action(() =>
                      Share.share({
                        message: `Join ${q.data?.group.name} on Tracksy: ${link}`,
                        url: link,
                      }),
                    )
                  }
                />
              </View>
            </View>
            <Label size={11} muted>
              Valid for seven days. Each link lets one person join.
            </Label>
          </Card>
        )}
        {notice && <Notice>{notice}</Notice>}
        {error && <ErrorBox message={error} />}
      </Sheet>
      <Sheet
        title={member?.display_name || "Member"}
        open={!!member}
        onClose={() => {
          if (!busy) setMember(null);
        }}
      >
        {confirmation ? (
          <>
            <Label size={14}>
              {confirmation === "remove"
                ? "Remove this member? Their past expenses and payments will remain in group history."
                : "Make this member the group owner? You will become a regular member."}
            </Label>
            <Button
              title={
                confirmation === "remove"
                  ? "Remove member"
                  : "Transfer ownership"
              }
              variant="danger"
              loading={busy}
              onPress={() => void manage(confirmation)}
            />
          </>
        ) : (
          <>
            <SettingsRow
              title={member?.role === "admin" ? "Make member" : "Make admin"}
              onPress={() =>
                void manage(member?.role === "admin" ? "member" : "admin")
              }
            />
            <SettingsRow
              title="Billing manager access"
              onPress={() => void manage("billing_manager")}
            />
            <SettingsRow
              title="Transfer ownership"
              onPress={() => setConfirmation("transfer")}
            />
            <SettingsRow
              title="Remove member"
              danger
              onPress={() => setConfirmation("remove")}
              last
            />
          </>
        )}
        {error && <ErrorBox message={error} />}
      </Sheet>
    </>
  );
}
