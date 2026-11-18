// Deliberately limited to a local throwaway Supabase instance.
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
let values = { ...process.env };
if (!values.SUPABASE_SERVICE_ROLE_KEY) {
  const status = execFileSync(
    process.platform === "win32" ? "supabase.exe" : "supabase",
    ["status", "-o", "env"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  for (const line of status.split(/\r?\n/)) {
    const match = line.match(/^(\w+)="(.*)"$/);
    if (match) values[match[1]] = match[2];
  }
}
const url = values.SUPABASE_URL || values.API_URL;
const key = values.SUPABASE_ANON_KEY || values.ANON_KEY;
const service = values.SUPABASE_SERVICE_ROLE_KEY || values.SERVICE_ROLE_KEY;
if (!url || !key || !service)
  throw new Error(
    "Start local Supabase or provide its URL, anon key and service role key through environment variables.",
  );
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname))
  throw new Error(
    "This fixture runner only supports a local disposable Supabase backend.",
  );
const admin = createClient(url, service, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const suffix = randomUUID();
const password = randomUUID() + "aA1!";
const users = [];
async function must(result) {
  const r = await result;
  if (r.error) throw new Error(r.error.message);
  return r.data;
}
for (const name of ["Alice", "Bob", "Outsider"]) {
  const email = `tracksy-${name.toLowerCase()}-${suffix}@example.com`;
  const created = await must(
    admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: name },
    }),
  );
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await must(client.auth.signInWithPassword({ email, password }));
  users.push({ id: created.user.id, email, client });
}
const [alice, bob, outsider] = users;
const group = await must(
  alice.client.rpc("create_group", {
    p_name: `Integration ${suffix}`,
    p_currency: "INR",
  }),
);
const token = await must(
  alice.client.rpc("invite_member", { p_group: group, p_email: bob.email }),
);
await must(bob.client.rpc("accept_invitation", { p_token: token }));
const payload = {
  group_id: group,
  description: "Integration dinner",
  amount_minor: 1001,
  currency: "INR",
  category: "Food & drinks",
  split_method: "equal",
  participants: [
    { user_id: alice.id, value: 1 },
    { user_id: bob.id, value: 1 },
  ],
  payers: [{ user_id: alice.id, amount_minor: 1001 }],
  expense_date: new Date().toISOString().slice(0, 10),
  notes: "",
  idempotency_key: randomUUID(),
};
const expense = await must(alice.client.rpc("create_expense", { p: payload }));
assert.equal(
  await must(alice.client.rpc("create_expense", { p: payload })),
  expense,
);
const balances = await must(
  bob.client.rpc("group_balances", { p_group: group }),
);
assert.equal(
  balances.reduce((s, b) => s + Number(b.balance_minor), 0),
  0,
);
assert.equal(balances.length, 2);
assert.equal(
  (
    await must(
      outsider.client.from("expenses").select("id").eq("group_id", group),
    )
  ).length,
  0,
);
assert.ok(
  (await outsider.client.rpc("group_balances", { p_group: group })).error,
);
assert.ok(
  (
    await alice.client
      .from("group_members")
      .update({ role: "owner" })
      .eq("group_id", group)
      .eq("user_id", bob.id)
  ).error,
);
const payment = await must(
  bob.client.rpc("create_settlement", {
    p: {
      group_id: group,
      from_user: bob.id,
      to_user: alice.id,
      amount_minor: 100,
      currency: "INR",
      method: "cash",
      idempotency_key: randomUUID(),
    },
  }),
);
await must(
  alice.client.rpc("respond_settlement", {
    p_id: payment,
    p_action: "confirm",
  }),
);
await must(
  alice.client.rpc("reverse_expense", {
    p_expense: expense,
    p_version: 1,
    p_key: randomUUID(),
  }),
);
console.log(
  "Live local Supabase integration passed: authentication, invitations, expense RPC, retry, balances, RLS, roles, confirmation and reversal.",
);
console.log(
  "Fixtures remain in this disposable local database; reset it after inspection. No production records were modified.",
);
