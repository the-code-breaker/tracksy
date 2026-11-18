import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { equalSecret, json } from "../_shared/http.ts";
interface Event {
  id: string;
  type: string;
  app_user_id: string;
  product_id: string;
  original_transaction_id: string;
  transaction_id: string;
  event_timestamp_ms: number;
  store: string;
  environment: string;
  is_family_share?: boolean;
}
interface Subscription {
  expires_date: string | null;
  grace_period_expires_date: string | null;
  purchase_date: string;
  refunded_at: string | null;
  unsubscribe_detected_at: string | null;
  store: string;
  store_transaction_id: string | number;
  ownership_type: string;
  product_plan_identifier?: string;
  is_sandbox: boolean;
}
Deno.serve(async (request) => {
  if (request.method !== "POST")
    return json({ error: "Method not allowed" }, 405);
  const secret = Deno.env.get("REVENUECAT_WEBHOOK_AUTH");
  const apiKey = Deno.env.get("REVENUECAT_SECRET_KEY");
  if (!secret || !apiKey)
    return json({ error: "Billing is not configured" }, 503);
  if (!(await equalSecret(request.headers.get("authorization") || "", secret)))
    return json({ error: "Unauthorized" }, 401);
  try {
    const body = await request.text();
    if (body.length > 131072) return json({ error: "Payload too large" }, 413);
    const { event: e } = JSON.parse(body) as { event: Event };
    if (e.type === "TEST") return json({ received: true, test: true });
    // Account transfers require an explicit operator reconciliation; never remap a group.
    const supported = [
      "INITIAL_PURCHASE",
      "RENEWAL",
      "CANCELLATION",
      "UNCANCELLATION",
      "EXPIRATION",
      "BILLING_ISSUE",
      "SUBSCRIPTION_EXTENDED",
      "REFUND_REVERSED",
      "SUBSCRIPTION_PAUSED",
    ];
    if (!supported.includes(e.type))
      return json({ received: true, ignored: e.type });
    const products = (Deno.env.get("REVENUECAT_ALLOWED_PRODUCTS") || "")
      .split(",")
      .filter(Boolean);
    if (
      !e.id ||
      !Number.isSafeInteger(e.event_timestamp_ms) ||
      !e.original_transaction_id ||
      !e.transaction_id ||
      !products.includes(e.product_id) ||
      !["APP_STORE", "PLAY_STORE"].includes(e.store) ||
      e.is_family_share ||
      !/^[0-9a-f-]{36}$/i.test(e.app_user_id)
    )
      return json({ error: "Unsupported billing event" }, 422);
    if (e.environment !== (Deno.env.get("BILLING_ENVIRONMENT") || "SANDBOX"))
      return json({ error: "Wrong billing environment" }, 422);
    const response = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(e.app_user_id)}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!response.ok) throw new Error("Provider verification unavailable");
    const state = (await response.json()) as {
      subscriber: { subscriptions: Record<string, Subscription> };
    };
    const base = e.product_id.split(":")[0]!;
    const sub =
      state.subscriber.subscriptions[e.product_id] ||
      state.subscriber.subscriptions[base];
    if (
      !sub ||
      sub.store.toUpperCase() !== e.store ||
      sub.ownership_type !== "PURCHASED" ||
      !sub.expires_date ||
      sub.is_sandbox !== (e.environment === "SANDBOX")
    )
      return json({ error: "Provider ownership mismatch" }, 409);
    // Initial mapping must match this exact provider-confirmed transaction. On renewal,
    // authenticated webhook ownership + the immutable original transaction mapping applies.
    if (
      e.type === "INITIAL_PURCHASE" &&
      String(sub.store_transaction_id) !== e.transaction_id
    )
      return json(
        { error: "Transaction has changed; reconcile with the provider" },
        409,
      );
    const expiry = Date.parse(sub.expires_date);
    const grace = sub.grace_period_expires_date
      ? Date.parse(sub.grace_period_expires_date)
      : 0;
    if (
      !Number.isFinite(expiry) ||
      !Number.isFinite(Date.parse(sub.purchase_date))
    )
      return json({ error: "Invalid provider dates" }, 422);
    const status = sub.refunded_at
      ? "revoked"
      : grace > Date.now()
        ? "grace"
        : expiry <= Date.now()
          ? "expired"
          : sub.unsubscribe_detected_at
            ? "cancelled"
            : "active";
    const expiresAt =
      grace > expiry ? new Date(grace).toISOString() : sub.expires_date;
    const client = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const { data, error } = await client.rpc("apply_verified_billing", {
      p: {
        user_id: e.app_user_id,
        provider: e.store,
        original_transaction_id: e.original_transaction_id,
        product_id: e.product_id,
        status,
        starts_at: sub.purchase_date,
        expires_at: expiresAt,
        renews: !sub.unsubscribe_detected_at && !sub.refunded_at,
        event_timestamp_ms: e.event_timestamp_ms,
        event_id: e.id,
        event_type: e.type,
      },
    });
    if (error) throw new Error("Billing reconciliation requires retry");
    return json({ received: true, disposition: data });
  } catch {
    return json({ error: "Billing verification failed; retry delivery" }, 503);
  }
});
