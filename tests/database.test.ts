import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { split } from "@tracksy/finance";
import { itemizedShares } from "@tracksy/finance";
const db = new PGlite();
const a = "00000000-0000-4000-8000-000000000001",
  b = "00000000-0000-4000-8000-000000000002",
  outsider = "00000000-0000-4000-8000-000000000003";
let group: string;
let otherGroup: string;
async function actor(user: string, role = "authenticated") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claims',$1,false)", [
    JSON.stringify({ ...(user ? { sub: user } : {}), role }),
  ]);
  await db.exec(`set role ${role}`);
}
async function rpc<T = string>(name: string, args: unknown[] = []) {
  const result = await db.query<Record<string, T>>(
    `select public.${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) result`,
    args,
  );
  return result.rows[0]!.result!;
}
function expense(overrides: Record<string, unknown> = {}) {
  return {
    group_id: group,
    description: "Dinner",
    amount_minor: 1001,
    currency: "INR",
    category: "Food & drinks",
    split_method: "equal",
    expense_date: "2026-10-27",
    notes: "",
    participants: [
      { user_id: a, value: 1 },
      { user_id: b, value: 1 },
    ],
    payers: [{ user_id: a, amount_minor: 1001 }],
    idempotency_key: randomUUID(),
    ...overrides,
  };
}
beforeAll(async () => {
  await db.exec(
    `create role anon; create role authenticated; create role service_role bypassrls; create schema auth; grant usage on schema auth to public; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}'); create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$; create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$; create function auth.role() returns text language sql stable as $$ select auth.jwt()->>'role' $$;`,
  );
  await db.exec(
    `create schema storage; grant usage on schema storage to authenticated; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text); alter table storage.objects enable row level security; grant select,insert on storage.objects to authenticated; create function storage.foldername(path text) returns text[] language sql immutable as $$ select string_to_array(path,'/') $$; create publication supabase_realtime;`,
  );
  for (const file of [
    "202610270000_itemized.sql",
    "202610270001_core.sql",
    "202610270002_premium.sql",
    "202610270003_storage.sql",
    "202610270004_operations.sql",
    "202610270005_recurring.sql",
    "202610270006_ledger_constraints.sql",
    "202610270007_rules.sql",
    "202610270008_immutable_sources.sql",
    "202610270009_settlement_plan.sql",
    "202610290000_complimentary_access.sql",
    "202610300000_member_experience.sql",
    "202610300001_group_email.sql",
    "202610300002_expense_history.sql",
    "202610300003_invitation_usability.sql",
    "202611040000_group_lifecycle.sql",
  ]) {
    const sql = (
      await readFile(
        new URL(`../supabase/migrations/${file}`, import.meta.url),
        "utf8",
      )
    ).replace("create extension if not exists pgcrypto;", "");
    try {
      await db.exec(sql);
    } catch (e) {
      const error = e as Error & { position?: string };
      const pos = Number(error.position);
      throw new Error(
        `${file}: ${error.message}; near ${sql.slice(Math.max(0, pos - 120), pos + 120)}`,
      );
    }
  }
  await db.query(
    "insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,'a@example.com',now(),'{\"display_name\":\"A\"}'),($2,'b@example.com',now(),'{\"display_name\":\"B\"}'),($3,'outsider@example.com',now(),'{}')",
    [a, b, outsider],
  );
  await actor(a);
  group = await rpc("create_group", ["Goa crew", "INR"]);
  const token = await rpc("invite_member", [group, "b@example.com"]);
  await actor(b);
  await rpc("accept_invitation", [token]);
  await actor(outsider);
  otherGroup = await rpc("create_group", ["Private", "USD"]);
  await actor(a);
});
afterAll(() => db.close());
describe("PostgreSQL RPCs, ledger and RLS", () => {
  it("uses Google profile names for newly created accounts", async () => {
    await actor(a);
    await db.exec("reset role");
    const id = randomUUID();
    await db.query(
      "insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,'google@example.com',now(),'{\"full_name\":\"Google Person\"}')",
      [id],
    );
    expect(
      (
        await db.query<{ display_name: string }>(
          "select display_name from public.profiles where id=$1",
          [id],
        )
      ).rows[0]?.display_name,
    ).toBe("Google Person");
    await actor(a);
  });
  it("returns the complete version chain to group members and denies outsiders", async () => {
    await actor(a);
    const id = await rpc("create_expense", [
      expense({ participants: [{ user_id: a, value: 1 }] }),
    ]);
    await actor(b);
    const newer = await rpc("create_expense", [
      expense({
        participants: [{ user_id: a, value: 1 }],
        replaces_id: id,
        expected_version: 1,
        amount_minor: 2000,
        payers: [{ user_id: a, amount_minor: 2000 }],
      }),
    ]);
    const history = await rpc<
      { id: string; editor: string; participants: { user_id: string }[] }[]
    >("expense_versions", [newer]);
    expect(history.map((v) => v.id)).toEqual([newer, id]);
    expect(history[0]?.editor).toBe("B");
    expect(history[0]?.participants.map((p) => p.user_id)).toEqual([a]);
    await actor(outsider);
    await expect(rpc("expense_versions", [id])).rejects.toThrow(
      "Group access denied",
    );
    await actor(a);
  });
  it("creates email-bound invitation links and limits delivery privileges to the server", async () => {
    await actor(b);
    const key = randomUUID();
    const job = await rpc<{ id: string; status: string; link: string }>(
      "prepare_group_mail",
      [group, "invite", key, "newfriend@example.com"],
    );
    expect(job.link).toMatch(
      /^https:\/\/tracksy-support\.coralprawn64\.chatgpt\.site\/join\/\?token=[a-f0-9]{64}$/,
    );
    expect(
      (
        await rpc<{ id: string }>("prepare_group_mail", [
          group,
          "invite",
          key,
          "newfriend@example.com",
        ])
      ).id,
    ).toBe(job.id);
    await expect(
      rpc("prepare_group_mail", [group, "invite", key, "other@example.com"]),
    ).rejects.toThrow("Request key");
    await expect(rpc("claim_group_mail", [job.id, b])).rejects.toThrow();
    await expect(
      db.query("select * from private.group_mail"),
    ).rejects.toThrow();
    const token = new URL(job.link).searchParams.get("token");
    await actor("", "anon");
    expect(
      (await rpc<{ group_name: string }>("invitation_preview", [token]))
        .group_name,
    ).toBe("Goa crew");
    await expect(rpc("accept_invitation", [token])).rejects.toThrow();
    await actor(a);
    await expect(rpc("accept_invitation", [token])).rejects.toThrow(
      "another email",
    );
    await expect(
      rpc("invite_member", [group, "bad\r\n@example.com"]),
    ).rejects.toThrow("valid email");
  });
  it("sends reminders only for an eligible outstanding balance and enforces a shared cooldown", async () => {
    await actor(a);
    const g = await rpc("create_group", ["Reminder test", "INR"]),
      token = await rpc("invite_member", [g, "b@example.com"]);
    await actor(b);
    await rpc("accept_invitation", [token]);
    await actor(a);
    await rpc("create_expense", [expense({ group_id: g })]);
    const targets = await db.query<{ user_id: string; can_remind: boolean }>(
      "select * from public.reminder_targets($1)",
      [g],
    );
    expect(targets.rows.find((t) => t.user_id === b)?.can_remind).toBe(true);
    const k = randomUUID(),
      job = await rpc<{ id: string }>("prepare_group_mail", [
        g,
        "reminder",
        k,
        null,
        b,
        "INR",
      ]);
    await expect(
      rpc("prepare_group_mail", [g, "reminder", randomUUID(), null, b, "INR"]),
    ).rejects.toThrow("not available");
    await actor(a, "service_role");
    const delivery = await rpc<{ recipient: string; kind: string }>(
      "claim_group_mail",
      [job.id, a],
    );
    expect(delivery.recipient).toBe("b@example.com");
    expect(delivery.kind).toBe("reminder");
    await rpc("complete_group_mail", [job.id, a, true]);
    await actor(b);
    await expect(
      rpc("prepare_group_mail", [g, "reminder", randomUUID(), null, a, "INR"]),
    ).rejects.toThrow("not available");
    await actor(outsider);
    await expect(rpc("reminder_targets", [g])).rejects.toThrow(
      "Group access denied",
    );
    await actor(a);
  });
  it("lets a regular active member correct an expense and records the editor and both versions", async () => {
    await actor(a);
    const id = await rpc("create_expense", [expense()]);
    await actor(b);
    const next = await rpc("create_expense", [
      expense({
        replaces_id: id,
        expected_version: 1,
        description: "Edited by a member",
      }),
    ]);
    const audit = (
      await db.query<{
        actor_id: string;
        detail: {
          before: { description: string };
          after: { description: string };
        };
      }>(
        "select actor_id,detail from public.expense_audit_events where entity_id=$1 and event_type='expense_corrected'",
        [next],
      )
    ).rows[0]!;
    expect(audit.actor_id).toBe(b);
    expect(audit.detail.before.description).toBe("Dinner");
    expect(audit.detail.after.description).toBe("Edited by a member");
    await expect(
      rpc("create_expense", [
        expense({ replaces_id: id, expected_version: 1 }),
      ]),
    ).rejects.toThrow("Expense changed");
    await actor(outsider);
    await expect(
      rpc("reverse_expense", [next, 1, randomUUID()]),
    ).rejects.toThrow("Group access denied");
    await actor(a);
  });
  it("does not add a newly joined member to any historical expense or ledger", async () => {
    await actor(a);
    const historyGroup = await rpc("create_group", [
      "Historical members",
      "INR",
    ]);
    const id = await rpc("create_expense", [
      expense({
        group_id: historyGroup,
        participants: [{ user_id: a, value: 1 }],
      }),
    ]);
    const before = await db.query(
      "select user_id,amount_minor from public.expense_splits where expense_id=$1 order by user_id",
      [id],
    );
    const token = await rpc("invite_member", [
      historyGroup,
      "outsider@example.com",
    ]);
    await actor(outsider);
    await rpc("accept_invitation", [token]);
    const after = await db.query(
      "select user_id,amount_minor from public.expense_splits where expense_id=$1 order by user_id",
      [id],
    );
    expect(after.rows).toEqual(before.rows);
    expect(
      (
        await db.query(
          "select * from public.financial_ledger_entries where group_id=$1 and user_id=$2",
          [historyGroup, outsider],
        )
      ).rows,
    ).toHaveLength(0);
    await actor(a);
  });
  it("creates groups and accepts an email-bound invitation", async () => {
    await actor(a);
    const rows = await db.query("select * from public.list_members($1)", [
      group,
    ]);
    expect(rows.rows).toHaveLength(2);
  });
  it("enforces cross-group isolation and denies direct ledger writes", async () => {
    await actor(outsider);
    expect(
      (await db.query("select * from public.groups where id=$1", [group])).rows,
    ).toHaveLength(0);
    await expect(rpc("group_balances", [group])).rejects.toThrow(
      "Group access denied",
    );
    await expect(rpc("create_expense", [expense()])).rejects.toThrow(
      "Group access denied",
    );
    await expect(
      db.query(
        "insert into public.financial_ledger_entries(group_id,user_id,currency,delta_minor,entry_type) values($1,$2,'INR',1,'expense')",
        [group, outsider],
      ),
    ).rejects.toThrow();
    await actor(a);
  });
  it("matches the TypeScript allocator on the server for all free methods", async () => {
    await actor(a);
    for (const method of [
      "equal",
      "exact",
      "custom",
      "weighted",
      "percentage",
    ]) {
      const participants = [
        {
          user_id: a,
          value:
            method === "percentage"
              ? 3333
              : method === "exact" || method === "custom"
                ? 401
                : 2,
        },
        {
          user_id: b,
          value:
            method === "percentage"
              ? 6667
              : method === "exact" || method === "custom"
                ? 600
                : 3,
        },
      ];
      const id = await rpc("create_expense", [
        expense({ split_method: method, participants }),
      ]);
      const rows = await db.query<{ user_id: string; amount_minor: number }>(
        "select user_id,amount_minor from public.expense_splits where expense_id=$1",
        [id],
      );
      expect(
        Object.fromEntries(
          rows.rows.map((r) => [r.user_id, Number(r.amount_minor)]),
        ),
      ).toEqual(split(1001, method, participants));
      expect(
        Number(
          (
            await db.query<{ sum: string }>(
              "select sum(delta_minor) from public.financial_ledger_entries where expense_id=$1",
              [id],
            )
          ).rows[0]!.sum,
        ),
      ).toBe(0);
    }
  });
  it("rejects fractional, negative, unbalanced and unauthorized splits", async () => {
    for (const payload of [
      expense({ amount_minor: 1.5 }),
      expense({ amount_minor: -1 }),
      expense({ payers: [{ user_id: a, amount_minor: 1 }] }),
      expense({ participants: [{ user_id: outsider, value: 1 }] }),
      expense({
        split_method: "exact",
        participants: [{ user_id: a, value: 1 }],
      }),
      expense({
        split_method: "percentage",
        participants: [{ user_id: a, value: 100 }],
      }),
      expense({
        split_method: "itemized",
        participants: [{ user_id: a, value: 1001 }],
      }),
    ])
      await expect(rpc("create_expense", [payload])).rejects.toThrow();
  });
  it("deduplicates retried writes and rejects key replay with a different payload", async () => {
    const p = expense();
    const first = await rpc("create_expense", [p]);
    expect(await rpc("create_expense", [p])).toBe(first);
    await expect(
      rpc("create_expense", [{ ...p, description: "Tampered" }]),
    ).rejects.toThrow("Idempotency key");
  });
  it("preserves auditability during corrections and rejects stale edits", async () => {
    const id = await rpc("create_expense", [expense()]);
    const replacement = await rpc("create_expense", [
      expense({
        replaces_id: id,
        expected_version: 1,
        description: "Corrected",
      }),
    ]);
    expect(replacement).not.toBe(id);
    const sum = await db.query<{ sum: string }>(
      "select sum(delta_minor) from public.financial_ledger_entries where expense_id=$1",
      [id],
    );
    expect(Number(sum.rows[0]!.sum)).toBe(0);
    await expect(rpc("reverse_expense", [id, 1, randomUUID()])).rejects.toThrow(
      "Expense changed",
    );
    const count = await db.query(
      "select * from public.expense_audit_events where entity_id=$1",
      [id],
    );
    expect(count.rows.length).toBeGreaterThanOrEqual(2);
  });
  it("keeps currency balances separate", async () => {
    await rpc("create_expense", [expense({ currency: "USD" })]);
    const rows = await db.query<{ currency: string }>(
      "select * from public.group_balances($1)",
      [group],
    );
    expect(new Set(rows.rows.map((r) => r.currency))).toEqual(
      new Set(["INR", "USD"]),
    );
  });
  it("supports multiple payers and partial settlement, with counterparty confirmation", async () => {
    await rpc("create_expense", [
      expense({
        payers: [
          { user_id: a, amount_minor: 700 },
          { user_id: b, amount_minor: 301 },
        ],
      }),
    ]);
    const before = await db.query<{ balance_minor: number }>(
      "select * from public.group_balances($1) where user_id=$2 and currency=$3",
      [group, b, "INR"],
    );
    const id = await rpc("create_settlement", [
      {
        group_id: group,
        from_user: b,
        to_user: a,
        amount_minor: 100,
        currency: "INR",
        method: "upi",
        idempotency_key: randomUUID(),
      },
    ]);
    expect(
      (
        await db.query(
          "select * from public.financial_ledger_entries where settlement_id=$1",
          [id],
        )
      ).rows,
    ).toHaveLength(0);
    await expect(rpc("respond_settlement", [id, "confirm"])).rejects.toThrow(
      "other payment party",
    );
    await actor(b);
    await rpc("respond_settlement", [id, "confirm"]);
    const after = await db.query<{ balance_minor: number }>(
      "select * from public.group_balances($1) where user_id=$2 and currency=$3",
      [group, b, "INR"],
    );
    expect(
      Number(after.rows[0]!.balance_minor) -
        Number(before.rows[0]!.balance_minor),
    ).toBe(100);
    await rpc("respond_settlement", [id, "reverse"]);
    expect(
      Number(
        (
          await db.query<{ sum: string }>(
            "select sum(delta_minor) from public.financial_ledger_entries where settlement_id=$1",
            [id],
          )
        ).rows[0]!.sum,
      ),
    ).toBe(0);
    await actor(a);
  });
  it("does not permit member role escalation or unsafe group exits", async () => {
    await actor(b);
    await expect(rpc("manage_member", [group, b, "admin"])).rejects.toThrow(
      "Owner required",
    );
    await expect(rpc("manage_member", [group, b, "leave"])).rejects.toThrow(
      "Settle outstanding",
    );
    await actor(a);
    await expect(rpc("manage_member", [group, a, "leave"])).rejects.toThrow(
      "Transfer ownership",
    );
  });
  it("keeps immutable ledger records immutable even to the owner", async () => {
    await db.exec("reset role");
    await expect(
      db.query(
        "update public.financial_ledger_entries set delta_minor=0 where group_id=$1",
        [group],
      ),
    ).rejects.toThrow("Append-only");
    await actor(a);
  });
  it("denies premium modification and privilege escalation", async () => {
    await expect(
      db.query(
        "insert into public.group_subscription_entitlements(group_id,status,expires_at) values($1,'active',now()+interval '1 year')",
        [group],
      ),
    ).rejects.toThrow();
    await expect(rpc("apply_verified_billing", [{}])).rejects.toThrow();
    await expect(rpc("admin_metrics")).rejects.toThrow("Admin role and MFA");
    expect(await rpc("has_group_feature", [a, group, "analytics"])).toBe(false);
  });
  it("applies verified group billing, shares benefits, preserves other groups and ignores stale/duplicate events", async () => {
    await rpc("begin_group_purchase", [group, "tracksy_group_monthly"]);
    const p = {
      user_id: a,
      provider: "APP_STORE",
      original_transaction_id: "test-transaction",
      product_id: "tracksy_group_monthly",
      status: "active",
      starts_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      renews: true,
      event_timestamp_ms: 100,
      event_id: "event-1",
      event_type: "INITIAL_PURCHASE",
    };
    await actor(a, "service_role");
    expect(await rpc("apply_verified_billing", [p])).toBe("applied");
    expect(await rpc("apply_verified_billing", [p])).toBe("duplicate");
    expect(
      await rpc("apply_verified_billing", [
        { ...p, event_id: "older", event_timestamp_ms: 99, status: "expired" },
      ]),
    ).toBe("stale");
    await actor(b);
    expect(await rpc("has_group_feature", [b, group, "analytics"])).toBe(true);
    expect(await rpc("has_group_feature", [b, otherGroup, "analytics"])).toBe(
      false,
    );
    expect(await rpc("has_group_feature", [a, group, "analytics"])).toBe(false);
    await actor(outsider);
    expect(await rpc("has_group_feature", [outsider, group, "analytics"])).toBe(
      false,
    );
    await actor(a, "service_role");
    expect(
      await rpc("apply_verified_billing", [
        {
          ...p,
          event_id: "cancel",
          event_timestamp_ms: 101,
          status: "cancelled",
          renews: false,
        },
      ]),
    ).toBe("applied");
    await actor(a);
    expect(await rpc("has_group_feature", [a, group, "analytics"])).toBe(true);
    await actor(a, "service_role");
    await rpc("apply_verified_billing", [
      { ...p, event_id: "revoke", event_timestamp_ms: 102, status: "revoked" },
    ]);
    await actor(a);
    expect(await rpc("has_group_feature", [a, group, "analytics"])).toBe(false);
  });
});

