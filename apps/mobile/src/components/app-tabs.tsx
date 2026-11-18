import { useEffect, useState } from "react";
import { Tabs, Redirect, router } from "expo-router";
import { View, Pressable, Keyboard, useWindowDimensions } from "react-native";
import {
  House,
  Users,
  ChartNoAxesCombined,
  CircleUserRound,
  Plus,
} from "lucide-react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../lib/auth";
import { usePreferences } from "../lib/state";
import { translations } from "@tracksy/config";
import { Label, useColors, Loading } from "./ui";

function AppTabBar({ state, navigation, descriptors }: BottomTabBarProps) {
  const c = useColors(),
    insets = useSafeAreaInsets(),
    { fontScale } = useWindowDimensions();
  const [keyboard, setKeyboard] = useState(false);
  useEffect(() => {
    const a = Keyboard.addListener("keyboardDidShow", () => setKeyboard(true)),
      b = Keyboard.addListener("keyboardDidHide", () => setKeyboard(false));
    return () => {
      a.remove();
      b.remove();
    };
  }, []);
  if (keyboard) return null;
  const names = ["index", "groups", "insights", "profile"];
  const icons = [House, Users, ChartNoAxesCombined, CircleUserRound];
  const tab = (position: number) => {
    const route = state.routes.find((r) => r.name === names[position]);
    if (!route) return null;
    const selected = state.routes[state.index]?.key === route.key;
    const title = descriptors[route.key]?.options.title || route.name,
      Icon = icons[position]!;
    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityLabel={title}
        accessibilityState={{ selected }}
        onPress={() => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!selected && !event.defaultPrevented)
            navigation.navigate(route.name, route.params);
        }}
        style={{
          flex: 1,
          minWidth: 0,
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          minHeight: 58,
          paddingVertical: 5,
        }}
      >
        <Icon
          size={22}
          color={selected ? c.primary : c.muted}
          strokeWidth={selected ? 2.6 : 1.8}
        />
        <Label
          size={10}
          weight={selected ? "700" : "500"}
          style={{ color: selected ? c.primary : c.muted, textAlign: "center" }}
        >
          {title}
        </Label>
      </Pressable>
    );
  };
  return (
    <View
      testID="app-tab-bar"
      style={{
        backgroundColor: c.surface,
        borderTopWidth: 1,
        borderTopColor: c.border,
        paddingHorizontal: 10,
        paddingTop: 8,
        paddingBottom: Math.max(8, insets.bottom),
        minHeight: 80 + insets.bottom + Math.max(0, fontScale - 1) * 20,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {tab(0)}
        {tab(1)}
        <View style={{ flex: 1, alignItems: "center" }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add expense"
            onPress={() => router.push("/expense/new")}
            style={({ pressed }) => ({
              width: 54,
              height: 54,
              borderRadius: 27,
              backgroundColor: c.gold,
              alignItems: "center",
              justifyContent: "center",
              marginTop: -18,
              opacity: pressed ? 0.8 : 1,
              borderWidth: 4,
              borderColor: c.surface,
              shadowColor: "#006a5e",
              shadowOpacity: 0.18,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 4 },
              elevation: 3,
            })}
          >
            <Plus size={27} color="#fff" strokeWidth={2} />
          </Pressable>
        </View>
        {tab(2)}
        {tab(3)}
      </View>
    </View>
  );
}
export default function AppTabs() {
  const { session, loading } = useAuth();
  const language = usePreferences((s) => s.language),
    t = translations[language];
  if (loading) return <Loading />;
  if (!session) return <Redirect href="/auth" />;
  return (
    <Tabs
      tabBar={(props) => <AppTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: t.home }} />
      <Tabs.Screen name="groups" options={{ title: t.groups }} />
      <Tabs.Screen name="insights" options={{ title: t.insights }} />
      <Tabs.Screen name="profile" options={{ title: t.profile }} />
      <Tabs.Screen
        name="activity"
        options={{ title: t.activity, href: null }}
      />
    </Tabs>
  );
}
