import type { ReactNode } from "react";
import {
  View,
  Text,
  Pressable,
  Image,
  ScrollView,
  type ViewStyle,
} from "react-native";
import {
  ChevronRight,
  Utensils,
  ShoppingCart,
  Train,
  Home,
  Ticket,
  Receipt,
  Plus,
  ArrowLeft,
  Settings,
} from "lucide-react-native";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Stop,
  Rect,
  Path,
  G,
} from "react-native-svg";
import { Label, useColors } from "./ui";
export const tripArt = require("../../assets/illustrations/trip-friends.png");
export function GroupHero({
  title,
  subtitle,
  members,
  onBack,
  onSettings,
  onMembers,
}: {
  title: string;
  subtitle: string;
  members: { user_id: string; display_name: string }[];
  onBack: () => void;
  onSettings: () => void;
  onMembers: () => void;
}) {
  const c = useColors();
  return (
    <View style={{ gap: 14, paddingBottom: 4 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <IconButton label="Go back" onPress={onBack}>
          <ArrowLeft size={23} color={c.text} />
        </IconButton>
        <View style={{ flex: 1, gap: 3 }}>
          <Label size={22} weight="700">
            {title}
          </Label>
          <Label size={12} muted>
            {subtitle}
          </Label>
        </View>
        <IconButton label="Group settings" onPress={onSettings}>
          <Settings size={22} color={c.text} />
        </IconButton>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Manage group members"
        onPress={onMembers}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 0,
          paddingLeft: 5,
          minHeight: 44,
        }}
      >
        {members.slice(0, 5).map((m, i) => (
          <View key={m.user_id} style={{ marginLeft: i ? -7 : 0 }}>
            <Avatar name={m.display_name} size={34} />
          </View>
        ))}
        <View
          style={{
            marginLeft: 8,
            flexDirection: "row",
            gap: 5,
            alignItems: "center",
          }}
        >
          <Plus size={17} color={c.primary} />
          <Label size={12} style={{ color: c.primary }}>
            Add friends
          </Label>
        </View>
      </Pressable>
    </View>
  );
}
export function Avatar({
  name,
  size = 36,
  source,
}: {
  name: string;
  size?: number;
  source?: string;
}) {
  const c = useColors();
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((n) => n[0])
      .join("")
      .toUpperCase() || "T";
  return (
    <View
      accessibilityLabel={name}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: c.tint,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 2,
        borderColor: c.surface,
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {source?.startsWith("https://") ? (
        <Image
          source={{ uri: source }}
          style={{ width: "100%", height: "100%" }}
        />
      ) : (
        <Text
          style={{ fontWeight: "700", fontSize: size * 0.34, color: c.primary }}
        >
          {initials}
        </Text>
      )}
    </View>
  );
}
export function IconButton({
  label,
  onPress,
  children,
  style,
}: {
  label: string;
  onPress: () => void;
  children: ReactNode;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        {
          width: 44,
          height: 44,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 22,
          opacity: pressed ? 0.65 : 1,
        },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  const c = useColors();
  return (
    <View
      accessibilityRole="radiogroup"
      style={{
        flexDirection: "row",
        backgroundColor: c.surfaceAlt,
        borderRadius: 18,
        padding: 4,
        gap: 2,
      }}
    >
      {options.map((option) => (
        <Pressable
          key={option}
          accessibilityRole="radio"
          accessibilityState={{ selected: option === value }}
          accessibilityLabel={option}
          onPress={() => onChange(option)}
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 42,
            borderRadius: 14,
            backgroundColor: option === value ? c.gold : "transparent",
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 4,
            paddingVertical: 8,
          }}
        >
          <Label
            size={12}
            weight={option === value ? "600" : "500"}
            style={{
              color: option === value ? "#fff" : c.muted,
              textAlign: "center",
            }}
          >
            {option}
          </Label>
        </Pressable>
      ))}
    </View>
  );
}
export function CategoryIcon({
  category,
  size = 42,
}: {
  category: string;
  size?: number;
}) {
  const c = useColors();
  const food = /food|dining|restaurant/i.test(category),
    travel = /travel|transport/i.test(category),
    home = /home|rent|accommodation/i.test(category),
    shop = /grocer|shop/i.test(category),
    fun = /entertain|activit/i.test(category);
  const Icon = food
    ? Utensils
    : travel
      ? Train
      : home
        ? Home
        : shop
          ? ShoppingCart
          : fun
            ? Ticket
            : Receipt;
  const color = food
    ? "#e87563"
    : travel
      ? "#479bc5"
      : home
        ? "#759bd8"
        : shop
          ? c.primary
          : fun
            ? "#d99838"
            : c.primary;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 14,
        backgroundColor: color + "16",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <Icon size={size * 0.48} color={color} strokeWidth={1.8} />
    </View>
  );
}
export function BalanceBackdrop() {
  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", inset: 0 }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 420 165"
        preserveAspectRatio="xMidYMid slice"
      >
        <Defs>
          <LinearGradient id="balance-green" x1="0" y1="0" x2="1" y2=".6">
            <Stop stopColor="#06494b" />
            <Stop offset="1" stopColor="#078875" />
          </LinearGradient>
        </Defs>
        <Rect width="420" height="165" rx="24" fill="url(#balance-green)" />
        <Path
          d="M215 165 286 38 348 165M271 165 354 14 430 165"
          fill="#c1f1ce"
          opacity=".08"
        />
        <Path
          d="m303 155 19-46 19 46Zm24 10 25-69 25 69Zm43-3 29-89 28 89Z"
          fill="#8ed3a6"
          opacity=".25"
        />
        <Path d="m335 151 18-43 18 43Z" fill="#b8e3b1" opacity=".3" />
      </Svg>
    </View>
  );
}
export function GoogleMark() {
  return (
    <Svg width={21} height={21} viewBox="0 0 24 24">
      <Path
        fill="#4285F4"
        d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z"
      />
      <Path
        fill="#34A853"
        d="M12 22c2.7 0 4.96-.9 6.61-2.41l-3.24-2.51c-.9.6-2.06.96-3.37.96-2.61 0-4.82-1.76-5.61-4.12H3.05v2.59A10 10 0 0 0 12 22Z"
      />
      <Path
        fill="#FBBC05"
        d="M6.39 13.92A6 6 0 0 1 6.08 12c0-.67.11-1.32.31-1.92V7.49H3.05A10 10 0 0 0 2 12c0 1.61.39 3.14 1.05 4.51l3.34-2.59Z"
      />
      <Path
        fill="#EA4335"
        d="M12 5.96c1.47 0 2.79.51 3.82 1.51l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.95 5.49l3.34 2.59C7.18 7.72 9.39 5.96 12 5.96Z"
      />
    </Svg>
  );
}
