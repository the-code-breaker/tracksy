import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { equalSecret, json } from "../_shared/http.ts";
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
  const { data, error } = await client.rpc("run_recurring_batch");
  if (error) return json({ error: "Recurrence processing failed" }, 503);
  return json({ processed: data });
});
