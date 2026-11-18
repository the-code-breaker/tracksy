import React, { useState } from "react";
import { View, Pressable, Platform, Keyboard } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { CalendarDays } from "lucide-react-native";
import { Label, useColors, TextLink } from "./ui";
import { localDate } from "../lib/dates";
export function DateField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const c = useColors(),
    [open, setOpen] = useState(false),
    date = new Date(`${value}T12:00:00`);
  if (Platform.OS === "web")
    return (
      <View style={{ gap: 7 }}>
        <Label size={12} muted>
          Date
        </Label>
        {React.createElement("input", {
          type: "date",
          "aria-label": "Expense date",
          value,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            onChange(e.target.value),
          style: {
            fontFamily: "inherit",
            fontSize: 14,
            padding: 14,
            borderRadius: 14,
            border: "1px solid " + c.border,
            background: c.surface,
            color: c.text,
            minHeight: 48,
            width: "100%",
            boxSizing: "border-box",
          },
        })}
      </View>
    );
  return (
    <View style={{ gap: 7 }}>
      <Label size={12} muted>
        Date
      </Label>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Choose expense date"
        onPress={() => {
          Keyboard.dismiss();
          setOpen(true);
        }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          minHeight: 52,
          padding: 14,
          borderWidth: 1,
          borderColor: c.border,
          borderRadius: 16,
          backgroundColor: c.surface,
        }}
      >
        <CalendarDays size={19} color={c.muted} />
        <Label size={14}>
          {date.toLocaleDateString(undefined, {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </Label>
      </Pressable>
      {open && (
        <DateTimePicker
          value={isNaN(date.getTime()) ? new Date() : date}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(event, selected) => {
            if (Platform.OS === "android") setOpen(false);
            if (event.type === "set" && selected) onChange(localDate(selected));
          }}
        />
      )}
      {open && Platform.OS === "ios" && (
        <TextLink title="Done" onPress={() => setOpen(false)} />
      )}
    </View>
  );
}
