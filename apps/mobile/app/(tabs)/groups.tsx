import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import {
  Plus,
  Search,
  UserPlus,
  SlidersHorizontal,
  Check,
} from "lucide-react-native";
import { useOverview, isPremium } from "../../src/lib/data";
import { useAuth } from "../../src/lib/auth";
import {
  filterGroups,
  groupFilters,
  memberBalances,
  type GroupFilter,
} from "../../src/lib/group-list";
import {
  Screen,
  Button,
  Field,
  GroupCard,
  Empty,
  Loading,
  ErrorBox,
  Label,
  TextLink,
  useColors,
} from "../../src/components/ui";
import { IconButton } from "../../src/components/mobile";
import { Sheet } from "../../src/components/sheet";
import { SettingsRow } from "../../src/components/settings";
export default function Groups() {
  const q = useOverview(),
    { session } = useAuth(),
    c = useColors();
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState<GroupFilter>("Active"),
    [open, setOpen] = useState(false);
  const groups = filterGroups(
    q.data?.groups ?? [],
    q.data?.balances ?? [],
    session?.user.id,
    search,
    filter,
  );
  return (
    <Screen
      title="Groups"
      action={
        <View style={{ flexDirection: "row", gap: 4 }}>
          <IconButton
            label="Filter groups"
            onPress={() => setOpen(true)}
            style={{
              backgroundColor: filter === "Active" ? c.surface : c.tint,
            }}
          >
            <SlidersHorizontal size={21} color={c.primary} />
          </IconButton>
          <IconButton
            label="Create group"
            onPress={() => router.push("/group/new")}
            style={{ backgroundColor: c.tint }}
          >
            <Plus size={23} color={c.primary} />
          </IconButton>
        </View>
      }
    >
      <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
        <View style={{ flex: 1 }}>
          <Field
            label="Search groups"
            hideLabel
            placeholder="Search your groups"
            leading={<Search size={18} color={c.muted} />}
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <IconButton
          label="Join with an invitation"
          onPress={() => router.push("/join")}
        >
          <UserPlus size={22} color={c.primary} />
        </IconButton>
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Label size={12} muted>
          {filter} · {groups.length} {groups.length === 1 ? "group" : "groups"}
        </Label>
        {filter !== "Active" && (
          <TextLink title="Reset filter" onPress={() => setFilter("Active")} />
        )}
      </View>
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorBox message={q.error.message} retry={() => void q.refetch()} />
      ) : groups.length ? (
        groups.map((group) => (
          <GroupCard
            key={group.id}
            group={group}
            balances={memberBalances(q.data.balances, group, session?.user.id)}
            premium={isPremium(
              q.data.entitlements.find((e) => e.group_id === group.id),
              q.data.earlyAccess,
            )}
          />
        ))
      ) : (
        <Empty
          artwork={search || filter !== "Active" ? undefined : "friends"}
          title={
            search || filter !== "Active"
              ? "No matching groups"
              : "Your people. Your plans."
          }
          body={
            search || filter !== "Active"
              ? "Try another search or change the filter."
              : "Start a trip, a shared home, or a group for the everyday things."
          }
          action={
            filter !== "Active" ? (
              <Button
                title="Show active groups"
                variant="secondary"
                onPress={() => setFilter("Active")}
              />
            ) : (
              <Button
                title="Create group"
                onPress={() => router.push("/group/new")}
              />
            )
          }
        />
      )}
      <Sheet title="Filter groups" open={open} onClose={() => setOpen(false)}>
        {groupFilters.map((value) => (
          <SettingsRow
            key={value}
            title={value}
            icon={
              filter === value ? (
                <Check size={19} color={c.primary} />
              ) : (
                <View style={{ width: 19 }} />
              )
            }
            value={filter === value ? "Selected" : undefined}
            onPress={() => {
              setFilter(value);
              setOpen(false);
            }}
            last
          />
        ))}
      </Sheet>
    </Screen>
  );
}
