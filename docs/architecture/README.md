# System boundaries

Clients authenticate directly with Supabase using public keys and user sessions. Reads pass through table RLS. Financial writes call narrowly granted `SECURITY DEFINER` functions with an empty search path, explicit identity/membership/role checks, database validation and one transaction.

The `private` schema is not exposed through PostgREST. PostgreSQL's default public execute privilege is revoked. Ledger and audit tables reject update/delete through append-only triggers, including privileged accidental updates. Only granted RPCs create financial entries.

Amounts are bounded integer minor units. Percentage input is integer basis points. Weighted allocation uses exact NUMERIC multiplication on the server and BigInt in the shared preview engine. Remaining minor units go to largest fractional remainders, ties by member UUID. Participant shares sum to the total; payer totals must match. Expense ledger credits payers and debits participants, summing to zero for each expense/currency. Settlement confirmation credits the sender's balance and debits the recipient's balance.

An edit locks the original expense, checks its version and authorization, appends reversing ledger entries, and inserts a replacement expense. The old record stays visible as reversed. Failure rolls back the entire correction. Full refunds can be represented by reversal; partial refunds require an explicit correction to the remaining total/shares, preserving both events.

Financial idempotency is scoped to authenticated user and UUID key. An advisory transaction lock serializes duplicates. A hash binds the key to operation and payload; reuse with different content fails. Recurring runs use a unique `(rule,scheduled_date)` and the run's UUID as expense idempotency key. Month-end rules retain their anchor day.

Offline drafts are private device records, never confirmed ledger rows. Synchronization replays the original idempotency key through the same database validation. Inactive participants and stale corrections fail and stay available for review; there is no last-write-wins mutation of confirmed financial history.

Billing identities and group entitlements are separate. The client initiates a group-bound intent and invokes native store UI. Only an authenticated server webhook followed by a RevenueCat subscriber re-fetch can apply entitlement state. The store SDK never grants database access. See [billing](../billing/README.md).

Realtime invalidates cached queries for authorized rows. Cached data is cleared on account change and logout. Current group overview queries use a per-group balance RPC; batching and pagination must be benchmarked before supporting thousands of groups.