describe("additional security and premium operations", () => {
  async function verified(status = "active", stamp = 200) {
    await actor(a, "service_role");
    const result = await rpc("apply_verified_billing", [
      {
        user_id: a,
        provider: "APP_STORE",
        original_transaction_id: "test-transaction",
        product_id: "tracksy_group_monthly",
        status,
        starts_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        renews: status === "active",
        event_timestamp_ms: stamp,
        event_id: `event-extra-${stamp}`,
        event_type: "RENEWAL",
      },
    ]);
    await actor(a);
    return result;
  }
  it("rejects expired, reused, mismatched and unverified-email invitations", async () => {
    await actor(a);
    const token = await rpc("invite_member", [group, "b@example.com"]);
    await actor(outsider);
    await expect(rpc("accept_invitation", [token])).rejects.toThrow(
      "another email",
    );
    await actor(a);
    await expect(rpc("accept_invitation", [token])).rejects.toThrow(
      "another email",
    );
    const ownToken = await rpc("invite_member", [group, "a@example.com"]);
    expect(await rpc("accept_invitation", [ownToken])).toBe(group);
    const unverified = randomUUID();
    await db.exec("reset role");
    await db.query(
      "insert into auth.users(id,email) values($1,'unverified@example.com')",
      [unverified],
    );
    await actor(a);
    const pending = await rpc("invite_member", [group, null]);
    await actor(unverified);
    await expect(rpc("accept_invitation", [pending])).rejects.toThrow(
      "Verify your email",
    );
    await actor(a);
  });
  it("denies direct membership changes and financial source edits", async () => {
    await expect(
      db.query(
        "update public.group_members set role='owner' where group_id=$1 and user_id=$2",
        [group, b],
      ),
    ).rejects.toThrow();
    await expect(
      db.query("update public.expenses set amount_minor=1 where group_id=$1", [
        group,
      ]),
    ).rejects.toThrow();
    await expect(
      db.query(
        "delete from public.financial_ledger_entries where group_id=$1",
        [group],
      ),
    ).rejects.toThrow();
  });
  it("enforces private receipt paths and membership on storage uploads", async () => {
    const path = `${group}/${a}/${randomUUID()}.jpg`;
    await db.query(
      "insert into storage.objects(bucket_id,name) values('receipts',$1)",
      [path],
    );
    const expenseId = await rpc("create_expense", [expense()]);
    const attachment = await rpc("attach_receipt", [expenseId, path]);
    expect(attachment).toMatch(/^[0-9a-f-]{36}$/);
    await actor(outsider);
    expect(
      (
        await db.query(
          "select * from storage.objects where bucket_id='receipts' and name=$1",
          [path],
        )
      ).rows,
    ).toHaveLength(0);
    await expect(
      db.query(
        "insert into storage.objects(bucket_id,name) values('receipts',$1)",
        [` ${group}/${outsider}/bad.jpg`.trim()],
      ),
    ).rejects.toThrow();
    await actor(a);
    await expect(
      rpc("attach_receipt", [expenseId, `${group}/${b}/unknown.jpg`]),
    ).rejects.toThrow("Invalid receipt path");
  });
  it("derives itemized shares on the server and ignores forged client totals", async () => {
    await verified();
    const items = [
      {
        description: "Meal",
        amount_minor: 1000,
        allocations: [
          { user_id: a, value: 2 },
          { user_id: b, value: 1 },
        ],
      },
      {
        description: "Tax",
        amount_minor: 100,
        allocations: [
          { user_id: a, value: 2 },
          { user_id: b, value: 1 },
        ],
      },
      {
        description: "Tip",
        amount_minor: 100,
        allocations: [
          { user_id: a, value: 1 },
          { user_id: b, value: 1 },
        ],
      },
      {
        description: "Discount",
        amount_minor: -200,
        allocations: [
          { user_id: a, value: 1 },
          { user_id: b, value: 1 },
        ],
      },
    ];
    const id = await rpc("create_expense", [
      expense({
        amount_minor: 1000,
        split_method: "itemized",
        items,
        participants: [{ user_id: a, value: 1000 }],
        payers: [{ user_id: a, amount_minor: 1000 }],
      }),
    ]);
    const rows = await db.query<{ user_id: string; amount_minor: number }>(
      "select * from public.expense_splits where expense_id=$1",
      [id],
    );
    expect(
      Object.fromEntries(
        rows.rows.map((r) => [r.user_id, Number(r.amount_minor)]),
      ),
    ).toEqual(itemizedShares(1000, items));
    expect(
      (
        await db.query(
          "select * from public.expense_items where expense_id=$1",
          [id],
        )
      ).rows,
    ).toHaveLength(4);
  });
  it("enforces budgets and reports at the server boundary", async () => {
    const month = await db.query<{ month: string }>(
      "select date_trunc('month',current_date)::date::text as month",
    );
    await rpc("set_budget", [group, month.rows[0]!.month, "INR", 100000]);
    await actor(b);
    await expect(
      rpc("set_budget", [group, month.rows[0]!.month, "INR", 100000]),
    ).rejects.toThrow("manager");
    const report = await rpc<Record<string, unknown>>("group_report", [
      group,
      "2026-01-01",
      "2026-12-31",
    ]);
    expect(Array.isArray(report.expenses)).toBe(true);
    await actor(a);
    await verified("expired", 201);
    await expect(
      rpc("group_report", [group, "2026-01-01", "2026-12-31"]),
    ).rejects.toThrow("Group Plus");
    expect(
      (
        await db.query("select * from public.expenses where group_id=$1", [
          group,
        ])
      ).rows.length,
    ).toBeGreaterThan(0);
    await verified("active", 202);
  });
  it("prevents duplicate group billing and arbitrary subscription reassignment", async () => {
    await expect(
      rpc("begin_group_purchase", [group, "tracksy_group_yearly"]),
    ).rejects.toThrow("already has an active");
    const another = await rpc("create_group", ["Another group", "INR"]);
    await expect(
      rpc("begin_group_purchase", [another, "tracksy_group_monthly"]),
    ).rejects.toThrow("already assigned");
    await actor(b);
    await expect(
      rpc("begin_group_purchase", [group, "tracksy_group_monthly"]),
    ).rejects.toThrow("Billing manager");
    await actor(a);
  });
  it("queues recurring expenses exactly once and posts only after approval", async () => {
    const id = await rpc("create_expense", [expense()]);
    const today = (
      await db.query<{ date: string }>("select current_date::text as date")
    ).rows[0]!.date;
    const rule = await rpc("create_recurring", [id, today, null, 1, false]);
    await actor(a, "service_role");
    await rpc("run_recurring_batch");
    await rpc("run_recurring_batch");
    await actor(a);
    const runs = await db.query<{ id: string; status: string }>(
      "select * from public.recurring_expense_runs where recurring_id=$1",
      [rule],
    );
    expect(runs.rows).toHaveLength(1);
    expect(runs.rows[0]!.status).toBe("awaiting_approval");
    const posted = await rpc("approve_recurring_run", [runs.rows[0]!.id]);
    expect(await rpc("approve_recurring_run", [runs.rows[0]!.id])).toBe(posted);
    await rpc("stop_recurring", [rule]);
  });
  it("automatically posts only explicitly authorized fixed recurrence", async () => {
    const id = await rpc("create_expense", [expense()]);
    const today = (
      await db.query<{ date: string }>("select current_date::text as date")
    ).rows[0]!.date;
    const rule = await rpc("create_recurring", [id, today, null, 1, true]);
    await actor(a, "service_role");
    await rpc("run_recurring_batch");
    await actor(a);
    const runs = await db.query<{ status: string; expense_id: string }>(
      "select * from public.recurring_expense_runs where recurring_id=$1",
      [rule],
    );
    expect(runs.rows[0]!.status).toBe("posted");
    expect(runs.rows[0]!.expense_id).toBeTruthy();
    await rpc("stop_recurring", [rule]);
  });
  it("does not allow clients to invoke scheduled workers", async () => {
    await expect(rpc("run_recurring_batch")).rejects.toThrow();
    await expect(rpc("claim_push_batch")).rejects.toThrow();
  });
  it("rejects unbalanced privileged inserts and immutable source changes", async () => {
    const id = await rpc("create_expense", [expense()]);
    await db.exec("reset role");
    await expect(
      db.query(
        "insert into public.financial_ledger_entries(group_id,user_id,currency,delta_minor,expense_id,entry_type) values($1,$2,'INR',1,$3,'expense')",
        [group, a, id],
      ),
    ).rejects.toThrow("sum to zero");
    await expect(
      db.query(
        "insert into public.financial_ledger_entries(group_id,user_id,currency,delta_minor,expense_id,entry_type) values($1,$2,'USD',0,$3,'expense')",
        [group, a, id],
      ),
    ).rejects.toThrow("currency must match");
    await expect(
      db.query("update public.expenses set amount_minor=2 where id=$1", [id]),
    ).rejects.toThrow("replacement record");
    await expect(
      db.query(
        "update public.billing_purchases set group_id=$1 where purchaser_id=$2",
        [otherGroup, a],
      ),
    ).rejects.toThrow("mapping is immutable");
    await actor(a);
  });
  it("preserves a saved rule’s currency and requires premium to apply it", async () => {
    const id = await rpc("create_expense", [expense({ currency: "USD" })]);
    const rule = await rpc("rule_from_expense", [id, "Dinner shares"]);
    const result = await rpc<{ currency: string; split_method: string }>(
      "get_split_rule",
      [rule],
    );
    expect(result.currency).toBe("USD");
    expect(result.split_method).toBe("equal");
    await verified("expired", 203);
    await expect(rpc("get_split_rule", [rule])).rejects.toThrow("Group Plus");
    await verified("active", 204);
  });
  it("grants a new member group benefits and removes access after they leave", async () => {
    const token = await rpc("invite_member", [group, "outsider@example.com"]);
    await actor(outsider);
    await rpc("accept_invitation", [token]);
    expect(await rpc("has_group_feature", [outsider, group, "analytics"])).toBe(
      true,
    );
    await rpc("manage_member", [group, outsider, "leave"]);
    expect(await rpc("has_group_feature", [outsider, group, "analytics"])).toBe(
      false,
    );
    await expect(rpc("accept_invitation", [token])).rejects.toThrow(
      "used invitation",
    );
    await actor(a);
  });
  it("enforces settlement suggestion entitlements and group opt-out on the server", async () => {
    const before = await db.query("select * from public.group_balances($1)", [
      group,
    ]);
    const plan = await rpc<{ currency: string; amount_minor: number }[]>(
      "settlement_plan",
      [group],
    );
    expect(plan.length).toBeGreaterThan(0);
    expect(plan.every((p) => Number(p.amount_minor) > 0)).toBe(true);
    expect(
      (await db.query("select * from public.group_balances($1)", [group])).rows,
    ).toEqual(before.rows);
    await rpc("set_settlement_simplification", [group, false]);
    await expect(rpc("settlement_plan", [group])).rejects.toThrow("disabled");
    await rpc("set_settlement_simplification", [group, true]);
  });
  it("restricts complimentary access to operators, members and its validity period without inventing purchases", async () => {
    await actor(a);
    const reviewGroup = await rpc<string>("create_group", [
      "Review access",
      "INR",
    ]);
    const insert = `insert into public.group_subscription_entitlements
      (group_id,purchaser_id,status,expires_at,renews,complimentary_reason)
      values($1,$2,'active',now()+interval '1 year',false,'Complimentary review access')`;
    await expect(db.query(insert, [reviewGroup, a])).rejects.toThrow();
    await db.exec("reset role");
    await expect(
      db.query(
        `insert into public.group_subscription_entitlements
      (group_id,purchaser_id,status,expires_at,renews)
      values($1,$2,'active',now()+interval '1 year',false)`,
        [reviewGroup, a],
      ),
    ).rejects.toThrow();
    await db.query(insert, [reviewGroup, a]);
    await expect(
      db.query(
        "update public.group_subscription_entitlements set renews=true where group_id=$1",
        [reviewGroup],
      ),
    ).rejects.toThrow();
    expect(
      (
        await db.query(
          "select * from public.billing_purchases where group_id=$1",
          [reviewGroup],
        )
      ).rows,
    ).toHaveLength(0);
    await actor(a);
    expect(await rpc("has_group_feature", [a, reviewGroup, "analytics"])).toBe(
      true,
    );
    await actor(outsider);
    expect(
      await rpc("has_group_feature", [outsider, reviewGroup, "analytics"]),
    ).toBe(false);
    expect(
      (
        await db.query(
          "select * from public.group_subscription_entitlements where group_id=$1",
          [reviewGroup],
        )
      ).rows,
    ).toHaveLength(0);
    await db.exec("reset role");
    await db.query(
      "update public.group_subscription_entitlements set expires_at=now()-interval '1 minute' where group_id=$1",
      [reviewGroup],
    );
    await actor(a);
    expect(await rpc("has_group_feature", [a, reviewGroup, "analytics"])).toBe(
      false,
    );
  });
  it("preserves the billing contract when a settled payer leaves after ownership transfer", async () => {
    const balances = await db.query<{
      currency: string;
      balance_minor: number;
    }>("select * from public.group_balances($1) where user_id=$2", [group, a]);
    for (const balance of balances.rows) {
      const amount = Number(balance.balance_minor);
      if (!amount) continue;
      const sender = amount > 0 ? b : a;
      const recipient = amount > 0 ? a : b;
      await actor(sender);
      const payment = await rpc("create_settlement", [
        {
          group_id: group,
          from_user: sender,
          to_user: recipient,
          amount_minor: Math.abs(amount),
          currency: balance.currency,
          method: "cash",
          idempotency_key: randomUUID(),
        },
      ]);
      await actor(recipient);
      await rpc("respond_settlement", [payment, "confirm"]);
    }
    await actor(a);
    await rpc("manage_member", [group, b, "transfer"]);
    await rpc("manage_member", [group, a, "leave"]);
    expect(await rpc("has_group_feature", [a, group, "analytics"])).toBe(false);
    expect(
      (
        await db.query(
          "select * from public.billing_purchases where purchaser_id=$1",
          [a],
        )
      ).rows,
    ).toHaveLength(1);
    await actor(b);
    expect(await rpc("has_group_feature", [b, group, "analytics"])).toBe(true);
    await rpc("archive_group", [group]);
    await expect(rpc("create_expense", [expense()])).rejects.toThrow(
      "archived",
    );
  });
});

