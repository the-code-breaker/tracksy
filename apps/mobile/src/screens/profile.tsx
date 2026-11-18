import { useEffect, useState } from "react";
import { View, Platform, Linking, AppState } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import {
  Pencil,
  Palette,
  Coins,
  Globe,
  Bell,
  ShieldCheck,
  FileClock,
  LifeBuoy,
  LockKeyhole,
  LogOut,
  Trash2,
  Check,
  ChevronRight,
} from "lucide-react-native";
import { useAuth } from "../lib/auth";
import { useAccount, accountName } from "../lib/account";
import { usePreferences } from "../lib/state";
import { useAccountSetting } from "../lib/account-setting";
import { useSetting } from "../lib/use-setting";
import { supabase, rpc } from "../lib/supabase";
import { listDrafts, removeDraft, type Draft } from "../lib/drafts";
import {
  readPhoneAlerts,
  setPhoneAlerts,
  backgroundAlertsConfigured,
} from "../lib/device-alerts";
import {
  supportWebsite,
  privacyPolicyUrl,
  accountDeletionUrl,
} from "../lib/support";
import { formatMoney } from "@tracksy/finance";
import type { Currency } from "@tracksy/domain";
import {
  Screen,
  Label,
  Field,
  Button,
  ErrorBox,
  Notice,
  Loading,
  useColors,
  Card,
} from "../components/ui";
import { Avatar, IconButton } from "../components/mobile";
import { Sheet } from "../components/sheet";
import {
  SettingsSection,
  SettingsRow,
  ToggleRow,
} from "../components/settings";
type Panel =
  | "edit"
  | "appearance"
  | "currency"
  | "language"
  | "notifications"
  | "security"
  | "drafts"
  | "delete"
  | "signout"
  | null;
