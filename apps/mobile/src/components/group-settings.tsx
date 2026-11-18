import { useState } from "react";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Pencil,
  Repeat,
  Download,
  Wallet,
  Archive,
  ArchiveRestore,
  Trash2,
  LogOut,
  SlidersHorizontal,
} from "lucide-react-native";
import { useGroup, isPremium } from "../lib/data";
import { useAuth } from "../lib/auth";
import { useSetting } from "../lib/use-setting";
import { rpc } from "../lib/supabase";
import { parseMoney } from "@tracksy/finance";
import { localDate } from "../lib/dates";
import { exportReport } from "../lib/reports";
import { Sheet } from "./sheet";
import { SettingsSection, SettingsRow, ToggleRow } from "./settings";
import { Label, Field, Button, ErrorBox, Notice, useColors } from "./ui";
export function GroupSettings({
  id,
  exportCsv,
}: {
  id: string;
  exportCsv: () => Promise<void>;
}) {
  const q = useGroup(id),
    { session } = useAuth(),
    cache = useQueryClient(),
    c = useColors(),
    [panel, setPanel] = useState<
      "edit" | "budget" | "archive" | "restore" | "delete" | "leave" | null
    >(null),
    [name, setName] = useState(""),
    [description, setDescription] = useState(""),
    [budget, setBudget] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const mine = q.data?.members.find((m) => m.user_id === session?.user.id),
    owner = mine?.role === "owner",
    manager = owner || mine?.role === "admin",
    premium = isPremium(q.data?.entitlement, q.data?.earlyAccess),
    closed = !!q.data?.group.archived_at;
  const simplify = useSetting(
    `${id}:simplify`,
    q.data?.group.simplified_settlements ?? false,
    {
      optimistic(value) {
        void cache.cancelQueries(
          { queryKey: ["group", id] },
          { revert: false, silent: true },
        );
        cache.setQueryData(["group", id], (old: any) =>
          old
            ? { ...old, group: { ...old.group, simplified_settlements: value } }
            : old,
        );
      },
      async save(value) {
        await rpc("set_settlement_simplification", {
          p_group: id,
          p_enabled: value,
        });
        void cache.invalidateQueries({ queryKey: ["settlement-plan", id] });
      },
      failed(e) {
        setError((e as Error).message);
      },
    },
  );
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
      void cache.invalidateQueries();
      if (message) setNotice(message);
      if (close) setPanel(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const plus = () => router.push({ pathname: "/plus", params: { group: id } }),
    icon = (Icon: typeof Pencil) => <Icon size={19} color={c.muted} />;
  return (
    <>
      <SettingsSection title="Group">
        {manager && (
          <SettingsRow
            title="Edit group details"
            icon={icon(Pencil)}
            onPress={() => {
              setName(q.data!.group.name);
              setDescription(q.data!.group.description);
              setPanel("edit");
            }}
          />
        )}
        <ToggleRow
          title="Simplify balances"
          subtitle="Show fewer payments without changing anyone’s net balance."
          value={simplify.value}
          pending={simplify.pending}
          disabled={!manager || closed}
          onChange={simplify.choose}
          last
        />
      </SettingsSection>
      <SettingsSection title="Tools">
        {q.data?.earlyAccess && (
          <SettingsRow
            title="Group Plus · Early access"
            subtitle="Free for everyone during early access."
            onPress={plus}
          />
        )}
        <SettingsRow
          title="Split rules"
          icon={icon(SlidersHorizontal)}
          value={premium ? undefined : "Group Plus"}
          onPress={() =>
            premium
              ? router.push({ pathname: "/rules", params: { group: id } })
              : plus()
          }
        />
        <SettingsRow
          title="Recurring expenses"
          icon={icon(Repeat)}
          value={premium ? undefined : "Group Plus"}
          onPress={() =>
            premium
              ? router.push({ pathname: "/recurring", params: { group: id } })
              : plus()
          }
        />
        {manager && (
          <SettingsRow
            title="Monthly budget"
            icon={icon(Wallet)}
            value={premium ? undefined : "Group Plus"}
            onPress={() => (premium ? setPanel("budget") : plus())}
          />
        )}
        <SettingsRow
          title="Export CSV"
          icon={icon(Download)}
          value={premium ? undefined : "Group Plus"}
          onPress={() =>
            premium ? void act(exportCsv, "Export is ready.") : plus()
          }
        />
        <SettingsRow
          title="Export PDF"
          icon={icon(Download)}
          value={premium ? undefined : "Group Plus"}
          onPress={() =>
            premium
              ? void act(() =>
                  exportReport(
                    id,
                    q.data!.group.name,
                    `${new Date().getFullYear()}-01-01`,
                    `${new Date().getFullYear()}-12-31`,
                  ),
                )
              : plus()
          }
          last
        />
      </SettingsSection>
      <SettingsSection title="">
        {owner ? (
          <>
            <SettingsRow
              title={closed ? "Restore group" : "Archive group"}
              icon={icon(closed ? ArchiveRestore : Archive)}
              onPress={() => {
                setError("");
                setPanel(closed ? "restore" : "archive");
              }}
            />
            <SettingsRow
              title="Delete group"
              icon={icon(Trash2)}
              danger
              onPress={() => {
                setError("");
                setPanel("delete");
              }}
              last
            />
          </>
        ) : (
          <SettingsRow
            title="Leave group"
            icon={icon(LogOut)}
            danger
            onPress={() => setPanel("leave")}
            last
          />
        )}
      </SettingsSection>
      {error && !panel && <ErrorBox message={error} />}
      {notice && <Notice>{notice}</Notice>}
      <Sheet
        title={
          panel === "edit"
            ? "Edit group"
            : panel === "budget"
              ? "Monthly budget"
              : panel === "archive"
                ? "Archive group"
                : panel === "restore"
                  ? "Restore group"
                  : panel === "delete"
                    ? "Delete group"
                    : "Leave group"
        }
        open={!!panel}
        onClose={() => {
          if (!busy) {
            setPanel(null);
            setError("");
          }
        }}
      >
        {panel === "edit" && (
          <>
            <Field
              label="Group name"
              value={name}
              onChangeText={setName}
              maxLength={80}
            />
            <Field
              label="Description"
              value={description}
              onChangeText={setDescription}
              multiline
              maxLength={500}
            />
            <Button
              title="Save"
              loading={busy}
              disabled={!name.trim() || closed}
              onPress={() =>
                void act(
                  () =>
                    rpc("update_group", {
                      p_group: id,
                      p_name: name.trim(),
                      p_description: description,
                    }),
                  "Group updated.",
                  true,
                )
              }
            />
          </>
        )}
        {panel === "budget" && (
          <>
            <Label size={13} muted>
              {q.data?.group.currency} ·{" "}
              {new Date().toLocaleDateString(undefined, {
                month: "long",
                year: "numeric",
              })}
            </Label>
            <Field
              label="Budget amount"
              value={budget}
              onChangeText={setBudget}
              keyboardType="decimal-pad"
            />
            <Button
              title="Save budget"
              loading={busy}
              disabled={!budget || closed}
              onPress={() =>
                void act(
                  () =>
                    rpc("set_budget", {
                      p_group: id,
                      p_month: localDate().slice(0, 7) + "-01",
                      p_currency: q.data!.group.currency,
                      p_amount: parseMoney(budget, q.data!.group.currency),
                    }),
                  "Budget saved.",
                  true,
                )
              }
            />
          </>
        )}
        {panel === "archive" && (
          <>
            <Label size={14}>
              Archive this group? Its expenses, payments and activity history
              will remain available. No new expenses can be added.
            </Label>
            <Button
              title="Archive"
              variant="danger"
              loading={busy}
              onPress={() =>
                void act(
                  () => rpc("archive_group", { p_group: id }),
                  "Group archived.",
                  true,
                )
              }
            />
          </>
        )}
        {panel === "restore" && (
          <>
            <Label size={14}>
              Restore this group to your active groups? Its members, expenses,
              balances and history stay the same.
            </Label>
            <Button
              title="Restore group"
              loading={busy}
              onPress={() =>
                void act(
                  () => rpc("restore_group", { p_group: id }),
                  "Group restored.",
                  true,
                )
              }
            />
          </>
        )}
        {panel === "delete" && (
          <>
            <Label size={14}>
              Delete {q.data?.group.name} for everyone? This removes it from all
              members’ lists, disables invitations and stops recurring expenses.
              This action cannot be undone in the app.
            </Label>
            <Label size={13} muted>
              Every member’s balances must be settled and pending payments
              resolved first. Shared financial and audit records are retained;
              deletion does not erase them.
            </Label>
            <Button
              title="Delete group for everyone"
              variant="danger"
              loading={busy}
              onPress={() =>
                void act(async () => {
                  await rpc("delete_group", { p_group: id });
                  cache.removeQueries({ queryKey: ["group", id] });
                  cache.setQueryData(["groups", session?.user.id], (old: any) =>
                    old?.filter((g: any) => g.id !== id),
                  );
                  cache.setQueryData(
                    ["overview", session?.user.id],
                    (old: any) =>
                      old
                        ? {
                            ...old,
                            groups: old.groups.filter((g: any) => g.id !== id),
                            balances: old.balances.filter(
                              (b: any) => b.group_id !== id,
                            ),
                          }
                        : old,
                  );
                  router.replace("/(tabs)/groups");
                })
              }
            />
          </>
        )}
        {panel === "leave" && (
          <>
            <Label size={14}>
              Leave this group? Settle your outstanding balance first. Past
              expenses and payments remain in group history.
            </Label>
            <Button
              title="Leave group"
              variant="danger"
              loading={busy}
              onPress={() =>
                void act(async () => {
                  await rpc("manage_member", {
                    p_group: id,
                    p_user: session!.user.id,
                    p_action: "leave",
                  });
                  router.replace("/(tabs)/groups");
                })
              }
            />
          </>
        )}
        {error && <ErrorBox message={error} />}
      </Sheet>
    </>
  );
}
