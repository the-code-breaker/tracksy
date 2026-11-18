import React, { useState, type ReactNode } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  StyleSheet,
  useColorScheme,
  useWindowDimensions,
  ActivityIndicator,
  Image,
  Platform,
  KeyboardAvoidingView,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import {
  ArrowLeft,
  ArrowUpRight,
  AlertCircle,
  Sparkles,
  Sun,
  Moon,
  ShieldCheck,
  Eye,
  EyeOff,
  Check,
} from "lucide-react-native";
import { router } from "expo-router";
import { tokens } from "@tracksy/ui";
import { usePreferences } from "../lib/state";
import type { Group, Currency } from "@tracksy/domain";
import { formatMoney } from "@tracksy/finance";
import { Atmosphere, BrandMark, SharedLifeArt } from "./brand";
import { FormScroll, KeyboardFrame } from "./keyboard";

export function useColors() {
  const system = useColorScheme();
  const pref = usePreferences((s) => s.theme);
  return tokens[
    pref === "system" ? (system === "dark" ? "dark" : "light") : pref
  ];
}
export function Label({
  children,
  muted = false,
  size = 15,
  weight = "400",
  style,
}: {
  children: ReactNode;
  muted?: boolean;
  size?: number;
  weight?: "400" | "500" | "600" | "700" | "800";
  style?: object;
}) {
  const c = useColors();
  return (
    <Text
      style={[
        {
          color: muted ? c.muted : c.text,
          fontSize: size,
          fontWeight: weight,
          flexShrink: 1,
          lineHeight: Math.round(size * 1.32),
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: ViewStyle;
}) {
  const c = useColors();
  return (
    <View
      style={[
        s.card,
        {
          backgroundColor: c.surface,
          borderColor: c.border,
          shadowColor: "#050619",
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export function Button({
  title,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  icon,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
}) {
  const c = useColors();
  const bg =
    variant === "primary"
      ? c.gold
      : variant === "danger"
        ? "#b42335"
        : c.surface;
  const foreground = variant === "secondary" ? c.text : c.onPrimary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        {
          backgroundColor: bg,
          borderColor:
            variant === "secondary"
              ? c.border
              : variant === "primary"
                ? c.goldEdge
                : bg,
          opacity: disabled || loading ? 0.6 : pressed ? 0.85 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <>
          {icon}
          <Text
            style={{
              fontSize: 15,
              fontWeight: "600",
              flexShrink: 1,
              lineHeight: 22,
              color: foreground,
              textAlign: "center",
            }}
          >
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}
export function TextLink({
  title,
  onPress,
}: {
  title: string;
  onPress: () => void;
}) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 44,
        justifyContent: "center",
        paddingVertical: 8,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Label size={13} weight="600" style={{ color: c.primary }}>
        {title}
      </Label>
    </Pressable>
  );
}
export function Field({
  label,
  error,
  secureTextEntry,
  leading,
  hideLabel = false,
  ...props
}: TextInputProps & {
  label: string;
  error?: string;
  leading?: ReactNode;
  hideLabel?: boolean;
}) {
  const c = useColors();
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  return (
    <View style={{ gap: 8, marginBottom: 8, minWidth: 0 }}>
      {!hideLabel && (
        <Label size={13} weight="500">
          {label}
        </Label>
      )}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          borderRadius: 14,
          borderWidth: 1,
          borderColor: error ? c.danger : focused ? c.primary : c.border,
          backgroundColor: c.surface,
        }}
      >
        {leading && <View style={{ paddingLeft: 16 }}>{leading}</View>}
        <TextInput
          placeholderTextColor={c.muted}
          accessibilityLabel={label}
          {...props}
          secureTextEntry={secureTextEntry && !visible}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          style={[
            s.input,
            { color: c.text, flex: 1, minWidth: 0 },
            props.style,
          ]}
        />
        {secureTextEntry && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={visible ? "Hide password" : "Show password"}
            onPress={() => setVisible(!visible)}
            style={{
              width: 46,
              height: 46,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {visible ? (
              <EyeOff size={18} color={c.muted} />
            ) : (
              <Eye size={18} color={c.muted} />
            )}
          </Pressable>
        )}
      </View>
      {error && (
        <Label size={12} style={{ color: c.danger }}>
          {error}
        </Label>
      )}
    </View>
  );
}
export function Chips<T extends string>({
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
    <View style={s.wrap}>
      {options.map((o) => (
        <Pressable
          key={o}
          accessibilityRole="radio"
          accessibilityState={{ selected: o === value }}
          onPress={() => onChange(o)}
          style={[
            s.chip,
            {
              borderColor: o === value ? c.primary : c.border,
              backgroundColor: o === value ? c.tint : c.surface,
            },
          ]}
        >
          {o === value && <Check size={13} color={c.primary} />}
          <Label
            size={13}
            weight="500"
            style={{ color: o === value ? c.primary : c.muted }}
          >
            {o}
          </Label>
        </Pressable>
      ))}
    </View>
  );
}
export function Brand() {
  return (
    <View style={[s.row, { gap: 10 }]}>
      <BrandMark size={32} />
      <Label size={22} weight="700">
        Tracksy
      </Label>
    </View>
  );
}
export function ThemeToggle() {
  const c = useColors();
  const setTheme = usePreferences((s) => s.setTheme);
  const dark = c.background === tokens.dark.background;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Switch to ${dark ? "light" : "dark"} theme`}
      onPress={() => setTheme(dark ? "light" : "dark")}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.surface,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.6 : 1,
      })}
    >
      {dark ? (
        <Sun size={19} color={c.gold} />
      ) : (
        <Moon size={19} color={c.primary} />
      )}
    </Pressable>
  );
}
export function Screen({
  children,
  title,
  subtitle,
  action,
  back = false,
  header = true,
  footer,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  back?: boolean;
  header?: boolean;
  footer?: ReactNode;
}) {
  const c = useColors();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: c.background }}
    >
      <KeyboardFrame style={{ flex: 1 }}>
        {header && (
          <View
            style={{
              backgroundColor: c.background,
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderBottomWidth: 1,
              borderBottomColor: c.border,
            }}
          >
            <View
              style={{
                width: "100%",
                maxWidth: 600,
                alignSelf: "center",
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                minHeight: 48,
              }}
            >
              {back && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Go back"
                  onPress={() =>
                    router.canGoBack() ? router.back() : router.replace("/")
                  }
                  hitSlop={4}
                  style={{
                    width: 44,
                    height: 44,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <ArrowLeft size={23} color={c.text} />
                </Pressable>
              )}
              <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                <Label size={20} weight="700">
                  {title}
                </Label>
                {subtitle && (
                  <Label size={12} muted>
                    {subtitle}
                  </Label>
                )}
              </View>
              {action && <View style={{ flexShrink: 0 }}>{action}</View>}
            </View>
          </View>
        )}
        <FormScroll
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{
            padding: width < 600 ? 16 : 24,
            paddingBottom: footer ? 24 : 24 + insets.bottom,
            flexGrow: 1,
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: width < 900 ? 600 : 1040,
              alignSelf: "center",
              gap: 18,
            }}
          >
            {children}
          </View>
        </FormScroll>
        {footer && (
          <View
            style={{
              backgroundColor: c.surface,
              borderTopWidth: 1,
              borderTopColor: c.border,
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: Math.max(12, insets.bottom),
            }}
          >
            <View
              style={{
                width: "100%",
                maxWidth: 600,
                alignSelf: "center",
                gap: 10,
              }}
            >
              {footer}
            </View>
          </View>
        )}
      </KeyboardFrame>
    </SafeAreaView>
  );
}
export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View style={{ gap: 15 }}>
      <View
        style={[s.row, { justifyContent: "space-between", flexWrap: "wrap" }]}
      >
        <Label size={18} weight="700">
          {title}
        </Label>
        {action}
      </View>
      {children}
    </View>
  );
}
export function Empty({
  title,
  body,
  action,
  artwork,
}: {
  title: string;
  body: string;
  action?: ReactNode;
  artwork?: "friends" | "settled";
}) {
  return (
    <Card style={{ alignItems: "center", padding: 26, gap: 12 }}>
      {artwork && (
        <Image
          accessible={false}
          source={
            artwork === "friends"
              ? require("../../assets/illustrations/friends-cafe-v1.png")
              : require("../../assets/illustrations/settled-notebook-v1.png")
          }
          resizeMode="contain"
          style={{ width: 168, height: 112 }}
        />
      )}
      <Label weight="700" size={22} style={{ textAlign: "center" }}>
        {title}
      </Label>
      <Label
        muted
        size={14}
        style={{ textAlign: "center", maxWidth: 350, marginBottom: 6 }}
      >
        {body}
      </Label>
      {action}
    </Card>
  );
}
export function Loading() {
  const c = useColors();
  return (
    <View
      accessibilityLabel="Loading"
      style={{ padding: 50, alignItems: "center", gap: 16 }}
    >
      <ActivityIndicator color={c.primary} />
      <Label muted>Loading…</Label>
    </View>
  );
}
export function ErrorBox({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  const c = useColors();
  return (
    <Card style={{ gap: 12, borderColor: c.danger }}>
      <AlertCircle color={c.danger} size={20} />
      <Label style={{ color: c.danger }}>{message}</Label>
      {retry && (
        <Button title="Try again" onPress={retry} variant="secondary" />
      )}
    </Card>
  );
}
export function Notice({ children }: { children: ReactNode }) {
  const c = useColors();
  return (
    <View
      style={{
        padding: 15,
        borderRadius: 15,
        backgroundColor: c.tint,
        borderWidth: 1,
        borderColor: c.border,
      }}
    >
      <Label size={13} style={{ color: c.primary }}>
        {children}
      </Label>
    </View>
  );
}
export function GroupCard({
  group,
  balance = 0,
  balances,
  premium = false,
  count,
}: {
  group: Group;
  balance?: number;
  balances?: { currency: Currency; amount: number }[];
  premium?: boolean;
  count?: number;
}) {
  const c = useColors(),
    amounts = balances?.length
      ? balances
      : [{ currency: group.currency, amount: balance }];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={"Open " + group.name}
      onPress={() => router.push(`/group/${group.id}`)}
      style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
    >
      <Card style={{ padding: 16, gap: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 15,
              backgroundColor: c.tint,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Label size={25}>{group.icon}</Label>
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <Label size={16} weight="700">
              {group.name}
            </Label>
            <Label muted size={12}>
              {group.archived_at
                ? "Archived"
                : group.kind.charAt(0).toUpperCase() + group.kind.slice(1)}
              {count !== undefined ? " · " + count + " members" : ""}
            </Label>
          </View>
          {premium && <Badge text="PLUS" />}
          <ArrowUpRight size={17} color={c.muted} />
        </View>
        <View
          style={{
            gap: 10,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: c.border,
          }}
        >
          {amounts.map(({ currency, amount }) => (
            <View
              key={currency}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <Label muted size={13}>
                {amount < 0
                  ? "You owe"
                  : amount > 0
                    ? "You are owed"
                    : "Settled up"}
              </Label>
              <Label
                size={20}
                weight="700"
                style={{
                  color:
                    amount < 0 ? c.danger : amount > 0 ? c.primary : c.muted,
                  fontVariant: ["tabular-nums"],
                  textAlign: "right",
                }}
              >
                {formatMoney(Math.abs(amount), currency)}
              </Label>
            </View>
          ))}
        </View>
      </Card>
    </Pressable>
  );
}

export function Badge({ text }: { text: string }) {
  const c = useColors();
  return (
    <View
      style={[
        s.row,
        {
          alignSelf: "flex-start",
          gap: 5,
          paddingHorizontal: 10,
          paddingVertical: 6,
          backgroundColor: c.tint,
          borderWidth: 1,
          borderColor: c.border,
          borderRadius: 9,
        },
      ]}
    >
      <Label
        size={9}
        weight="700"
        style={{ color: c.primary, letterSpacing: 1 }}
      >
        {text}
      </Label>
    </View>
  );
}
export function Money({
  amount,
  currency,
  size = 28,
}: {
  amount: number;
  currency: Currency;
  size?: number;
}) {
  return (
    <Label
      size={size}
      weight="700"
      style={{ fontVariant: ["tabular-nums"], letterSpacing: -0.7 }}
    >
      {formatMoney(amount, currency)}
    </Label>
  );
}
export const s = StyleSheet.create({
  card: {
    padding: 18,
    borderWidth: 1,
    borderRadius: 20,
    flexShrink: 0,
    minWidth: 0,
    maxWidth: "100%",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minWidth: 0 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  button: {
    minHeight: 52,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    flexShrink: 0,
    minWidth: 0,
    maxWidth: "100%",
  },
  input: {
    minHeight: 51,
    paddingHorizontal: 15,
    paddingVertical: 13,
    borderRadius: 14,
    fontSize: 15,
    fontFamily: Platform.OS === "android" ? "sans-serif" : undefined,
    ...Platform.select({ web: { outlineStyle: "none" } as object }),
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 13,
    borderWidth: 1,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  col: { flexGrow: 1, flexShrink: 1, flexBasis: 270, minWidth: 0 },
  divider: { height: 1, marginVertical: 16 },
});
