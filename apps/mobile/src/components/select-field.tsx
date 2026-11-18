import { useState } from "react";
import { View, Pressable, Modal, ScrollView, Keyboard } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronDown, Check, X } from "lucide-react-native";
import { Label, useColors } from "./ui";
export function SelectField<T extends string>({
  label,
  value,
  options: choices,
  onChange,
  disabled = false,
  compact = false,
  hideLabel = false,
}: {
  label: string;
  value: T;
  options: readonly (T | { value: T; label: string })[];
  onChange: (value: T) => void;
  disabled?: boolean;
  compact?: boolean;
  hideLabel?: boolean;
}) {
  const c = useColors(),
    [open, setOpen] = useState(false);
  const options = choices.map((o) =>
    typeof o === "string" ? { value: o, label: o } : o,
  );
  return (
    <View style={{ gap: 7, minWidth: 0 }}>
      {!hideLabel && (
        <Label size={12} weight="500" muted>
          {label}
        </Label>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Choose ${label}`}
        disabled={disabled}
        onPress={() => {
          Keyboard.dismiss();
          setOpen(true);
        }}
        style={{
          minHeight: compact ? 44 : 52,
          paddingHorizontal: compact ? 12 : 15,
          paddingVertical: compact ? 8 : 11,
          borderRadius: compact ? 14 : 16,
          backgroundColor: compact ? c.surfaceAlt : c.surface,
          borderWidth: compact ? 0 : 1,
          borderColor: c.border,
          flexDirection: "row",
          alignItems: "center",
          gap: compact ? 6 : 8,
          justifyContent: "space-between",
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <Label
          size={compact ? 12 : 14}
          weight="500"
          style={{
            flex: 1,
            lineHeight: 20,
            ...(compact ? { minWidth: 30 } : {}),
          }}
        >
          {options.find((o) => o.value === value)?.label || "Select"}
        </Label>
        <View
          style={{
            width: 18,
            height: 20,
            flexShrink: 0,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ChevronDown size={16} color={c.muted} />
        </View>
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "#031b2466",
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss options"
            onPress={() => setOpen(false)}
            style={{ flex: 1 }}
          />
          <SafeAreaView
            edges={["bottom", "left", "right"]}
            style={{
              backgroundColor: c.surface,
              borderTopLeftRadius: 26,
              borderTopRightRadius: 26,
              maxHeight: "75%",
              paddingHorizontal: 20,
              paddingTop: 12,
            }}
          >
            <View
              style={{
                width: 38,
                height: 4,
                borderRadius: 2,
                backgroundColor: c.border,
                alignSelf: "center",
                marginBottom: 8,
              }}
            />
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 10,
              }}
            >
              <Label size={20} weight="700">
                {label}
              </Label>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close options"
                onPress={() => setOpen(false)}
                style={{ padding: 12 }}
              >
                <X size={21} color={c.muted} />
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              {options.map((o) => (
                <Pressable
                  key={o.value}
                  accessibilityRole="radio"
                  accessibilityLabel={o.label}
                  accessibilityState={{ selected: value === o.value }}
                  onPress={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  style={{
                    minHeight: 56,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: c.border,
                    paddingVertical: 12,
                  }}
                >
                  <Label
                    size={15}
                    style={{
                      flex: 1,
                      color: value === o.value ? c.primary : c.text,
                    }}
                    weight={value === o.value ? "600" : "400"}
                  >
                    {o.label}
                  </Label>
                  {value === o.value && <Check size={19} color={c.primary} />}
                </Pressable>
              ))}
            </ScrollView>
            <View style={{ height: 16 }} />
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}
