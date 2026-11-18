import "../global.css";
import "react-native-gesture-handler";
import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "../src/lib/auth";
import { useColors } from "../src/components/ui";
import { StatusBar } from "expo-status-bar";
import { useRealtime } from "../src/lib/data";
import * as Sentry from "@sentry/react-native";
import { useEffect } from "react";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import { useInvitation } from "../src/lib/state";
import { tokens } from "@tracksy/ui";
import * as SplashScreen from "expo-splash-screen";
import { useAccount } from "../src/lib/account";
import { usePreferences } from "../src/lib/state";
import { NameRequired } from "../src/components/name-required";
import { KeyboardRoot } from "../src/components/keyboard";
SplashScreen.preventAutoHideAsync().catch(() => {});
if (process.env.EXPO_PUBLIC_SENTRY_DSN)
  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    sendDefaultPii: false,
    tracesSampleRate: 0.05,
  });
const client = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30000 },
    mutations: { retry: 0 },
  },
});
function Routes() {
  const c = useColors();
  const { session, loading } = useAuth();
  const url = Linking.useURL();
  const rememberInvite = useInvitation((s) => s.setToken);
  const account = useAccount();
  useEffect(() => {
    if (Platform.OS !== "web") return;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", c.background);
    document.body.style.backgroundColor = c.background;
    document.documentElement.style.colorScheme =
      c.background === tokens.dark.background ? "dark" : "light";
  }, [c.background]);
  useEffect(() => {
    if (account.data)
      usePreferences.setState({
        theme: account.data.preferences.theme,
        language: account.data.profile.language,
      });
  }, [account.data]);
  useEffect(() => {
    if (!loading) void SplashScreen.hideAsync().catch(() => {});
  }, [loading]);
  useEffect(() => {
    if (!url) return;
    try {
      const link = new URL(url);
      const token = link.searchParams.get("token");
      if (
        token &&
        /^[a-f0-9]{64}$/.test(token) &&
        (link.pathname.replace(/\/+$/, "") === "/join" ||
          link.hostname === "join")
      )
        rememberInvite(token);
    } catch {}
  }, [url, rememberInvite]);
  useRealtime();
  if (loading) return null;
  return (
    <>
      <StatusBar
        style={c.background === tokens.dark.background ? "light" : "dark"}
      />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: c.background },
        }}
      >
        <Stack.Screen name="auth" />
        <Stack.Protected guard={!loading && !!session}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="group" />
          <Stack.Screen name="expense" />
          <Stack.Screen name="settle" />
          <Stack.Screen name="join" />
          <Stack.Screen name="plus" />
          <Stack.Screen name="recurring" />
          <Stack.Screen name="rules" />
        </Stack.Protected>
      </Stack>
      <NameRequired />
    </>
  );
}
export default Sentry.wrap(function Layout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <KeyboardRoot>
          <QueryClientProvider client={client}>
            <AuthProvider>
              <Routes />
            </AuthProvider>
          </QueryClientProvider>
        </KeyboardRoot>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
});
