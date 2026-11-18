import { useEffect, useRef, useState } from "react";
import { View, Pressable, TextInput, ScrollView, Keyboard } from "react-native";
import { Sheet } from "../../src/components/sheet";
import { SettingsRow } from "../../src/components/settings";
import { Avatar, CategoryIcon } from "../../src/components/mobile";
import { SelectField } from "../../src/components/select-field";
import { DateField } from "../../src/components/date-field";
import { localDate } from "../../src/lib/dates";
import { router, useLocalSearchParams } from "expo-router";
import * as Crypto from "expo-crypto";
import { useQueryClient } from "@tanstack/react-query";
import { useGroups, useGroup, isPremium } from "../../src/lib/data";
import { useAuth } from "../../src/lib/auth";
import { rpc, supabase } from "../../src/lib/supabase";
import { saveDraft, removeDraft } from "../../src/lib/drafts";
import { readCached, writeCached } from "../../src/lib/cache-storage";
import {
  ItemizedEditor,
  buildItems,
  type ItemDraft,
} from "../../src/components/itemized";
import {
  parseMoney,
  split,
  formatMoney,
  itemizedShares,
} from "@tracksy/finance";
import { expenseSchema } from "@tracksy/validation";
import { categories } from "@tracksy/config";
import type { Currency, ExpenseInput, SplitMethod } from "@tracksy/domain";
import {
  Screen,
  Card,
  Label,
  Empty,
  TextLink,
  Button,
  Field,
  Chips,
  ErrorBox,
  Notice,
  Loading,
  s,
  useColors,
} from "../../src/components/ui";
export default function NewExpense() {
  const params = useLocalSearchParams<{
    group?: string;
    edit?: string;
    duplicate?: string;
    rule?: string;
  }>();
  const groups = useGroups();
  const [groupId, setGroupId] = useState(params.group || "");
  const q = useGroup(groupId);
  const { session } = useAuth();
  const c = useColors();
  const cache = useQueryClient();
  const [panel, setPanel] = useState<"payer" | "split" | "details" | null>(
    null,
  );
  const amountInput = useRef<TextInput>(null);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>("INR");
  const [method, setMethod] = useState<SplitMethod>("equal");
  const [category, setCategory] = useState("Food & drinks");
  const [date, setDate] = useState(localDate());
  const [notes, setNotes] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [paid, setPaid] = useState<Record<string, string>>({});
  const [multi, setMulti] = useState(false);
  const [payer, setPayer] = useState(session?.user.id || "");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState<number>();
  const key = useRef(Crypto.randomUUID());
  const init = useRef("");
  const hydrated = useRef("");
  const [hydrating, setHydrating] = useState(
    !!(params.edit || params.duplicate || params.rule),
  );
  const [loadedOriginal, setLoadedOriginal] = useState(false);
  const [originalPeople, setOriginalPeople] = useState<string[]>([]);
  const [items, setItems] = useState<ItemDraft[]>([]);
  useEffect(() => {
    if (groupId || !groups.data?.length || !session) return;
    let active = true;
    void readCached(`tracksy.last-group.${session.user.id}`)
      .catch(() => null)
      .then((last) => {
        if (active)
          setGroupId(
            groups.data!.find((g) => g.id === last && !g.archived_at)?.id ||
              groups.data!.find((g) => !g.archived_at)?.id ||
              "",
          );
      });
    return () => {
      active = false;
    };
  }, [groups.data, groupId, session?.user.id]);
  useEffect(() => {
    if (!q.data || init.current === groupId) return;
    init.current = groupId;
    if (params.edit || params.duplicate || params.rule) {
      setSelected({});
      return;
    }
    setCurrency(q.data.group.currency);
    setSelected(
      Object.fromEntries(
        q.data.members
          .filter(
            (m) =>
              m.active || (!!params.edit && originalPeople.includes(m.user_id)),
          )
          .map((m) => [m.user_id, true]),
      ),
    );
  }, [q.data, groupId]);
  useEffect(() => {
    const id = params.edit || params.duplicate;
    if (!id || hydrated.current === id || !q.data) return;
    hydrated.current = id;
    setHydrating(true);
    setLoadedOriginal(false);
    void (async () => {
      const [e, shares, payers, originalItems] = await Promise.all([
        supabase
          .from("expenses")
          .select("*")
          .eq("id", id)
          .eq("group_id", groupId)
          .single(),
        supabase.from("expense_splits").select("*").eq("expense_id", id),
        supabase.from("expense_payers").select("*").eq("expense_id", id),
        supabase.from("expense_items").select("*").eq("expense_id", id),
      ]);
      if (e.error || shares.error || payers.error || originalItems.error) {
        setError("Could not load the original expense");
        setHydrating(false);
        return;
      }
      const row = e.data;
      setItems(
        originalItems.data.map((item) => ({
          description: item.description,
          amount: (
            item.amount_minor /
            10 ** (row.currency === "JPY" ? 0 : row.currency === "KWD" ? 3 : 2)
          ).toFixed(
            row.currency === "JPY" ? 0 : row.currency === "KWD" ? 3 : 2,
          ),
          quantities: Object.fromEntries(
            (item.allocations as { user_id: string; value: number }[]).map(
              (a) => [a.user_id, String(a.value)],
            ),
          ),
        })),
      );
      setDescription(row.description);
      setCurrency(row.currency);
      setAmount(
        (
          row.amount_minor /
          10 ** (row.currency === "JPY" ? 0 : row.currency === "KWD" ? 3 : 2)
        ).toFixed(row.currency === "JPY" ? 0 : row.currency === "KWD" ? 3 : 2),
      );
      setCategory(row.category);
      setMethod(row.split_method);
      setDate(row.expense_date);
      setNotes(row.notes);
      setVersion(row.version);
      setSelected(
        Object.fromEntries(shares.data.map((v) => [v.user_id, true])),
      );
      setOriginalPeople([
        ...new Set([
          ...shares.data.map((v) => v.user_id),
          ...payers.data.map((v) => v.user_id),
        ]),
      ]);
      setValues(
        Object.fromEntries(
          shares.data.map((v) => [
            v.user_id,
            row.split_method === "percentage"
              ? String(v.input_value / 100)
              : row.split_method === "weighted"
                ? String(v.input_value)
                : (
                    v.amount_minor /
                    10 **
                      (row.currency === "JPY"
                        ? 0
                        : row.currency === "KWD"
                          ? 3
                          : 2)
                  ).toFixed(
                    row.currency === "JPY" ? 0 : row.currency === "KWD" ? 3 : 2,
                  ),
          ]),
        ),
      );
      setMulti(payers.data.length > 1);
      setPayer(payers.data[0]?.user_id || "");
      setPaid(
        Object.fromEntries(
          payers.data.map((v) => [
            v.user_id,
            (
              v.amount_minor /
              10 **
                (row.currency === "JPY" ? 0 : row.currency === "KWD" ? 3 : 2)
            ).toFixed(
              row.currency === "JPY" ? 0 : row.currency === "KWD" ? 3 : 2,
            ),
          ]),
        ),
      );
      setLoadedOriginal(true);
      setHydrating(false);
    })().catch((e) => {
      setError((e as Error).message);
      setHydrating(false);
    });
  }, [q.data, groupId, params.edit, params.duplicate]);
  const [ruleLoaded, setRuleLoaded] = useState("");
  useEffect(() => {
    if (!params.rule || !q.data || ruleLoaded === params.rule) return;
    setRuleLoaded(params.rule);
    void rpc<{
      name: string;
      group_id: string;
      currency: Currency;
      split_method: SplitMethod;
      participants: { user_id: string; value: number }[];
    }>("get_split_rule", { p_id: params.rule })
      .then((rule) => {
        if (rule.group_id !== groupId)
          throw new Error("Rule belongs to a different group");
        setCurrency(rule.currency);
        setMethod(rule.split_method);
        setSelected(
          Object.fromEntries(rule.participants.map((p) => [p.user_id, true])),
        );
        setValues(
          Object.fromEntries(
            rule.participants.map((p) => [
              p.user_id,
              rule.split_method === "percentage"
                ? String(p.value / 100)
                : rule.split_method === "weighted"
                  ? String(p.value)
                  : (
                      p.value /
                      10 **
                        (rule.currency === "JPY"
                          ? 0
                          : rule.currency === "KWD"
                            ? 3
                            : 2)
                    ).toFixed(
                      rule.currency === "JPY"
                        ? 0
                        : rule.currency === "KWD"
                          ? 3
                          : 2,
                    ),
            ]),
          ),
        );
        setNotice(
          `Rule “${rule.name}” loaded. Review all participants and amounts before saving.`,
        );
        setLoadedOriginal(true);
        setHydrating(false);
      })
      .catch((e) => {
        setError((e as Error).message);
        setHydrating(false);
      });
  }, [params.rule, q.data, ruleLoaded]);
  function payload(): ExpenseInput {
    const total = parseMoney(amount, currency);
    let participants = (q.data?.members ?? [])
      .filter(
        (m) =>
          (m.active || (!!params.edit && originalPeople.includes(m.user_id))) &&
          selected[m.user_id],
      )
      .map((m) => ({
        user_id: m.user_id,
        value:
          method === "equal"
            ? 1
            : method === "percentage"
              ? parseMoney(values[m.user_id] || "0", "USD")
              : method === "weighted"
                ? Number(values[m.user_id] || 0)
                : parseMoney(values[m.user_id] || "0", currency),
      }));
    const lines =
      method === "itemized" ? buildItems(items, currency) : undefined;
    if (lines)
      participants = Object.entries(itemizedShares(total, lines)).map(
        ([user_id, value]) => ({ user_id, value }),
      );
    const payers = multi
      ? (q.data?.members ?? [])
          .filter(
            (m) =>
              (m.active ||
                (!!params.edit && originalPeople.includes(m.user_id))) &&
              paid[m.user_id] &&
              paid[m.user_id] !== "0",
          )
          .map((m) => ({
            user_id: m.user_id,
            amount_minor: parseMoney(paid[m.user_id]!, currency),
          }))
      : [{ user_id: payer, amount_minor: total }];
    split(total, method, participants);
    return expenseSchema.parse({
      group_id: groupId,
      description,
      amount_minor: total,
      currency,
      category,
      split_method: method,
      participants,
      payers,
      items: lines,
      expense_date: date,
      notes,
      idempotency_key: key.current,
      ...(params.edit
        ? { replaces_id: params.edit, expected_version: version }
        : {}),
    });
  }
  async function submit(draft = false) {
    if (busy) return;
    Keyboard.dismiss();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      if (!session) throw new Error("Sign in first");
      const p = payload();
      if (draft) {
        await saveDraft(session.user.id, p);
        setNotice(
          "Saved on this device. This draft does not affect group balances.",
        );
      } else {
        const savedId = await rpc<string>("create_expense", { p });
        void writeCached(
          `tracksy.last-group.${session.user.id}`,
          groupId,
        ).catch(() => {});
        await removeDraft(key.current).catch(() => {});
        void cache.invalidateQueries();
        router.replace(
          params.edit ? `/expense/${savedId}` : `/group/${groupId}`,
        );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  let preview: Record<string, number> = {};
  try {
    const p = payload();
    preview = split(p.amount_minor, p.split_method, p.participants);
  } catch {}
  const splitLabels: Record<SplitMethod, string> = {
    equal: "Equally",
    exact: "Amounts",
    percentage: "Percent",
    weighted: "Shares",
    custom: "Custom",
    itemized: "By item",
  };
  function changeMethod(next: SplitMethod) {
    if (next === method) return;
    const people = Object.keys(selected).filter((id) => selected[id]);
    if (next === "exact" || next === "custom") {
      try {
        const shares = Object.keys(preview).length
          ? preview
          : split(
              parseMoney(amount, currency),
              "equal",
              people.map((user_id) => ({ user_id, value: 1 })),
            );
        setValues(
          Object.fromEntries(
            Object.entries(shares).map(([id, minor]) => [
              id,
              (
                minor /
                10 ** (currency === "JPY" ? 0 : currency === "KWD" ? 3 : 2)
              ).toFixed(currency === "JPY" ? 0 : currency === "KWD" ? 3 : 2),
            ]),
          ),
        );
      } catch {
        setValues({});
      }
    } else if (next === "percentage") {
      try {
        setValues(
          Object.fromEntries(
            Object.entries(
              split(
                10000,
                "equal",
                people.map((user_id) => ({ user_id, value: 1 })),
              ),
            ).map(([id, value]) => [id, String(value / 100)]),
          ),
        );
      } catch {
        setValues({});
      }
    } else if (next === "weighted")
      setValues(Object.fromEntries(people.map((id) => [id, "1"])));
    setMethod(next);
  }
  return (
    <Screen
      title={params.edit ? "Edit expense" : "Add expense"}
      back
      footer={
        !!groups.data?.length &&
        !groups.error &&
        !hydrating &&
        (!(params.edit || params.duplicate || params.rule) ||
          loadedOriginal) && (
          <View style={{ gap: 8 }}>
            {error && <ErrorBox message={error} />}
            <Button
              title={params.edit ? "Save changes" : "Save expense"}
              loading={busy}
              disabled={
                !description.trim() ||
                !amount ||
                !q.data ||
                !!q.data?.group.archived_at
              }
              onPress={() => void submit()}
            />
          </View>
        )
      }
    >
      {groups.isPending ? (
        <Loading />
      ) : groups.error ? (
        <ErrorBox message={groups.error.message} />
      ) : !groups.data?.length ? (
        <Empty
          title="Start with your people"
          body="Create or join a group before adding your first shared expense."
          action={
            <Button
              title="Create group"
              onPress={() => router.replace("/group/new")}
            />
          }
        />
      ) : hydrating ? (
        <Loading />
      ) : (params.edit || params.duplicate || params.rule) &&
        !loadedOriginal ? (
        <ErrorBox
          message={
            error || "Could not load this expense. Go back and try again."
          }
        />
      ) : (
        <>
          <SelectField
            label="Group"
            value={groupId}
            options={groups.data
              .filter((g) => !g.archived_at)
              .map((g) => ({ value: g.id, label: `${g.icon} ${g.name}` }))}
            disabled={!!params.edit || !!params.duplicate || !!params.rule}
            onChange={setGroupId}
          />
          <Field
            label="What was it for?"
            placeholder="Dinner, groceries, train tickets…"
            value={description}
            onChangeText={setDescription}
            maxLength={160}
            returnKeyType="next"
            onSubmitEditing={() => amountInput.current?.focus()}
          />
          <Card style={{ padding: 17, gap: 7 }}>
            <Label size={12} muted>
              Amount
            </Label>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              <Label size={27} style={{ color: c.muted }}>
                {
                  (
                    {
                      INR: "₹",
                      USD: "$",
                      EUR: "€",
                      GBP: "£",
                      JPY: "¥",
                      KWD: "KD",
                    } as const
                  )[currency]
                }
              </Label>
              <TextInput
                ref={amountInput}
                returnKeyType="done"
                accessibilityLabel="Total amount"
                placeholder="0.00"
                placeholderTextColor={c.muted}
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 35,
                  lineHeight: 44,
                  includeFontPadding: false,
                  textAlignVertical: "center",
                  fontWeight: "700",
                  color: c.text,
                  paddingVertical: 0,
                  fontVariant: ["tabular-nums"],
                }}
              />
              <View style={{ width: 92, flexShrink: 0 }}>
                <SelectField
                  label="Currency"
                  hideLabel
                  compact
                  value={currency}
                  options={(
                    ["INR", "USD", "EUR", "GBP", "JPY", "KWD"] as Currency[]
                  ).map((value) => ({ value, label: value }))}
                  onChange={setCurrency}
                />
              </View>
            </View>
          </Card>
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <View style={{ flexDirection: "row" }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Change payer"
                onPress={() => {
                  Keyboard.dismiss();
                  setPanel("payer");
                }}
                style={({ pressed }) => ({
                  flex: 1,
                  padding: 16,
                  minHeight: 80,
                  gap: 5,
                  backgroundColor: pressed ? c.tint : c.surface,
                })}
              >
                <Label size={12} muted>
                  Paid by
                </Label>
                <Label size={16} weight="600" style={{ color: c.primary }}>
                  {multi
                    ? "Multiple people"
                    : payer === session?.user.id
                      ? "You"
                      : q.data?.members.find((m) => m.user_id === payer)
                          ?.display_name || "Choose payer"}{" "}
                  ›
                </Label>
              </Pressable>
              <View style={{ width: 1, backgroundColor: c.border }} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Change split"
                onPress={() => {
                  Keyboard.dismiss();
                  setPanel("split");
                }}
                style={({ pressed }) => ({
                  flex: 1,
                  padding: 16,
                  minHeight: 80,
                  gap: 5,
                  backgroundColor: pressed ? c.tint : c.surface,
                })}
              >
                <Label size={12} muted>
                  Split
                </Label>
                <Label size={16} weight="600" style={{ color: c.primary }}>
                  {method === "equal" ? "Equally" : splitLabels[method]} ›
                </Label>
              </Pressable>
            </View>
          </Card>
          {q.isPending ? (
            <Loading />
          ) : q.error ? (
            <ErrorBox message={q.error.message} />
          ) : (
            <Label muted size={13} style={{ textAlign: "center" }}>
              {Object.keys(preview).length
                ? method === "equal"
                  ? Object.keys(preview).length +
                    " people · about " +
                    formatMoney(Object.values(preview)[0]!, currency) +
                    " each"
                  : Object.keys(preview).length + " people in this split"
                : Object.values(selected).filter(Boolean).length +
                  " people selected"}
            </Label>
          )}
          <SettingsRow
            title="Details"
            subtitle={
              category +
              " · " +
              (date === localDate() ? "Today" : date) +
              (notes ? " · Note added" : "")
            }
            onPress={() => {
              Keyboard.dismiss();
              setPanel("details");
            }}
            last
          />
          {notice && <Notice>{notice}</Notice>}
          <Sheet
            title={
              panel === "payer"
                ? "Who paid?"
                : panel === "split"
                  ? "Split expense"
                  : "Expense details"
            }
            open={!!panel}
            onClose={() => {
              Keyboard.dismiss();
              setPanel(null);
            }}
          >
            {panel === "payer" && (
              <>
                <TextLink
                  title={multi ? "Use one payer" : "Multiple payers"}
                  onPress={() => {
                    if (!multi && amount) setPaid({ [payer]: amount });
                    setMulti(!multi);
                  }}
                />
                {(q.data?.members ?? [])
                  .filter(
                    (m) =>
                      m.active ||
                      (!!params.edit && originalPeople.includes(m.user_id)),
                  )
                  .map((m) =>
                    multi ? (
                      <View
                        key={m.user_id}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 12,
                        }}
                      >
                        <Avatar name={m.display_name} />
                        <Label size={14} style={{ flex: 1 }}>
                          {m.user_id === session?.user.id
                            ? "You"
                            : m.display_name}
                        </Label>
                        <View style={{ width: 130 }}>
                          <Field
                            label={
                              "Paid by " +
                              m.display_name +
                              " (" +
                              currency +
                              ")"
                            }
                            hideLabel
                            keyboardType="decimal-pad"
                            placeholder="0.00"
                            value={paid[m.user_id] || ""}
                            onChangeText={(v) =>
                              setPaid((p) => ({ ...p, [m.user_id]: v }))
                            }
                          />
                        </View>
                      </View>
                    ) : (
                      <SettingsRow
                        key={m.user_id}
                        title={
                          m.user_id === session?.user.id
                            ? "You (" + m.display_name + ")"
                            : m.display_name
                        }
                        value={payer === m.user_id ? "Selected" : undefined}
                        onPress={() => {
                          setPayer(m.user_id);
                          setPanel(null);
                        }}
                        last
                      />
                    ),
                  )}
                {multi && (
                  <Button
                    title="Done"
                    onPress={() => {
                      Keyboard.dismiss();
                      setPanel(null);
                    }}
                  />
                )}
              </>
            )}
            {panel === "split" && (
              <>
                <View style={{ gap: 14 }}>
                  <Label size={15} weight="700">
                    Split between
                  </Label>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8 }}
                  >
                    {(isPremium(q.data?.entitlement, q.data?.earlyAccess)
                      ? [
                          "equal",
                          "exact",
                          "percentage",
                          "weighted",
                          "custom",
                          "itemized",
                        ]
                      : ["equal", "exact", "percentage", "weighted", "custom"]
                    ).map((value) => (
                      <Pressable
                        key={value}
                        accessibilityRole="radio"
                        accessibilityLabel={splitLabels[value as SplitMethod]}
                        accessibilityState={{ selected: method === value }}
                        onPress={() => changeMethod(value as SplitMethod)}
                        style={{
                          minHeight: 44,
                          paddingHorizontal: 15,
                          justifyContent: "center",
                          borderRadius: 22,
                          backgroundColor:
                            method === value ? c.primary : c.surfaceAlt,
                        }}
                      >
                        <Label
                          size={13}
                          weight="600"
                          style={{
                            color: method === value ? c.onPrimary : c.text,
                          }}
                        >
                          {splitLabels[value as SplitMethod]}
                        </Label>
                      </Pressable>
                    ))}
                  </ScrollView>
                  <Label size={11} muted>
                    {method === "percentage"
                      ? "Enter percentages totaling 100."
                      : method === "weighted"
                        ? "Enter each person’s number of shares."
                        : method === "equal"
                          ? "Everyone selected shares equally."
                          : method === "itemized"
                            ? "Assign each item to the people sharing it."
                            : "Enter amounts that add up to the total."}
                  </Label>
                  {method === "itemized" && (
                    <ItemizedEditor
                      rows={items}
                      onChange={setItems}
                      members={q.data?.members ?? []}
                      currency={currency}
                    />
                  )}
                  <View
                    style={{ flexDirection: "row", flexWrap: "wrap", gap: 9 }}
                  >
                    {q.data?.members
                      .filter(
                        (m) =>
                          m.active ||
                          (!!params.edit && originalPeople.includes(m.user_id)),
                      )
                      .map((m) => (
                        <View
                          key={m.user_id}
                          style={{
                            flexGrow: 1,
                            flexBasis: 145,
                            minWidth: 0,
                            maxWidth: "100%",
                            borderWidth: 1,
                            borderColor: selected[m.user_id]
                              ? c.primary + "55"
                              : c.border,
                            backgroundColor: selected[m.user_id]
                              ? c.tint
                              : c.surface,
                            borderRadius: 17,
                            padding: 10,
                            gap: 8,
                          }}
                        >
                          <Pressable
                            accessibilityRole="checkbox"
                            accessibilityLabel={`Include ${m.display_name}`}
                            aria-checked={!!selected[m.user_id]}
                            accessibilityState={{
                              checked: !!selected[m.user_id],
                            }}
                            onPress={() =>
                              setSelected((v) => ({
                                ...v,
                                [m.user_id]: !v[m.user_id],
                              }))
                            }
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 7,
                              minHeight: 40,
                            }}
                          >
                            <Avatar name={m.display_name} size={31} />
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Label size={12} weight="600">
                                {m.user_id === session?.user.id
                                  ? "You"
                                  : m.display_name}
                              </Label>
                              {selected[m.user_id] &&
                                preview[m.user_id] !== undefined && (
                                  <Label size={11} muted>
                                    {formatMoney(preview[m.user_id]!, currency)}
                                  </Label>
                                )}
                            </View>
                            <View
                              style={{
                                width: 16,
                                height: 16,
                                borderRadius: 8,
                                borderWidth: 1,
                                borderColor: selected[m.user_id]
                                  ? c.primary
                                  : c.border,
                                backgroundColor: selected[m.user_id]
                                  ? c.primary
                                  : "transparent",
                              }}
                            />
                          </Pressable>
                          {selected[m.user_id] &&
                            method !== "equal" &&
                            method !== "itemized" && (
                              <Field
                                label={`Share for ${m.display_name}`}
                                hideLabel
                                placeholder={
                                  method === "percentage"
                                    ? "Percent"
                                    : method === "weighted"
                                      ? "Shares"
                                      : "0.00"
                                }
                                keyboardType="decimal-pad"
                                value={values[m.user_id] || ""}
                                onChangeText={(v) =>
                                  setValues((p) => ({ ...p, [m.user_id]: v }))
                                }
                              />
                            )}
                        </View>
                      ))}
                  </View>
                </View>
                <Button
                  title="Done"
                  onPress={() => {
                    Keyboard.dismiss();
                    setPanel(null);
                  }}
                />
              </>
            )}
            {panel === "details" && (
              <>
                <View style={{ gap: 10 }}>
                  <Label size={12} weight="500" muted>
                    Category
                  </Label>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 13, paddingVertical: 2 }}
                  >
                    {categories.map((item) => (
                      <Pressable
                        key={item}
                        accessibilityRole="radio"
                        accessibilityLabel={item}
                        accessibilityState={{ selected: category === item }}
                        onPress={() => setCategory(item)}
                        style={{
                          width: 64,
                          alignItems: "center",
                          gap: 6,
                          opacity: category === item ? 1 : 0.68,
                        }}
                      >
                        <View
                          style={{
                            borderWidth: 2,
                            borderColor:
                              category === item ? c.primary : "transparent",
                            borderRadius: 18,
                            padding: 2,
                          }}
                        >
                          <CategoryIcon category={item} size={43} />
                        </View>
                        <Label
                          size={10}
                          weight={category === item ? "700" : "400"}
                          style={{
                            color: category === item ? c.primary : c.muted,
                            textAlign: "center",
                          }}
                        >
                          {item === "Food & drinks" ? "Food" : item}
                        </Label>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>

                <DateField value={date} onChange={setDate} />
                <Field
                  label="Notes (optional)"
                  placeholder="Add a note"
                  multiline
                  value={notes}
                  onChangeText={setNotes}
                  maxLength={2000}
                />
                <Button
                  title="Done"
                  onPress={() => {
                    Keyboard.dismiss();
                    setPanel(null);
                  }}
                />
                {!params.edit && (
                  <TextLink
                    title="Save offline draft"
                    onPress={() => {
                      if (!busy) void submit(true);
                    }}
                  />
                )}
                {error && <ErrorBox message={error} />}
                {notice && <Notice>{notice}</Notice>}
              </>
            )}
          </Sheet>
        </>
      )}
    </Screen>
  );
}
