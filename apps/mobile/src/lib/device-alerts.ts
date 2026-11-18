import { Platform, AppState } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { readCached, writeCached, removeCached } from "./cache-storage";
import { supabase } from "./supabase";
let enabled = false;
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});
export async function readPhoneAlerts(user: string) {
  if (Platform.OS === "web") return { allowed: false, enabled: false };
  const permission = await Notifications.getPermissionsAsync();
  enabled =
    permission.granted &&
    (await readCached(`tracksy.alerts.${user}`)) === "true";
  return { allowed: permission.granted, enabled };
}
export async function setPhoneAlerts(user: string, value: boolean) {
  if (Platform.OS === "web")
    throw Error("Phone alerts are available in the Android app.");
  if (!value) {
    enabled = false;
    await writeCached(`tracksy.alerts.${user}`, "false");
    const token = await readCached(`tracksy.push-token.${user}`);
    if (token) {
      const r = await supabase
        .from("user_devices")
        .delete()
        .eq("user_id", user)
        .eq("push_token", token);
      if (r.error) throw r.error;
      await removeCached(`tracksy.push-token.${user}`);
    }
    return false;
  }
  if (Platform.OS === "android")
    await Notifications.setNotificationChannelAsync("default", {
      name: "Group activity",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && permission.canAskAgain)
    permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted)
    throw Error(
      "Notifications are blocked. Allow Tracksy notifications in your phone settings.",
    );
  const projectId = Constants.easConfig?.projectId;
  if (projectId) {
    const token = (await Notifications.getExpoPushTokenAsync({ projectId }))
      .data;
    const r = await supabase
      .from("user_devices")
      .insert({ user_id: user, push_token: token, platform: Platform.OS });
    if (r.error && r.error.code !== "23505") throw r.error;
    await writeCached(`tracksy.push-token.${user}`, token);
  }
  enabled = true;
  await writeCached(`tracksy.alerts.${user}`, "true");
  return true;
}
export async function showOpenAppAlert(
  body = "There is a new update in one of your groups.",
) {
  if (Platform.OS === "web" || !enabled || AppState.currentState !== "active")
    return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Tracksy",
      body,
      ...(Platform.OS === "android" ? { channelId: "default" } : {}),
    },
    trigger: null,
  }).catch(() => {});
}
export const backgroundAlertsConfigured = Boolean(
  Constants.easConfig?.projectId,
);
