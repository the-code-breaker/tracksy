import { useState } from "react";
import { router } from "expo-router";
import { supabase } from "../../src/lib/supabase";
import { Screen, Field, Button, ErrorBox } from "../../src/components/ui";
import { useInvitation } from "../../src/lib/state";
import { returnAfterAuth } from "../../src/lib/auth-return";
export default function Password() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false),
    invitation = useInvitation((s) => s.token);
  return (
    <Screen title="Choose a new password">
      <Field
        label="New password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error && <ErrorBox message={error} />}
      <Button
        title="Save password"
        loading={busy}
        disabled={password.length < 12}
        onPress={async () => {
          if (busy) return;
          setBusy(true);
          setError("");
          try {
            const { error } = await supabase.auth.updateUser({ password });
            if (error) setError(error.message);
            else router.replace(returnAfterAuth(false, invitation));
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
    </Screen>
  );
}
