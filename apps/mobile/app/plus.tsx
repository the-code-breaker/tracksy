import { useState } from "react";
import { View, Linking } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../src/lib/auth";
import { rpc } from "../src/lib/supabase";
import { useGroups, useGroup, isPremium } from "../src/lib/data";
import { billing, purchaseGroup } from "../src/lib/billing";
import {
  Screen,
  Card,
  Label,
  Button,
  Badge,
  Notice,
  ErrorBox,
  Loading,
  s,
} from "../src/components/ui";
export default function Plus() {
  const params = useLocalSearchParams<{ group?: string }>();
  const groups = useGroups();
  const [selected, setSelected] = useState(params.group || "");
  const groupId =
    selected || groups.data?.find((g) => !g.archived_at)?.id || "";
  const group = useGroup(groupId);
  const { session } = useAuth();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const access = useQuery({
    queryKey: ["early-access", session?.user.id],
    enabled: !!session,
    queryFn: () => rpc<boolean>("group_plus_early_access"),
  });
  const offerings = useQuery({
    queryKey: ["offerings", session?.user.id],
    enabled: !!session && group.isSuccess && access.data === false,
    queryFn: async () => {
      const client = await billing(session!.user.id);
      return client.getOfferings();
    },
    retry: false,
  });
  const premium = isPremium(group.data?.entitlement, group.data?.earlyAccess);
  if (access.isPending || groups.isPending)
    return (
      <Screen title="Group Plus" back>
        <Loading />
      </Screen>
    );
  if (access.error || groups.error)
    return (
      <Screen title="Group Plus" back>
        <ErrorBox message={(access.error || groups.error)!.message} />
      </Screen>
    );
  if (access.data)
    return (
      <Screen title="Group Plus" subtitle="Free during early access" back>
        <Card style={{ gap: 18 }}>
          <Badge text="EARLY ACCESS" />
          <Label size={27} weight="700">
            More tools. On us.
          </Label>
          <Label muted size={15}>
            Group Plus is unlocked for everyone during early access, across all
            your groups. No purchase or payment details are needed.
          </Label>
          {[
            "Itemized splits and saved split rules",
            "Spending insights and monthly budgets",
            "Recurring expenses",
            "Settlement suggestions and CSV/PDF reports",
          ].map((text) => (
            <Label key={text} size={14}>
              ✓ {text}
            </Label>
          ))}
          <Notice>
            Group Plus will become a paid option in the future. Early access
            does not create a subscription or charge you automatically.
          </Notice>
          <Label size={12} muted>
            Receipt scanning and AI assistance are not included. Existing group
            roles still apply to manager tools.
          </Label>
        </Card>
        {groupId && (
          <Button
            title="Back to your group"
            onPress={() => router.replace(`/group/${groupId}`)}
          />
        )}
      </Screen>
    );
  return (
    <Screen
      title="Group Plus"
      subtitle="One member upgrades. Everyone in that group benefits."
      back
    >
      <View style={s.wrap}>
        {groups.data?.map((g) => (
          <Button
            key={g.id}
            title={g.name}
            variant={g.id === groupId ? "primary" : "secondary"}
            onPress={() => setSelected(g.id)}
          />
        ))}
      </View>
      <View style={s.grid}>
        <Card style={{ ...s.col, gap: 20 }}>
          <Badge text="✦ GROUP PLUS" />
          <Label size={30} weight="700">
            Additional tools for your group
          </Label>
          <Label muted>
            Advanced analytics, group budgets, and optional settlement
            suggestions. Core splitting, records, and settlements remain free.
          </Label>
          {[
            "Every current member of this group is covered",
            "Other groups keep their own plan",
            "Financial history stays when Plus expires",
          ].map((text) => (
            <Label key={text}>✓ {text}</Label>
          ))}
          <Notice>
            Group Plus adds itemized splits, recurring schedules, analytics,
            budgets, and reports. Receipt scanning and AI assistance are not
            included yet.
          </Notice>
        </Card>
        <Card style={{ ...s.col, gap: 16 }}>
          <Label size={22} weight="700">
            {group.data?.group.name || "Select a group"}
          </Label>
          {premium && (
            <Notice>
              Plus is active through{" "}
              {new Date(
                group.data!.entitlement!.expires_at,
              ).toLocaleDateString()}
              . Purchaser:{" "}
              {group.data?.members.find(
                (m) => m.user_id === group.data?.entitlement?.purchaser_id,
              )?.display_name || "Original paying account"}
              . Renewal: {group.data?.entitlement?.renews ? "on" : "off"}.
            </Notice>
          )}
          {offerings.isPending ? (
            <Loading />
          ) : offerings.error ? (
            <Notice>
              {offerings.error.message} No purchase has been initiated.
            </Notice>
          ) : offerings.data.current?.availablePackages.length ? (
            offerings.data.current.availablePackages.map((pkg) => (
              <Button
                key={pkg.identifier}
                title={`${pkg.product.title} · ${pkg.product.priceString}`}
                loading={busy}
                disabled={!groupId || premium}
                onPress={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    await purchaseGroup(session!.user.id, groupId, pkg);
                    setNotice(
                      "The store purchase was submitted. Access appears only after the backend verifies and maps it to this group.",
                    );
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            ))
          ) : (
            <Notice>
              No store products are available. Configure RevenueCat offerings
              and sandbox products before testing purchases.
            </Notice>
          )}
          <Label muted size={12}>
            Prices and terms come from your storefront. Subscriptions renew
            automatically until cancelled. This release supports one beneficiary
            group per purchasing account. Group changes never silently move a
            store subscription.
          </Label>
          <Button
            title="Restore store purchases"
            variant="secondary"
            loading={busy}
            onPress={async () => {
              setBusy(true);
              try {
                const client = await billing(session!.user.id);
                await client.restorePurchases();
                setNotice(
                  "Restore submitted. The original group mapping is retained; server verification is required.",
                );
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          />
          <Button
            title="Manage subscriptions in your store"
            variant="secondary"
            onPress={async () => {
              try {
                const client = await billing(session!.user.id);
                const info = await client.getCustomerInfo();
                if (!info.managementURL)
                  throw new Error(
                    "No store subscription management link is available",
                  );
                await Linking.openURL(info.managementURL);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          />
          {notice && <Notice>{notice}</Notice>}
          {error && <ErrorBox message={error} />}
        </Card>
      </View>
    </Screen>
  );
}
