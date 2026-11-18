import { useEffect, useState } from "react";
import {
  View,
  Platform,
  Keyboard,
  Image,
  useWindowDimensions,
} from "react-native";
import { Mail, LockKeyhole, UserRound, ArrowLeft } from "lucide-react-native";
import { Redirect } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { authSchema, loginSchema } from "@tracksy/validation";
import {
  supabase,
  isConfigured,
  exchangeAuthCode,
} from "../../src/lib/supabase";
import { useAuth } from "../../src/lib/auth";
import {
  Screen,
  Card,
  Label,
  Button,
  Field,
  ErrorBox,
  Notice,
  TextLink,
  Brand,
  ThemeToggle,
  useColors,
} from "../../src/components/ui";
import { tripArt, GoogleMark, IconButton } from "../../src/components/mobile";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { useInvitation } from "../../src/lib/state";
import { privacyPolicyUrl } from "../../src/lib/support";
import { authErrorMessage } from "../../src/lib/auth-errors";
WebBrowser.maybeCompleteAuthSession();
export default function Auth() {
  const { session } = useAuth();
  const invitation = useInvitation((s) => s.token);
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [fullName, setFullName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const { height } = useWindowDimensions();
  const colors = useColors();
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () =>
      setKeyboardVisible(true),
    );
    const hide = Keyboard.addListener("keyboardDidHide", () =>
      setKeyboardVisible(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const [pendingEmail, setPendingEmail] = useState("");
  const [resendAfter, setResendAfter] = useState(0);
  const [now, setNow] = useState(Date.now());
  const resendWait = Math.max(0, Math.ceil((resendAfter - now) / 1000));
  useEffect(() => {
    if (!resendAfter) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [resendAfter]);
  const { control, handleSubmit, getValues, clearErrors } = useForm({
    resolver: zodResolver(mode === "signup" ? authSchema : loginSchema),
    defaultValues: { email: "", password: "" },
  });
  if (session)
    return (
      <Redirect
        href={
          invitation
            ? { pathname: "/join", params: { token: invitation } }
            : "/"
        }
      />
    );
  const redirect =
    Platform.OS === "web"
      ? Linking.createURL("/auth/callback")
      : process.env.EXPO_PUBLIC_AUTH_REDIRECT || "tracksy://auth/callback";
  async function submit(v: { email: string; password: string }) {
    Keyboard.dismiss();
    setError("");
    setNotice("");
    if (mode === "signup" && !fullName.trim()) {
      setError("Enter your full name.");
      return;
    }
    if (mode === "signup" && v.password !== confirmPassword) {
      setError("Your passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const result =
        mode === "signup"
          ? await supabase.auth.signUp({
              ...v,
              options: {
                emailRedirectTo: redirect,
                data: {
                  display_name: fullName.trim(),
                  full_name: fullName.trim(),
                },
              },
            })
          : await supabase.auth.signInWithPassword(v);
      if (result.error) {
        if (result.error.code === "email_not_confirmed")
          setPendingEmail(v.email);
        throw result.error;
      }
      if (mode === "signup" && !result.data.session) {
        setPendingEmail(v.email);
        setResendAfter(Date.now() + 60000);
        setNow(Date.now());
        setMode("login");
        clearErrors();
        setNotice(
          `Check ${v.email} for a confirmation link. Open it on this phone, then sign in. Check Spam if the email is missing.`,
        );
      }
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function oauth(provider: "google" | "apple") {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirect,
          skipBrowserRedirect: Platform.OS !== "web",
          queryParams:
            provider === "google" ? { prompt: "select_account" } : undefined,
        },
      });
      if (error) throw error;
      if (data.url && Platform.OS !== "web") {
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirect,
        );
        if (result.type === "success") {
          const parsed = new URL(result.url);
          const failure = parsed.searchParams.get("error_description");
          if (failure) throw new Error(failure);
          const code = parsed.searchParams.get("code");
          if (code) {
            const response = await exchangeAuthCode(code);
            if (response.error) throw response.error;
          } else
            throw new Error("Google sign-in did not finish. Please try again.");
        } else if (result.type === "cancel" || result.type === "dismiss") {
          setNotice("Google sign-in was cancelled. You can try again.");
        }
      }
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function resetPassword() {
    Keyboard.dismiss();
    setError("");
    setNotice("");
    const email = authSchema.shape.email.safeParse(getValues("email"));
    if (!email.success) {
      setError("Enter a valid email address to receive a reset link.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.data, {
        redirectTo: redirect + "?recovery=true",
      });
      if (error) throw error;
      setNotice("If that account exists, a reset link is on its way.");
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function resendConfirmation() {
    const email = loginSchema.shape.email.safeParse(getValues("email"));
    if (!email.success) {
      setError("Enter a valid email address to resend confirmation.");
      return;
    }
    Keyboard.dismiss();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.data,
        options: { emailRedirectTo: redirect },
      });
      if (error) throw error;
      setPendingEmail(email.data);
      setResendAfter(Date.now() + 60000);
      setNow(Date.now());
      setNotice(
        `If ${email.data} is awaiting confirmation, a new link is on its way. Open it on this phone, then sign in.`,
      );
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen title="Sign in" header={false}>
      <View
        style={{ width: "100%", maxWidth: 420, alignSelf: "center", gap: 14 }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingVertical: 4,
          }}
        >
          {mode !== "login" ? (
            <IconButton
              label="Go back"
              onPress={() => {
                setMode("login");
                clearErrors();
                setError("");
                setNotice("");
              }}
            >
              <ArrowLeft size={22} color={colors.text} />
            </IconButton>
          ) : (
            <View style={{ width: 44 }} />
          )}
          <Brand />
          <ThemeToggle />
        </View>
        {mode === "login" && !keyboardVisible && (
          <Image
            source={tripArt}
            accessibilityLabel="Friends overlooking a mountain lake"
            style={{
              width: "100%",
              height: height < 680 ? 135 : 190,
              borderRadius: 23,
            }}
            resizeMode="cover"
          />
        )}
        <View style={{ gap: 6, paddingTop: mode === "login" ? 2 : 15 }}>
          {mode === "login" && (
            <Label size={12} style={{ color: colors.primary }} weight="600">
              Welcome back
            </Label>
          )}
          <Label
            size={mode === "login" ? 30 : 26}
            weight="700"
            style={{ letterSpacing: -0.8 }}
          >
            {mode === "signup"
              ? "Create your account"
              : mode === "reset"
                ? "Reset your password"
                : "Split smarter.\nTravel happier."}
          </Label>
          <Label muted size={14}>
            {mode === "signup"
              ? "Join friends, families and housemates to start splitting expenses."
              : mode === "reset"
                ? "We’ll send a secure reset link to your email."
                : "Shared expenses with friends, family and housemates. More moments. Less math."}
          </Label>
        </View>
        {mode !== "reset" && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
            }}
          >
            <Label muted size={12}>
              {mode === "signup"
                ? "Already part of Tracksy?"
                : "New to Tracksy?"}
            </Label>
            <TextLink
              title={
                mode === "signup"
                  ? "Already have an account? Sign in"
                  : "Create an account"
              }
              onPress={() => {
                setMode(mode === "signup" ? "login" : "signup");
                clearErrors();
                setError("");
                setNotice("");
                setPendingEmail("");
              }}
            />
          </View>
        )}
        {error && <ErrorBox message={error} />}
        {notice && <Notice>{notice}</Notice>}
        {!isConfigured && (
          <Notice>
            Sign-in is temporarily unavailable. Please try again later.
          </Notice>
        )}
        <View style={{ gap: 5 }}>
          {mode === "signup" && (
            <Field
              label="Full name"
              hideLabel
              placeholder="Full name"
              leading={<UserRound size={18} color={colors.muted} />}
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              maxLength={80}
            />
          )}
          <Controller
            control={control}
            name="email"
            render={({ field, fieldState }) => (
              <Field
                label="Email address"
                hideLabel
                placeholder="Email address"
                leading={<Mail size={18} color={colors.muted} />}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                textContentType="emailAddress"
                autoCorrect={false}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
              />
            )}
          />
          {mode !== "reset" && (
            <Controller
              control={control}
              name="password"
              render={({ field, fieldState }) => (
                <Field
                  label="Password"
                  hideLabel
                  placeholder={
                    mode === "signup"
                      ? "Password · at least 12 characters"
                      : "Password"
                  }
                  leading={<LockKeyhole size={18} color={colors.muted} />}
                  secureTextEntry
                  autoComplete={
                    mode === "signup" ? "new-password" : "current-password"
                  }
                  textContentType={
                    mode === "signup" ? "newPassword" : "password"
                  }
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message}
                />
              )}
            />
          )}
          {mode === "signup" && (
            <>
              <Field
                label="Confirm password"
                hideLabel
                placeholder="Confirm password"
                leading={<LockKeyhole size={18} color={colors.muted} />}
                secureTextEntry
                autoComplete="new-password"
                textContentType="newPassword"
                autoCapitalize="none"
                autoCorrect={false}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
              <Label muted size={11}>
                Use at least 12 characters for your password.
              </Label>
            </>
          )}
          {mode === "login" && (
            <View style={{ alignSelf: "flex-end" }}>
              <TextLink
                title="Forgot your password?"
                onPress={() => {
                  setMode("reset");
                  clearErrors();
                  setError("");
                  setNotice("");
                }}
              />
            </View>
          )}
          <Button
            title={
              mode === "signup"
                ? "Create account"
                : mode === "reset"
                  ? "Send reset email"
                  : "Sign in"
            }
            loading={busy}
            disabled={!isConfigured}
            onPress={
              mode === "reset"
                ? () => void resetPassword()
                : handleSubmit(submit, () => Keyboard.dismiss())
            }
          />
          {mode === "login" && !!pendingEmail && (
            <Button
              title={
                resendWait
                  ? `Resend confirmation in ${resendWait}s`
                  : "Resend confirmation email"
              }
              variant="secondary"
              disabled={busy || resendWait > 0}
              onPress={() => void resendConfirmation()}
            />
          )}
        </View>
        {mode !== "reset" &&
          process.env.EXPO_PUBLIC_GOOGLE_AUTH_ENABLED === "true" && (
            <>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  marginVertical: 1,
                }}
              >
                <View
                  style={{ height: 1, flex: 1, backgroundColor: colors.border }}
                />
                <Label muted size={12}>
                  or continue with
                </Label>
                <View
                  style={{ height: 1, flex: 1, backgroundColor: colors.border }}
                />
              </View>
              <Button
                title="Continue with Google"
                variant="secondary"
                icon={<GoogleMark />}
                disabled={!isConfigured || busy}
                onPress={() => void oauth("google")}
              />
            </>
          )}
        {mode !== "reset" &&
          Platform.OS === "ios" &&
          process.env.EXPO_PUBLIC_APPLE_AUTH_ENABLED === "true" && (
            <Button
              title="Continue with Apple"
              variant="secondary"
              disabled={!isConfigured || busy}
              onPress={() => void oauth("apple")}
            />
          )}
        {mode === "reset" && (
          <TextLink
            title="Back to sign in"
            onPress={() => {
              setMode("login");
              setError("");
              setNotice("");
            }}
          />
        )}
        <View style={{ alignItems: "center", gap: 0, paddingTop: 2 }}>
          <Label muted size={11} style={{ textAlign: "center" }}>
            Your shared expenses. Your privacy.
          </Label>
          <TextLink
            title="Privacy policy"
            onPress={() => void Linking.openURL(privacyPolicyUrl)}
          />
        </View>
      </View>
    </Screen>
  );
}
