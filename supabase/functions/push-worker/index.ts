import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { equalSecret, json } from "../_shared/http.ts";
type Delivery = {
  notification_id: string;
  device_id: string;
  token: string;
  kind: string;
  group_id: string;
};
Deno.serve(async (request) => {
  const secret = Deno.env.get("SCHEDULE_SECRET");
  if (!secret) return json({ error: "Worker is not configured" }, 503);
  if (
    request.method !== "POST" ||
    !(await equalSecret(
      request.headers.get("authorization") || "",
      `Bearer ${secret}`,
    ))
  )
    return json({ error: "Unauthorized" }, 401);
  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  const { data, error } = await client.rpc("claim_push_batch");
  if (error) return json({ error: "Could not claim notifications" }, 503);
  let accepted = 0;
  for (const delivery of data as Delivery[]) {
    let ticket: string | null = null;
    let failure: string | null = null;
    try {
      // Never include names, descriptions, amounts, or other sensitive financial details.
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(Deno.env.get("EXPO_ACCESS_TOKEN")
            ? { Authorization: `Bearer ${Deno.env.get("EXPO_ACCESS_TOKEN")}` }
            : {}),
        },
        body: JSON.stringify({
          to: delivery.token,
          title: "Tracksy",
          body: "There’s an update in one of your groups.",
          data: { groupId: delivery.group_id },
          channelId: "default",
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error("Push service unavailable");
      const result = (await response.json()) as {
        data: { status: string; id?: string; details?: { error?: string } };
      };
      if (result.data.status !== "ok")
        throw new Error(result.data.details?.error || "Push rejected");
      ticket = result.data.id || null;
      accepted++;
    } catch (e) {
      failure = (e as Error).message;
    }
    await client.rpc("complete_push", {
      p_notification: delivery.notification_id,
      p_device: delivery.device_id,
      p_ticket: ticket,
      p_error: failure,
    });
  }
  return json({ accepted, claimed: (data as Delivery[]).length });
});