export default function Profile() {
  const { session } = useAuth(),
    q = useAccount(),
    c = useColors(),
    cache = useQueryClient(),
    prefs = usePreferences();
  const [panel, setPanel] = useState<Panel>(null),
    [name, setName] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [phone, setPhone] = useState(false),
    [drafts, setDrafts] = useState<Draft[]>([]),
    [allDevices, setAllDevices] = useState(false);
  const displayName =
    accountName(session?.user, q.data?.profile.display_name) || "Add your name";
  const themeSetting = useAccountSetting(
    "preferences",
    "theme",
    q.data?.preferences.theme ?? prefs.theme,
    setError,
  );
  const languageSetting = useAccountSetting(
    "profile",
    "language",
    q.data?.profile.language ?? prefs.language,
    setError,
  );
  const currencySetting = useAccountSetting(
    "profile",
    "currency",
    q.data?.profile.currency ?? "INR",
    setError,
  );
  const expensesSetting = useAccountSetting(
    "notifications",
    "expenses",
    q.data?.notifications.expenses ?? true,
    setError,
  );
  const settlementsSetting = useAccountSetting(
    "notifications",
    "settlements",
    q.data?.notifications.settlements ?? true,
    setError,
  );
  const remindersSetting = useAccountSetting(
    "notifications",
    "reminders",
    q.data?.notifications.reminders ?? true,
    setError,
  );
  const previewsSetting = useAccountSetting(
    "preferences",
    "detailed_previews",
    q.data?.preferences.detailed_previews ?? false,
    setError,
  );
  const phoneSetting = useSetting(`${session?.user.id}:phone`, phone, {
    optimistic: setPhone,
    async save(value) {
      await setPhoneAlerts(session!.user.id, value);
    },
    failed(e) {
      setError((e as Error).message);
    },
  });
  async function signOut(global = false) {
    if (busy) return;
    setPanel(null);
    setBusy(true);
    setError("");
    try {
      const result = await supabase.auth.signOut({
        scope: global ? "global" : "local",
      });
      if (result.error) throw result.error;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!session) return;
    void listDrafts(session.user.id)
      .then(setDrafts)
      .catch(() => {});
    const refresh = () =>
      void readPhoneAlerts(session.user.id)
        .then((v) => setPhone(v.enabled))
        .catch(() => {});
    refresh();
    const a = AppState.addEventListener("change", (s) => {
      if (s === "active") refresh();
    });
    return () => a.remove();
  }, [session?.user.id]);
  async function act(
    task: () => Promise<unknown>,
    success = "",
    close = false,
  ) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await task();
      void cache.invalidateQueries({
        queryKey: ["profile", session?.user.id],
      });
      if (success) setNotice(success);
      if (close) setPanel(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function updateProfile(patch: Record<string, unknown>) {
    const r = await supabase
      .from("profiles")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", session!.user.id);
    if (r.error) throw r.error;
    cache.setQueryData(["profile", session!.user.id], (old: any) =>
      old ? { ...old, profile: { ...old.profile, ...patch } } : old,
    );
    void cache.invalidateQueries({ queryKey: ["group"] });
    void cache.invalidateQueries({ queryKey: ["overview"] });
  }
  const icon = (Icon: typeof Pencil) => <Icon size={20} color={c.muted} />;
  const titles: Record<Exclude<Panel, null>, string> = {
    edit: "Edit profile",
    appearance: "Appearance",
    currency: "Currency",
    language: "Language",
    notifications: "Notifications",
    security: "Account security",
    drafts: "Offline drafts",
    delete: "Delete account",
    signout: "Sign out",
  };
  return (
    <Screen title="Profile">
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorBox message={q.error.message} retry={() => void q.refetch()} />
      ) : (
        <>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
              paddingVertical: 9,
            }}
          >
            <Avatar
              name={displayName}
              size={62}
              source={session?.user.user_metadata?.avatar_url}
            />
            <View style={{ flex: 1, gap: 4 }}>
              <Label size={23} weight="700">
                {displayName}
              </Label>
              <Label size={12} muted>
                {session?.user.email}
              </Label>
            </View>
            <IconButton
              label="Edit profile"
              onPress={() => {
                setName(
                  accountName(session?.user, q.data.profile.display_name),
                );
                setError("");
                setPanel("edit");
              }}
            >
              {icon(Pencil)}
            </IconButton>
          </View>
          {notice && <Notice>{notice}</Notice>}
          {error && !panel && <ErrorBox message={error} />}
          <SettingsSection title="Preferences">
            <SettingsRow
              title="Appearance"
              icon={icon(Palette)}
              value={
                { system: "Use device", light: "Light", dark: "Dark" }[
                  prefs.theme
                ]
              }
              onPress={() => setPanel("appearance")}
            />
            <SettingsRow
              title="Default currency"
              icon={icon(Coins)}
              value={q.data.profile.currency}
              onPress={() => setPanel("currency")}
            />
            <SettingsRow
              title="Language"
              icon={icon(Globe)}
              value={prefs.language === "hi" ? "Hindi" : "English"}
              onPress={() => setPanel("language")}
              last
            />
          </SettingsSection>
          <SettingsSection title="Your account">
            <SettingsRow
              title="Notifications"
              icon={icon(Bell)}
              value={phone ? "On" : "Off"}
              onPress={() => setPanel("notifications")}
            />
            <SettingsRow
              title="Security"
              icon={icon(ShieldCheck)}
              onPress={() => setPanel("security")}
            />
            <SettingsRow
              title="Offline drafts"
              icon={icon(FileClock)}
              value={String(drafts.length)}
              onPress={() => setPanel("drafts")}
              last
            />
          </SettingsSection>
          <SettingsSection title="Support">
            <SettingsRow
              title="Help and feedback"
              icon={icon(LifeBuoy)}
              onPress={() => void Linking.openURL(supportWebsite)}
            />
            <SettingsRow
              title="Privacy policy"
              icon={icon(LockKeyhole)}
              onPress={() => void Linking.openURL(privacyPolicyUrl)}
            />
            <SettingsRow
              title="Delete account"
              icon={icon(Trash2)}
              danger
              onPress={() => {
                setError("");
                setPanel("delete");
              }}
              last
            />
          </SettingsSection>
          <SettingsSection title="">
            <SettingsRow
              title="Sign out"
              icon={icon(LogOut)}
              value={busy ? "Signing out…" : undefined}
              disabled={busy}
              onPress={() => void signOut()}
              last
            />
          </SettingsSection>
          <Label size={11} muted style={{ textAlign: "center" }}>
            Tracksy · shared expenses, made simple
          </Label>
        </>
      )}
      <Sheet
        title={panel ? titles[panel] : ""}
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
              label="Full name"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              maxLength={80}
            />
            <Label size={12} muted>
              {session?.user.email}
            </Label>
            <Button
              title="Save"
              loading={busy}
              disabled={!name.trim()}
              onPress={() =>
                void act(
                  () => updateProfile({ display_name: name.trim() }),
                  "Profile updated.",
                  true,
                )
              }
            />
          </>
        )}
        {panel === "appearance" &&
          (["system", "light", "dark"] as const).map((value) => (
            <SettingsRow
              key={value}
              title={
                { system: "Use device setting", light: "Light", dark: "Dark" }[
                  value
                ]
              }
              icon={
                prefs.theme === value ? (
                  <Check size={19} color={c.primary} />
                ) : (
                  <View style={{ width: 19 }} />
                )
              }
              onPress={() => {
                themeSetting.choose(value);
                setPanel(null);
              }}
              last
            />
          ))}
        {panel === "currency" &&
          (["INR", "USD", "EUR", "GBP", "JPY", "KWD"] as Currency[]).map(
            (value) => (
              <SettingsRow
                key={value}
                title={value}
                icon={
                  q.data?.profile.currency === value ? (
                    <Check size={19} color={c.primary} />
                  ) : (
                    <View style={{ width: 19 }} />
                  )
                }
                onPress={() => {
                  currencySetting.choose(value);
                  setPanel(null);
                }}
                last
              />
            ),
          )}
        {panel === "language" &&
          (["en", "hi"] as const).map((value) => (
            <SettingsRow
              key={value}
              title={value === "en" ? "English" : "Hindi"}
              onPress={() => {
                languageSetting.choose(value);
                setPanel(null);
              }}
              last
            />
          ))}
        {panel === "notifications" && (
          <>
            <ToggleRow
              title="Phone notifications"
              subtitle={
                Platform.OS === "web"
                  ? "Use the Android app to receive phone alerts."
                  : backgroundAlertsConfigured
                    ? "Group alerts on this phone."
                    : "Group alerts while Tracksy is open."
              }
              value={phoneSetting.value}
              pending={phoneSetting.pending}
              disabled={Platform.OS === "web"}
              onChange={phoneSetting.choose}
            />
            <ToggleRow
              title="Expense updates"
              value={expensesSetting.value}
              pending={expensesSetting.pending}
              onChange={expensesSetting.choose}
            />
            <ToggleRow
              title="Settlement updates"
              value={settlementsSetting.value}
              pending={settlementsSetting.pending}
              onChange={settlementsSetting.choose}
            />
            <ToggleRow
              title="Email payment reminders"
              subtitle="Allow group members to remind you about an outstanding balance."
              value={remindersSetting.value}
              pending={remindersSetting.pending}
              onChange={remindersSetting.choose}
            />
            <ToggleRow
              title="Show group names in alerts"
              value={previewsSetting.value}
              pending={previewsSetting.pending}
              onChange={previewsSetting.choose}
            />
            {Platform.OS !== "web" && (
              <SettingsRow
                title="Open phone settings"
                onPress={() => void Linking.openSettings()}
                last
              />
            )}
          </>
        )}
        {panel === "security" && (
          <>
            <Label size={13} muted>
              Your login is stored securely on this phone.
            </Label>
            <SettingsRow
              title="Sign out this device"
              onPress={() => void signOut()}
            />
            <SettingsRow
              title="Sign out all devices"
              onPress={() => {
                setAllDevices(true);
                setPanel("signout");
              }}
              last
            />
          </>
        )}
        {panel === "signout" && (
          <>
            <Label size={14}>
              Sign out {allDevices ? "on all your devices" : "on this device"}?
            </Label>
            <Button
              title="Sign out"
              loading={busy}
              onPress={() => void signOut(allDevices)}
            />
          </>
        )}
        {panel === "drafts" && (
          <>
            <Label size={12} muted>
              Drafts stay on this phone until you save them to the group.
            </Label>
            {drafts.length ? (
              drafts.map((d) => (
                <Card key={d.id} style={{ gap: 10 }}>
                  <Label weight="600">{d.payload.description}</Label>
                  <Label muted size={13}>
                    {formatMoney(d.payload.amount_minor, d.payload.currency)}
                  </Label>
                  <Button
                    title="Sync draft"
                    loading={busy}
                    onPress={() =>
                      void act(async () => {
                        await rpc("create_expense", { p: d.payload });
                        await removeDraft(d.id);
                        setDrafts(await listDrafts(session!.user.id));
                        await cache.invalidateQueries();
                      }, "Draft saved to the group.")
                    }
                  />
                  <SettingsRow
                    title="Discard draft"
                    danger
                    onPress={() =>
                      void act(async () => {
                        await removeDraft(d.id);
                        setDrafts(await listDrafts(session!.user.id));
                      })
                    }
                    last
                  />
                </Card>
              ))
            ) : (
              <Label muted>No drafts on this phone.</Label>
            )}
          </>
        )}
        {panel === "delete" && (
          <>
            <Label size={14}>
              Request removal of your account and personal data. Shared records
              may be retained for other group members as described in the
              privacy policy.
            </Label>
            <SettingsRow
              title="Read deletion information"
              onPress={() => void Linking.openURL(accountDeletionUrl)}
              last
            />
            <Button
              title="Request deletion"
              variant="danger"
              loading={busy}
              onPress={() =>
                void act(
                  () => rpc("request_account_deletion"),
                  "Deletion request received. Support will confirm the next steps.",
                  true,
                )
              }
            />
          </>
        )}
        {error && <ErrorBox message={error} />}
      </Sheet>
    </Screen>
  );
}
