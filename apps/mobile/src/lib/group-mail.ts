import * as Crypto from "expo-crypto";
import { supabase } from "./supabase";
import { supportWebsite } from "./support";
import { hostedAppOrigin } from "./web-origin";
export const invitationUrl = (token: string) =>
  `${supportWebsite.replace(/\/$/, "")}/join/?token=${encodeURIComponent(token)}`;
export function invitationToken(value: string) {
  const input = value.trim();
  if (/^[a-f0-9]{64}$/.test(input)) return input;
  try {
    const url = new URL(input);
    const allowed =
      url.protocol === "tracksy:" ||
      url.origin === supportWebsite.replace(/\/$/, "") ||
      url.origin === hostedAppOrigin ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "localhost";
    const token = url.searchParams.get("token") || "";
    return allowed && /^[a-f0-9]{64}$/.test(token) ? token : "";
  } catch {
    return "";
  }
}
export async function sendGroupMail(body: {
  kind: "invite" | "reminder";
  group_id: string;
  email?: string;
  recipient_id?: string;
  currency?: string;
  request_key?: string;
}) {
  const { data, error } = await supabase.functions.invoke("group-mail", {
    body: { ...body, request_key: body.request_key || Crypto.randomUUID() },
  });
  if (error) {
    let message = "Email could not be sent. Please try again.";
    try {
      const result = await error.context?.json();
      message = result?.error || message;
    } catch {}
    throw new Error(message);
  }
  if (!data?.sent) throw Error("The email was not sent. Please try again.");
  return data as { sent: true; link?: string };
}
