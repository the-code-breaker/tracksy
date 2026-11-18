import { useState } from "react";
import { View, Linking } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import {
  Pencil,
  MoreHorizontal,
  Copy,
  Repeat,
  Paperclip,
  Trash2,
  SlidersHorizontal,
  Clock3,
  Send,
} from "lucide-react-native";
import type { Expense, Currency } from "@tracksy/domain";
import { formatMoney } from "@tracksy/finance";
import { supabase, rpc } from "../lib/supabase";
import { useGroup, isPremium } from "../lib/data";
import { useAuth } from "../lib/auth";
import { pickReceipt } from "../lib/receipts";
import {
  Screen,
  Card,
  Label,
  Button,
  Field,
  Loading,
  ErrorBox,
  Notice,
  useColors,
} from "../components/ui";
import { Avatar, IconButton, CategoryIcon } from "../components/mobile";
import { Sheet } from "../components/sheet";
import { SettingsSection, SettingsRow } from "../components/settings";
type Share = { user_id: string; amount_minor: number };
type Version = {
  id: string;
  description: string;
  amount_minor: number;
  currency: Currency;
  category: string;
  expense_date: string;
  editor: string;
  actor_id: string;
  created_at: string;
  reversed_at: string | null;
  previous_id: string | null;
  participants: { user_id: string; name: string; amount_minor: number }[];
};
export default function ExpenseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    { session } = useAuth(),
    c = useColors(),
    cache = useQueryClient();
  const [panel, setPanel] = useState<"actions" | "delete" | "history" | null>(
      null,
    ),
    [body, setBody] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const q = useQuery({
    queryKey: ["expense", id],
    queryFn: async () => {
      const [e, s, p, comments, attachments] = await Promise.all([
        supabase.from("expenses").select("*").eq("id", id).single(),
        supabase
          .from("expense_splits")
          .select("user_id,amount_minor")
          .eq("expense_id", id),
        supabase
          .from("expense_payers")
          .select("user_id,amount_minor")
          .eq("expense_id", id),
        supabase
          .from("expense_comments")
          .select("*")
          .eq("expense_id", id)
          .order("created_at"),
        supabase
          .from("expense_attachments")
          .select("id,storage_path")
          .eq("expense_id", id),
      ]);
      for (const r of [e, s, p, comments, attachments])
        if (r.error) throw r.error;
      return {
        expense: e.data as Expense,
        shares: s.data as Share[],
        payers: p.data as Share[],
        comments: comments.data as {
          id: string;
          user_id: string;
          body: string;
          created_at: string;
        }[],
        attachments: attachments.data as { id: string; storage_path: string }[],
      };
    },
  });
  const group = useGroup(q.data?.expense.group_id || ""),
    versions = useQuery({
      queryKey: ["expense-versions", id],
      queryFn: () => rpc<Version[]>("expense_versions", { p_expense: id }),
      enabled: !!q.data,
    });
  const thread = useQuery({
    queryKey: ["expense-thread", id, versions.data?.map((v) => v.id).join(",")],
    enabled: !!versions.data?.length,
    queryFn: async () => {
      const ids = versions.data!.map((v) => v.id);
      const [comments, attachments] = await Promise.all([
        supabase
          .from("expense_comments")
          .select("*")
          .in("expense_id", ids)
          .order("created_at"),
        supabase
          .from("expense_attachments")
          .select("id,storage_path")
          .in("expense_id", ids),
      ]);
      for (const result of [comments, attachments])
        if (result.error) throw result.error;
      return {
        comments: comments.data as {
          id: string;
          user_id: string;
          body: string;
          created_at: string;
        }[],
        attachments: attachments.data as { id: string; storage_path: string }[],
      };
    },
  });
  const active =
      !!q.data && !q.data.expense.reversed_at && !group.data?.group.archived_at,
    premium = isPremium(group.data?.entitlement, group.data?.earlyAccess),
    latest = versions.data?.find((v) => !v.reversed_at),
    person = (uid: string) =>
      group.data?.members.find((m) => m.user_id === uid)?.display_name ||
      (uid === session?.user.id ? "You" : "Former member");
  const edit = () =>
    router.push({
      pathname: "/expense/new",
      params: { group: q.data!.expense.group_id, edit: id },
    });
  async function act(
    task: () => Promise<unknown>,
    message = "",
    close = false,
  ) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await task();
      await cache.invalidateQueries();
      if (message) setNotice(message);
      if (close) setPanel(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function paidRows(rows: Share[]) {
    return rows.map((r, i) => (
      <View
        key={r.user_id}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingVertical: 11,
          borderTopWidth: i ? 1 : 0,
          borderColor: c.border,
        }}
      >
        <Avatar name={person(r.user_id)} size={33} />
        <View style={{ flex: 1 }}>
          <Label size={14}>
            {person(r.user_id)}
            {r.user_id === session?.user.id ? " (you)" : ""}
          </Label>
        </View>
        <Label size={14} weight="600">
          {formatMoney(r.amount_minor, q.data!.expense.currency)}
        </Label>
      </View>
    ));
  }
  const tool = (path: "/rules" | "/recurring") => {
    setPanel(null);
    router.push({
      pathname: premium ? path : "/plus",
      params: { group: q.data!.expense.group_id, expense: id },
    });
  };
  return (
    <Screen
      title="Expense"
      back
      action={
        <View style={{ flexDirection: "row" }}>
          <IconButton
            label="More expense actions"
            onPress={() => {
              setPanel("actions");
              setError("");
            }}
          >
            <MoreHorizontal size={23} color={c.text} />
          </IconButton>
        </View>
      }
    >
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorBox message={q.error.message} />
      ) : (
        q.data && (
          <>
            <View style={{ alignItems: "center", gap: 7, paddingVertical: 14 }}>
              <CategoryIcon category={q.data.expense.category} size={54} />
              <Label size={22} weight="600" style={{ textAlign: "center" }}>
                {q.data.expense.description}
              </Label>
              <Label
                size={37}
                weight="700"
                style={{ fontVariant: ["tabular-nums"] }}
              >
                {formatMoney(
                  q.data.expense.amount_minor,
                  q.data.expense.currency,
                )}
              </Label>
              <Label size={12} muted>
                {new Date(
                  q.data.expense.expense_date + "T12:00:00",
                ).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}{" "}
                · {q.data.expense.category}
              </Label>
              {q.data.expense.notes && (
                <Label size={13} muted style={{ textAlign: "center" }}>
                  {q.data.expense.notes}
                </Label>
              )}
            </View>
            {!active && q.data.expense.reversed_at && (
              <Notice>
                {latest
                  ? "This is an earlier version."
                  : "This expense was deleted. Its history is preserved."}
              </Notice>
            )}
            {latest && latest.id !== id && (
              <Button
                title="View current expense"
                onPress={() => router.replace(`/expense/${latest.id}`)}
              />
            )}
            <SettingsSection title="Paid by">
              <View style={{ paddingHorizontal: 15 }}>
                {paidRows(q.data.payers)}
              </View>
            </SettingsSection>
            <SettingsSection
              title={`Split between · ${q.data.shares.length} ${q.data.shares.length === 1 ? "person" : "people"}`}
            >
              <View style={{ paddingHorizontal: 15 }}>
                {paidRows(q.data.shares)}
              </View>
            </SettingsSection>
            {active && (
              <Button
                title="Edit expense"
                icon={<Pencil size={17} color="#fff" />}
                onPress={edit}
              />
            )}
            <SettingsSection title="Details">
              <SettingsRow
                title="Edit history"
                subtitle={
                  versions.data && versions.data.length > 1
                    ? `${versions.data.length} saved versions`
                    : "Original expense"
                }
                icon={<Clock3 size={19} color={c.muted} />}
                onPress={() => setPanel("history")}
              />
              {(thread.data?.attachments || q.data.attachments).map((a, i) => (
                <SettingsRow
                  key={a.id}
                  title={`Receipt ${i + 1}`}
                  icon={<Paperclip size={19} color={c.muted} />}
                  onPress={() =>
                    void act(async () => {
                      const r = await supabase.storage
                        .from("receipts")
                        .createSignedUrl(a.storage_path, 60);
                      if (r.error) throw r.error;
                      await Linking.openURL(r.data.signedUrl);
                    })
                  }
                />
              ))}
              {active && (
                <SettingsRow
                  title="Attach receipt"
                  icon={<Paperclip size={19} color={c.muted} />}
                  onPress={() =>
                    void act(() =>
                      pickReceipt(
                        q.data!.expense.group_id,
                        id,
                        session!.user.id,
                      ),
                    )
                  }
                  last
                />
              )}
            </SettingsSection>
            <SettingsSection title="Comments">
              <View style={{ padding: 15, gap: 14 }}>
                {thread.error && <ErrorBox message={thread.error.message} />}
                {(thread.data?.comments || q.data.comments).length ? (
                  (thread.data?.comments || q.data.comments).map((comment) => (
                    <View key={comment.id} style={{ gap: 5 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 7,
                        }}
                      >
                        <Avatar name={person(comment.user_id)} size={25} />
                        <Label size={12} weight="600">
                          {person(comment.user_id)}
                        </Label>
                        <Label size={10} muted>
                          {new Date(comment.created_at).toLocaleDateString()}
                        </Label>
                      </View>
                      <Label size={14}>{comment.body}</Label>
                    </View>
                  ))
                ) : (
                  <Label muted size={13}>
                    No comments yet.
                  </Label>
                )}
                <Field
                  label="Add a comment"
                  placeholder="Write a comment"
                  value={body}
                  onChangeText={setBody}
                  multiline
                  maxLength={2000}
                />
                <Button
                  title="Send"
                  icon={<Send size={16} color="#fff" />}
                  loading={busy}
                  disabled={!body.trim()}
                  onPress={() =>
                    void act(async () => {
                      await rpc("add_comment", {
                        p_expense: id,
                        p_body: body.trim(),
                      });
                      setBody("");
                    })
                  }
                />
              </View>
            </SettingsSection>
          </>
        )
      )}
      {notice && <Notice>{notice}</Notice>}
      {error && !panel && <ErrorBox message={error} />}
      <Sheet
        title={
          panel === "actions"
            ? "Expense options"
            : panel === "delete"
              ? "Delete expense"
              : "Edit history"
        }
        open={!!panel}
        onClose={() => {
          if (!busy) {
            setPanel(null);
            setError("");
          }
        }}
      >
        {panel === "actions" && (
          <>
            {active && (
              <SettingsRow
                title="Edit expense"
                icon={<Pencil size={19} color={c.muted} />}
                onPress={() => {
                  setPanel(null);
                  edit();
                }}
              />
            )}
            <SettingsRow
              title="Duplicate expense"
              icon={<Copy size={19} color={c.muted} />}
              onPress={() => {
                setPanel(null);
                router.push({
                  pathname: "/expense/new",
                  params: { group: q.data!.expense.group_id, duplicate: id },
                });
              }}
            />
            <SettingsRow
              title="Save split rule"
              icon={<SlidersHorizontal size={19} color={c.muted} />}
              value={premium ? undefined : "Group Plus"}
              onPress={() => tool("/rules")}
            />
            <SettingsRow
              title="Make recurring"
              icon={<Repeat size={19} color={c.muted} />}
              value={premium ? undefined : "Group Plus"}
              onPress={() => tool("/recurring")}
            />
            {active && (
              <SettingsRow
                title="Delete expense"
                icon={<Trash2 size={19} color={c.danger} />}
                danger
                onPress={() => setPanel("delete")}
                last
              />
            )}
          </>
        )}
        {panel === "delete" && (
          <>
            <Label size={14}>
              Delete this expense from the group balance? Everyone can see who
              deleted it in activity, and the original record remains in
              history.
            </Label>
            <Button
              title="Delete expense"
              variant="danger"
              loading={busy}
              onPress={() =>
                void act(
                  () =>
                    rpc("reverse_expense", {
                      p_expense: id,
                      p_version: q.data!.expense.version,
                      p_key: Crypto.randomUUID(),
                    }),
                  "Expense deleted.",
                  true,
                )
              }
            />
          </>
        )}
        {panel === "history" &&
          (versions.isPending ? (
            <Loading />
          ) : versions.error ? (
            <ErrorBox message={versions.error.message} />
          ) : (
            versions.data?.map((v, i) => (
              <Card key={v.id} style={{ gap: 8 }}>
                <Label weight="600" size={14}>
                  {v.editor} {v.previous_id ? "updated" : "added"} this expense
                </Label>
                <Label size={11} muted>
                  {new Date(v.created_at).toLocaleString()}
                </Label>
                <Label size={15} weight="600">
                  {v.description} · {formatMoney(v.amount_minor, v.currency)}
                </Label>
                <Label size={12} muted>
                  {v.participants.map((p) => p.name).join(", ")}
                </Label>
                {versions.data?.[i + 1] && (
                  <Label size={12} muted>
                    Previous total:{" "}
                    {formatMoney(
                      versions.data[i + 1]!.amount_minor,
                      versions.data[i + 1]!.currency,
                    )}
                  </Label>
                )}
              </Card>
            ))
          ))}
        {error && <ErrorBox message={error} />}
      </Sheet>
    </Screen>
  );
}
