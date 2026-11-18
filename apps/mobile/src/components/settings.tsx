import type { ReactNode } from "react";
import { View, Pressable, Switch, ActivityIndicator } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { Label, useColors } from "./ui";

export function SettingsRow({
  title,
  subtitle,
  icon,
  value,
  onPress,
  danger = false,
  last = false,
  disabled = false,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  last?: boolean;
  disabled?: boolean;
}) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={title}
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityState={{ disabled: disabled || !onPress }}
      style={({ pressed }) => ({
        minHeight: 60,
        paddingVertical: 14,
        paddingHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
        gap: 13,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: c.border,
        backgroundColor: pressed ? c.surfaceAlt : c.surface,
        opacity: disabled ? 0.55 : 1,
      })}
    >
      {icon && <View style={{ width: 26, alignItems: "center" }}>{icon}</View>}
      <View style={{ flex: 1, gap: 3 }}>
        <Label
          size={14}
          weight="500"
          style={{ color: danger ? c.danger : c.text }}
        >
          {title}
        </Label>
        {subtitle && (
          <Label size={12} muted>
            {subtitle}
          </Label>
        )}
      </View>
      {value && (
        <Label size={12} muted style={{ maxWidth: 130, textAlign: "right" }}>
          {value}
        </Label>
      )}
      {onPress && <ChevronRight size={16} color={c.muted} />}
    </Pressable>
  );
}
export function ToggleRow({
  title,
  subtitle,
  value,
  onChange,
  disabled = false,
  last = false,
  pending = false,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  last?: boolean;
  pending?: boolean;
}) {
  const c = useColors();
  return (
    <View
      style={{
        paddingHorizontal: 16,
        paddingVertical: 13,
        minHeight: 64,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: c.border,
      }}
    >
      <View style={{ flex: 1, gap: 3 }}>
        <Label size={14} weight="500">
          {title}
        </Label>
        {subtitle && (
          <Label size={12} muted>
            {subtitle}
          </Label>
        )}
      </View>
      {pending && (
        <ActivityIndicator
          size="small"
          color={c.primary}
          accessibilityLabel={`Saving ${title}`}
        />
      )}
      <Switch
        accessibilityLabel={title}
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: c.border, true: c.gold }}
        thumbColor="#fff"
      />
    </View>
  );
}
export function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const c = useColors();
  return (
    <View style={{ gap: 9 }}>
      <Label size={12} weight="600" muted style={{ paddingHorizontal: 4 }}>
        {title}
      </Label>
      <View
        style={{
          backgroundColor: c.surface,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: c.border,
          overflow: "hidden",
        }}
      >
        {children}
      </View>
    </View>
  );
}
