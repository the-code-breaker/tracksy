import { useState } from "react";
import { View, Image, Pressable } from "react-native";
import { router } from "expo-router";
import {
  Bell,
  Plus,
  ArrowDown,
  ArrowUp,
  ArrowLeftRight,
  Users,
  UserPlus,
  ChevronRight,
} from "lucide-react-native";
import { useOverview, isPremium } from "../../src/lib/data";
import { memberBalances } from "../../src/lib/group-list";
import { useAuth } from "../../src/lib/auth";
import { useAccount, accountName } from "../../src/lib/account";
import { formatMoney } from "@tracksy/finance";
import type { Currency } from "@tracksy/domain";
import {
  Screen,
  Label,
  Card,
  Loading,
  ErrorBox,
  Section,
  TextLink,
  GroupCard,
  Button,
  Empty,
  useColors,
} from "../../src/components/ui";
import { BrandMark } from "../../src/components/brand";
import {
  Avatar,
  IconButton,
  CategoryIcon,
  BalanceBackdrop,
  Segmented,
} from "../../src/components/mobile";

export default function Home() {
  const q = useOverview(),
    { session } = useAuth(),
    c = useColors();
  const account = useAccount();
  const [chosen, setChosen] = useState<Currency>("INR");
  const totals = new Map<Currency, { owe: number; owed: number }>();
  for (const balance of q.data?.balances ?? []) {
    if (balance.user_id !== session?.user.id) continue;
    const v = totals.get(balance.currency) || { owe: 0, owed: 0 };
    if (balance.balance_minor < 0) v.owe -= balance.balance_minor;
    else v.owed += balance.balance_minor;
    totals.set(balance.currency, v);
  }
  if (!totals.size) totals.set("INR", { owe: 0, owed: 0 });
  const currency = totals.has(chosen) ? chosen : [...totals.keys()][0]!,
    value = totals.get(currency)!;
  const rawName = accountName(
    session?.user,
    account.data?.profile.display_name,
  );
  const name =
    typeof rawName === "string" ? rawName.trim().split(/\s+/)[0] : "there";
  const hour = new Date().getHours(),
    greeting =
      hour < 12
        ? "Good morning"
        : hour < 17
          ? "Good afternoon"
          : "Good evening";
  function settle() {
    const group =
      q.data?.groups.find((g) =>
        q.data.balances.some(
          (b) =>
            b.group_id === g.id &&
            b.user_id === session?.user.id &&
            b.balance_minor < 0,
        ),
      ) || q.data?.groups[0];
    if (group)
      router.push({
        pathname: "/group/[id]",
        params: { id: group.id, tab: "Balances" },
      });
    else router.push("/group/new");
  }
  const actions = [
    {
      title: "Add expense",
      Icon: Plus,
      onPress: () => router.push("/expense/new"),
    },
    { title: "Settle up", Icon: ArrowLeftRight, onPress: settle },
    {
      title: "Create group",
      Icon: Users,
      onPress: () => router.push("/group/new"),
    },
    {
      title: "Join group",
      Icon: UserPlus,
      onPress: () => router.push("/join"),
    },
  ];
  return (
    <Screen title="Home" header={false}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingVertical: 3,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
          <BrandMark size={28} />
          <Label size={19} weight="700">
            Tracksy
          </Label>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <IconButton
            label="View activity"
            onPress={() => router.push("/(tabs)/activity")}
          >
            <Bell size={21} color={c.text} />
          </IconButton>
          <IconButton
            label="Open profile"
            onPress={() => router.push("/(tabs)/profile")}
          >
            <Avatar
              name={typeof rawName === "string" ? rawName : "You"}
              source={session?.user.user_metadata.avatar_url}
            />
          </IconButton>
        </View>
      </View>
      <View
        style={{
          minHeight: 80,
          flexDirection: "row",
          alignItems: "center",
          gap: 5,
        }}
      >
        <View style={{ flex: 1, gap: 5, zIndex: 1 }}>
          <Label size={17} style={{ color: c.muted }} weight="600">
            {greeting},
          </Label>
          <Label size={24} weight="700" style={{ letterSpacing: -0.6 }}>
            {name}! 👋
          </Label>
          <Label size={12} muted>
            Keep track. Split fairly. Make more memories.
          </Label>
        </View>
        <Image
          source={require("../../assets/illustrations/lake-vignette.png")}
          resizeMode="contain"
          style={{ width: 95, height: 78 }}
          accessibilityLabel="A peaceful lakeside cottage"
        />
      </View>
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorBox message={q.error.message} retry={() => void q.refetch()} />
      ) : (
        <>
          {totals.size > 1 && (
            <Segmented
              options={[...totals.keys()]}
              value={currency}
              onChange={setChosen}
            />
          )}
          <View
            style={{
              borderRadius: 24,
              overflow: "hidden",
              padding: 21,
              minHeight: 120,
              justifyContent: "center",
              gap: 5,
            }}
          >
            <BalanceBackdrop />
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <Label size={13} weight="500" style={{ color: "#e3f6ef" }}>
                Total balance · {currency}
              </Label>
              <ChevronRight size={14} color="#d9f4e8" />
            </View>
            <Label
              size={34}
              weight="700"
              style={{
                color: "#fff",
                letterSpacing: -1,
                fontVariant: ["tabular-nums"],
              }}
            >
              {formatMoney(value.owed - value.owe, currency)}
            </Label>
            <Label size={12} style={{ color: "#d5f0e7" }}>
              {value.owed > value.owe
                ? "You are owed overall"
                : value.owe > value.owed
                  ? "You owe overall"
                  : "You’re all settled up"}
            </Label>
          </View>
          <View style={{ flexDirection: "row", gap: 11 }}>
            {[
              {
                title: "You owe",
                amount: value.owe,
                Icon: ArrowUp,
                bg: c.dangerTint,
                color: "#d85f54",
              },
              {
                title: "You are owed",
                amount: value.owed,
                Icon: ArrowDown,
                bg: c.tint,
                color: c.primary,
              },
            ].map((item) => (
              <View
                key={item.title}
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: 15,
                  borderRadius: 20,
                  backgroundColor: item.bg,
                  gap: 5,
                }}
              >
                <View
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 13,
                    backgroundColor: item.color + "15",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <item.Icon size={16} color={item.color} />
                </View>
                <Label size={12}>{item.title}</Label>
                <Label
                  size={21}
                  weight="700"
                  style={{ fontVariant: ["tabular-nums"] }}
                >
                  {formatMoney(item.amount, currency)}
                </Label>
              </View>
            ))}
          </View>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              gap: 3,
              marginVertical: 3,
            }}
          >
            {actions.map(({ title, Icon, onPress }, i) => (
              <Pressable
                key={title}
                accessibilityRole="button"
                accessibilityLabel={title}
                onPress={onPress}
                style={({ pressed }) => ({
                  flex: 1,
                  minWidth: 0,
                  alignItems: "center",
                  gap: 7,
                  opacity: pressed ? 0.65 : 1,
                  paddingVertical: 6,
                })}
              >
                <View
                  style={{
                    width: 49,
                    height: 49,
                    borderRadius: 25,
                    backgroundColor: i === 0 ? "#c7eee5" : c.surfaceAlt,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon
                    size={22}
                    color={i === 0 ? "#007c6b" : c.muted}
                    strokeWidth={1.8}
                  />
                </View>
                <Label size={10} weight="500" style={{ textAlign: "center" }}>
                  {title}
                </Label>
              </Pressable>
            ))}
          </View>
          <Section
            title="Your groups"
            action={
              <TextLink
                title="View all groups"
                onPress={() => router.push("/(tabs)/groups")}
              />
            }
          >
            {q.data.groups.some((g) => !g.archived_at) ? (
              q.data.groups
                .filter((g) => !g.archived_at)
                .slice(0, 3)
                .map((group) => (
                  <GroupCard
                    key={group.id}
                    group={group}
                    balances={memberBalances(
                      q.data.balances,
                      group,
                      session?.user.id,
                    )}
                    premium={isPremium(
                      q.data.entitlements.find((e) => e.group_id === group.id),
                      q.data.earlyAccess,
                    )}
                  />
                ))
            ) : (
              <Empty
                title="Better together"
                body="Create a group for your next trip, shared home or everyday plans."
                action={
                  <Button
                    title="Create your first group"
                    onPress={() => router.push("/group/new")}
                  />
                }
              />
            )}
          </Section>
          <Section
            title="Recent activity"
            action={
              <TextLink
                title="See all activity"
                onPress={() => router.push("/(tabs)/activity")}
              />
            }
          >
            <Card style={{ paddingHorizontal: 15, paddingVertical: 3 }}>
              {q.data.expenses.length ? (
                q.data.expenses.map((expense, index) => (
                  <Pressable
                    key={expense.id}
                    accessibilityRole="button"
                    accessibilityLabel={`View expense ${expense.description}`}
                    onPress={() => router.push(`/expense/${expense.id}`)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      paddingVertical: 14,
                      borderBottomWidth:
                        index < q.data.expenses.length - 1 ? 1 : 0,
                      borderBottomColor: c.border,
                    }}
                  >
                    <CategoryIcon category={expense.category} />
                    <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                      <Label size={14} weight="600">
                        {expense.description}
                      </Label>
                      <Label size={11} muted>
                        {
                          q.data.groups.find((g) => g.id === expense.group_id)
                            ?.name
                        }
                      </Label>
                    </View>
                    <View
                      style={{
                        alignItems: "flex-end",
                        maxWidth: "38%",
                        gap: 3,
                      }}
                    >
                      <Label size={14} weight="700">
                        {formatMoney(expense.amount_minor, expense.currency)}
                      </Label>
                      <Label size={10} muted>
                        {new Date(expense.expense_date).toLocaleDateString(
                          "en-IN",
                          { day: "numeric", month: "short" },
                        )}
                      </Label>
                    </View>
                  </Pressable>
                ))
              ) : (
                <View style={{ paddingVertical: 20 }}>
                  <Label muted size={13}>
                    Your shared expenses will appear here.
                  </Label>
                </View>
              )}
            </Card>
          </Section>
          {!!q.data.settlements.length && (
            <Section title="Pending settlements">
              {q.data.settlements.slice(0, 3).map((payment) => (
                <Card key={payment.id} style={{ gap: 8 }}>
                  <Label size={13} muted>
                    Awaiting confirmation
                  </Label>
                  <Label size={20} weight="700">
                    {formatMoney(payment.amount_minor, payment.currency)}
                  </Label>
                  <TextLink
                    title="View settlement"
                    onPress={() =>
                      router.push({
                        pathname: "/group/[id]",
                        params: { id: payment.group_id, tab: "Balances" },
                      })
                    }
                  />
                </Card>
              ))}
            </Section>
          )}
        </>
      )}
    </Screen>
  );
}
