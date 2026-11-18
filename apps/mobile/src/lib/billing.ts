import { Platform } from "react-native";
import Purchases, { type PurchasesPackage } from "react-native-purchases";
import { rpc } from "./supabase";
let configuredFor: string | undefined;
export async function billing(userId: string) {
  if (Platform.OS === "web")
    throw new Error(
      "Store purchases are available in the Android and iOS development builds.",
    );
  const apiKey =
    Platform.OS === "ios"
      ? process.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY
      : process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY;
  if (!apiKey) throw new Error("Store billing is not configured yet.");
  if (configuredFor !== userId) {
    if (configuredFor) await Purchases.logIn(userId);
    else Purchases.configure({ apiKey, appUserID: userId });
    configuredFor = userId;
  }
  return Purchases;
}
export async function purchaseGroup(
  userId: string,
  groupId: string,
  pkg: PurchasesPackage,
) {
  await rpc("begin_group_purchase", {
    p_group: groupId,
    p_product: pkg.product.identifier,
  });
  const client = await billing(userId);
  await client.purchasePackage(
    pkg,
  ); /* No entitlement is granted from SDK booleans. Wait for verified server webhook. */
}
