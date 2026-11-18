# Security and privacy implementation notes

## Implemented boundaries

- Public client keys are never a privilege mechanism. RLS restricts reads; sensitive writes require scoped RPCs.
- The private schema is inaccessible to ordinary roles. Membership helpers are owned functions with an empty search path, avoiding recursive member policies.
- Financial RPCs require identity and group access, validate all participant/payer eligibility, reject unbalanced input, use integer/NUMERIC arithmetic, and run atomically. Corrections check versions under a row lock.
- Ledger, audit and billing event history are append-only. No ordinary role may change ledger or entitlement rows directly.
- Invitations use random high-entropy tokens stored only as hashes, with expiration and verified-email binding. Only owners/admins invite members.
- Receipt objects are private with per-group paths and uploader identity checks. Views use short-lived signed URLs. Upload MIME/size limits are set in the bucket. Antivirus, orphan cleanup, and metadata stripping remain operational work.
- Native tokens are encrypted with SecureStore; browser tokens stay in memory. Administrator server cookies use HttpOnly and secure production cookies. Client logs never intentionally contain auth tokens, passwords, or financial payloads. Sentry has default PII disabled; redaction review is still needed.
- The admin aggregate RPC requires a trusted role claim and AAL2 and appends an access audit event. It returns counts, not group expense details.
- RevenueCat webhooks require a secret authorization header and server API re-verification, with strict product, store, environment, ownership and transaction validation. There is no client route to alter entitlements.
- Worker endpoints require dedicated secrets. Push bodies contain only a generic notification and group routing ID, even if detailed preview preference is enabled; sensitive data is never added by the current sender.

## Required review

This is not a security audit. Before launch, test Supabase's live grants/JWT claims, OAuth and email link attacks, storage object ownership, push registration abuse, group/purchase concurrency, session revocation timing, admin role removal, SSRF boundaries for any future AI provider, and all server response redaction. Deferred constraint triggers enforce a zero-sum ledger event per source/currency even for accidental privileged inserts. Composite keys enforce source-group membership, and financial source/purchase beneficiary fields are immutable.

There are bounded expense/invitation/group rate checks, but a full distributed API rate limiter and abuse controls are incomplete. All nonfinancial mutations also need comprehensive idempotency coverage. User deletion is currently a request workflow and must not be presented as completed erasure.

## Retention and deletion operator workflow

Do not hard-delete profiles referenced by shared financial records. A deletion request must be reviewed for owned groups, store subscriptions, outstanding balances, receipt retention, legal retention requirements and backups. An approved erasure/anonymization job must scrub private identity data, revoke sessions, remove device tokens and personal uploads, and preserve minimally necessary shared audit information. The worker and policy-specific retention durations are not implemented. Do not promise an automatic timeline until approved policy and tooling exist.

Privacy policy and terms need professional review for the actual operator, countries, processors and retention. The placeholder document is a drafting checklist, not a legally approved policy.