describe("group lifecycle and complimentary launch access", () => {
  let lifecycle: string, token: string;
  it("allows only the owner to restore, preserving all members and expense history", async () => {
    await actor(a);
    lifecycle = await rpc("create_group", ["Lifecycle QA", "INR"]);
    token = await rpc("invite_member", [lifecycle, "b@example.com"]);
    await actor(b);
    await rpc("accept_invitation", [token]);
    await expect(rpc("delete_group", [lifecycle])).rejects.toThrow(
      "Owner required",
    );
    await actor(a);
    await rpc("archive_group", [lifecycle]);
    await actor(b);
    await expect(rpc("restore_group", [lifecycle])).rejects.toThrow(
      "Owner required",
    );
    await actor(a);
    await rpc("restore_group", [lifecycle]);
    expect(
      (
        await db.query<{ archived_at: string | null }>(
          "select archived_at from public.groups where id=$1",
          [lifecycle],
        )
      ).rows[0]?.archived_at,
    ).toBeNull();
    expect(await rpc("is_group_member", [lifecycle])).toBe(true);
    expect(
      (
        await db.query(
          "select * from public.expense_audit_events where group_id=$1 and event_type='group_restored'",
          [lifecycle],
        )
      ).rows,
    ).toHaveLength(1);
  });
  it("rejects deletion with balances in another currency or unresolved payments", async () => {
    await actor(a);
    const e = await rpc("create_expense", [
      expense({ group_id: lifecycle, currency: "USD" }),
    ]);
    await expect(rpc("delete_group", [lifecycle])).rejects.toThrow(
      "outstanding balances",
    );
    await rpc("reverse_expense", [e, 1, randomUUID()]);
    const payment = await rpc("create_settlement", [
      {
        group_id: lifecycle,
        from_user: a,
        to_user: b,
        amount_minor: 100,
        currency: "INR",
        method: "cash",
        idempotency_key: randomUUID(),
      },
    ]);
    await expect(rpc("delete_group", [lifecycle])).rejects.toThrow(
      "pending or disputed",
    );
    await actor(b);
    await rpc("respond_settlement", [payment, "dispute"]);
    await actor(a);
    await expect(rpc("delete_group", [lifecycle])).rejects.toThrow(
      "pending or disputed",
    );
    // This fixture remains disputed on purpose. Delete checks use a separate
    // fully settled group so they do not rewrite or bypass payment history.
  });
  it("removes a settled group from every member while retaining the immutable financial audit and revoking links", async () => {
    await actor(a);
    lifecycle = await rpc("create_group", ["Settled deletion QA", "INR"]);
    token = await rpc("invite_member", [lifecycle, "b@example.com"]);
    await actor(b);
    await rpc("accept_invitation", [token]);
    await actor(a);
    const retained = await rpc("create_expense", [
      expense({
        group_id: lifecycle,
        participants: [{ user_id: a, value: 1 }],
      }),
    ]);
    await actor(a);
    const unused = await rpc("invite_member", [lifecycle]);
    await rpc("archive_group", [lifecycle]);
    await rpc("delete_group", [lifecycle]);
    expect(
      (await db.query("select id from public.groups where id=$1", [lifecycle]))
        .rows,
    ).toHaveLength(0);
    await expect(rpc("restore_group", [lifecycle])).rejects.toThrow(
      "Group access denied",
    );
    await expect(rpc("accept_invitation", [token])).rejects.toThrow();
    await expect(rpc("invitation_preview", [unused])).rejects.toThrow();
    await actor(b);
    expect(await rpc("is_group_member", [lifecycle])).toBe(false);
    await expect(rpc("group_balances", [lifecycle])).rejects.toThrow(
      "Group access denied",
    );
    await db.exec("reset role");
    expect(
      (
        await db.query(
          "select * from public.financial_ledger_entries where group_id=$1",
          [lifecycle],
        )
      ).rows.length,
    ).toBeGreaterThan(0);
    expect(
      (
        await db.query(
          "select * from public.expense_audit_events where group_id=$1 and event_type='group_deleted'",
          [lifecycle],
        )
      ).rows,
    ).toHaveLength(1);
  });
  it("unlocks Plus for existing and newly created groups without fabricating purchases and prevents checkout", async () => {
    await db.exec("reset role");
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/202611040001_early_access.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await actor(outsider);
    expect(await rpc("group_plus_early_access")).toBe(true);
    const fresh = await rpc("create_group", ["New early access group", "USD"]);
    for (const feature of [
      "analytics",
      "budgets",
      "reports",
      "recurring",
      "itemized",
      "custom_rules",
      "settlement_plan",
    ])
      expect(await rpc("has_group_feature", [outsider, fresh, feature])).toBe(
        true,
      );
    expect(
      await rpc("has_group_feature", [outsider, otherGroup, "analytics"]),
    ).toBe(true);
    expect(await rpc("has_group_feature", [a, fresh, "analytics"])).toBe(false);
    expect(
      await rpc("has_group_feature", [outsider, fresh, "receipt_scan"]),
    ).toBe(false);
    expect(
      (
        await db.query(
          "select * from public.group_subscription_entitlements where group_id=$1",
          [fresh],
        )
      ).rows,
    ).toHaveLength(0);
    await expect(
      rpc("begin_group_purchase", [fresh, "tracksy_group_monthly"]),
    ).rejects.toThrow("free during early access");
    await expect(
      db.query(
        "update public.product_flags set enabled=false where key='group_plus_early_access'",
      ),
    ).rejects.toThrow();
    await db.exec("reset role");
    await db.exec(
      "update public.product_flags set enabled=false where key='group_plus_early_access'",
    );
    await actor(outsider);
    expect(await rpc("has_group_feature", [outsider, fresh, "analytics"])).toBe(
      false,
    );
    await db.exec("reset role");
    await db.exec(
      "update public.product_flags set enabled=true where key='group_plus_early_access'",
    );
    await actor(a);
  });
});
