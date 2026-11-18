import { redirect } from "next/navigation";
import { serverClient } from "../lib/supabase";
import { logout } from "./actions";
export const dynamic = "force-dynamic";
export default async function Dashboard() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
    return (
      <section>
        <h1>Connect your backend.</h1>
        <p>
          Add the Supabase URL and public key to apps/admin/.env.local. No
          metrics are fabricated.
        </p>
      </section>
    );
  const client = await serverClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) redirect("/login");
  if (user.app_metadata.role !== "admin")
    return (
      <section>
        <h1>Administrator access required.</h1>
        <p>This role must be provisioned through a trusted operator.</p>
        <form action={logout}>
          <button>Sign out</button>
        </form>
      </section>
    );
  const { data: assurance } =
    await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance?.currentLevel !== "aal2") redirect("/mfa");
  const { data, error } = await client.rpc("admin_metrics");
  return (
    <>
      <div className="heading">
        <div>
          <p className="eyebrow">THE BIG PICTURE</p>
          <h1>Tracksy operations</h1>
          <p>Aggregate metadata. Every access is audited.</p>
        </div>
        <form action={logout}>
          <button>Sign out</button>
        </form>
      </div>
      {error ? (
        <section role="alert">{error.message}</section>
      ) : (
        <div className="grid">
          {Object.entries(data as Record<string, number>).map(
            ([key, value]) => (
              <section key={key}>
                <p>{key.replaceAll("_", " ")}</p>
                <strong>{value.toLocaleString()}</strong>
              </section>
            ),
          )}
        </div>
      )}
      <section>
        <h2>Operational scope</h2>
        <p>
          Revenue, churn, active-user analytics, support triage, feature-flag
          editing, and webhook diagnostics require additional implementation.
          This console currently provides verified aggregate counts only.
        </p>
        <p>Private expense details are excluded from administrator access.</p>
      </section>
    </>
  );
}
