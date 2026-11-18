"use server";
import { redirect } from "next/navigation";
import { serverClient } from "../lib/supabase";
export async function login(form: FormData) {
  const client = await serverClient();
  const email = String(form.get("email") || "");
  const password = String(form.get("password") || "");
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (error) redirect("/login?error=Sign-in%20failed");
  if (data.user?.app_metadata.role !== "admin") {
    await client.auth.signOut();
    redirect("/login?error=Administrator%20access%20required");
  }
  redirect("/mfa");
}
export async function logout() {
  const client = await serverClient();
  await client.auth.signOut({ scope: "local" });
  redirect("/login");
}
export type MfaState = {
  error?: string;
  factorId?: string;
  challengeId?: string;
  qr?: string;
};
export async function prepareMfa(
  _previous: MfaState,
  _form: FormData,
): Promise<MfaState> {
  const client = await serverClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user || user.app_metadata.role !== "admin")
    return { error: "Administrator access required" };
  const { data, error } = await client.auth.mfa.listFactors();
  if (error) return { error: error.message };
  let factorId = data.totp.find((f) => f.status === "verified")?.id;
  let qr: string | undefined;
  if (!factorId) {
    for (const factor of data.all.filter((f) => f.status === "unverified"))
      await client.auth.mfa.unenroll({ factorId: factor.id });
    const result = await client.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Tracksy operations",
    });
    if (result.error) return { error: result.error.message };
    factorId = result.data.id;
    qr = result.data.totp.qr_code;
  }
  const challenge = await client.auth.mfa.challenge({ factorId });
  if (challenge.error) return { error: challenge.error.message };
  return { factorId, challengeId: challenge.data.id, qr };
}
export async function verifyMfa(
  _previous: MfaState,
  form: FormData,
): Promise<MfaState> {
  const client = await serverClient();
  const { error } = await client.auth.mfa.verify({
    factorId: String(form.get("factorId")),
    challengeId: String(form.get("challengeId")),
    code: String(form.get("code")),
  });
  if (error) return { error: error.message };
  redirect("/");
}
