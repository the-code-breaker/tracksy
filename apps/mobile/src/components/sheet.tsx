import type { ReactNode } from "react";
import {
  Modal,
  View,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { Label, useColors } from "./ui";
import { FormScroll, KeyboardFrame } from "./keyboard";
export function Sheet({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const c = useColors();
  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardFrame
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "#00000066",
        }}
      >
        <Pressable
          accessibilityLabel="Dismiss sheet"
          accessibilityRole="button"
          onPress={onClose}
          style={{ flex: 1 }}
        />
        <SafeAreaView
          edges={["bottom", "left", "right"]}
          style={{
            maxHeight: "88%",
            flexShrink: 1,
            minHeight: 0,
            overflow: "hidden",
            backgroundColor: c.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 20,
            paddingTop: 12,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 16,
              paddingBottom: 14,
              flexShrink: 0,
              backgroundColor: c.surface,
              zIndex: 1,
            }}
          >
            <Label size={20} weight="700" style={{ flex: 1 }}>
              {title}
            </Label>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close sheet"
              onPress={onClose}
              style={{
                width: 44,
                height: 44,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={22} color={c.text} />
            </Pressable>
          </View>
          <FormScroll
            style={{ flexShrink: 1, minHeight: 0 }}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: 16, paddingBottom: 12 }}
          >
            {children}
          </FormScroll>
        </SafeAreaView>
      </KeyboardFrame>
    </Modal>
  );
}
