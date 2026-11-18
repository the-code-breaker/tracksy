import { useEffect, useState } from "react";
import { useLocalSearchParams, router } from "expo-router";
import * as Linking from "expo-linking";
import { exchangeAuthCode } from "../../src/lib/supabase";
import { Screen, Loading, ErrorBox, Button } from "../../src/components/ui";
import { authErrorMessage } from "../../src/lib/auth-errors";
import { useInvitation } from "../../src/lib/state";
import { returnAfterAuth } from "../../src/lib/auth-return";
export default function Callback() {
  const params = useLocalSearchParams<{
    code?: string;
    recovery?: string;
    error_description?: string;
    error?: string;
  }>();
  const url = Linking.useURL();
  const [error, setError] = useState("");
  const invitation = useInvitation((s) => s.token);
  useEffect(() => {
    const parsed = url ? new URL(url) : null;
    const failure =
      params.error_description || parsed?.searchParams.get("error_description");
    if (failure || params.error || parsed?.searchParams.get("error")) {
      setError(failure || "Sign-in was cancelled. Please try again.");
      return;
    }
    const code = params.code || parsed?.searchParams.get("code");
    if (!code) {
      setError(
        "This authentication link is missing its code. Open the email link on the device where you started.",
      );
      return;
    }
    void exchangeAuthCode(code)
      .then(({ error }) => {
        if (error) setError(error.message);
        else
          router.replace(
            returnAfterAuth(
              Boolean(params.recovery || parsed?.searchParams.get("recovery")),
              invitation,
            ),
          );
      })
      .catch((error) => setError(authErrorMessage(error)));
  }, [params.code, url, invitation]);
  return (
    <Screen title="Getting you signed in">
      {error ? (
        <>
          <ErrorBox message={error} />
          <Button
            title="Back to sign in"
            onPress={() => router.replace("/auth")}
          />
        </>
      ) : (
        <Loading />
      )}
    </Screen>
  );
}
