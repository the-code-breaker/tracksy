import { useState } from "react";
import { Modal, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { useAccount, accountName } from "../lib/account";
import { supabase } from "../lib/supabase";
import { Label, Field, Button, ErrorBox, useColors } from "./ui";
import { FormScroll, KeyboardFrame } from "./keyboard";
export function NameRequired() {
  const { session } = useAuth(),
    q = useAccount(),
    cache = useQueryClient(),
    c = useColors(),
    [name, setName] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const required =
    !!session &&
    !!q.data &&
    !accountName(session.user, q.data.profile.display_name);
  return (
    <Modal visible={required} animationType="fade" onRequestClose={() => {}}>
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: c.background,
          justifyContent: "center",
          padding: 24,
        }}
      >
        <KeyboardFrame style={{ flex: 1 }}>
          <FormScroll
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: "center",
              paddingVertical: 16,
            }}
          >
            <View
              style={{
                width: "100%",
                maxWidth: 420,
                alignSelf: "center",
                gap: 18,
              }}
            >
              <Label size={26} weight="700">
                What should we call you?
              </Label>
              <Label muted size={14}>
                Add your name so friends can recognize you in groups and
                expenses.
              </Label>
              <Field
                label="Full name"
                value={name}
                onChangeText={setName}
                maxLength={80}
                autoCapitalize="words"
                autoComplete="name"
              />
              {error && <ErrorBox message={error} />}
              <Button
                title="Continue"
                disabled={!name.trim()}
                loading={busy}
                onPress={async () => {
                  if (busy) return;
                  setBusy(true);
                  setError("");
                  try {
                    const r = await supabase
                      .from("profiles")
                      .update({
                        display_name: name.trim(),
                        updated_at: new Date().toISOString(),
                      })
                      .eq("id", session!.user.id);
                    if (r.error) throw r.error;
                    await cache.invalidateQueries({
                      queryKey: ["profile", session!.user.id],
                    });
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </View>
          </FormScroll>
        </KeyboardFrame>
      </SafeAreaView>
    </Modal>
  );
}
