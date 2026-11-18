# Implementation and acceptance status

Updated 4 November 2026. This file distinguishes source implementation from service, device, and launch verification.

## Latest mobile testing build

**Current: 0.6.0/code 8.** Adds owner-only group restoration and deletion, per-currency group-card balances, top-right active/all/owing/owed/settled/archived filters, clipped keyboard-aware invitation sheets, complimentary Group Plus and aligned currency selectors. Backend migrations are deployed and live synthetic QA checks passed without altering personal groups. Workspace types and 73 tests passed; Chromium/WebKit mobile and dark-theme checks passed. Signed package verification passed. Physical-device acceptance remains with the user. See [0.6.0 details](deployment/GROUPS-0.6.0.md).

Google Play status: **Changes in review** for the existing Alpha closed test. The shared web source is updated, but web publication is pending because the connected Sites account cannot find the original project.

The earlier **0.5.0** release is published to selected testers (confirmed in Play Console on 4 November). Its web interface remains live at https://tracksy-app.souravsharma191919.chatgpt.site until the 0.6.0 web update can be deployed.

**Earlier: 0.5.0/code 7.** Sign-out leaves protected navigation after the auth event while encrypted-cache cleanup finishes independently, and no longer refreshes protected profile queries. Settings respond immediately, serialize/coalesce rapid taps and restore the previous value when a final save fails. Expense entry defaults to **Paid by You / Split Equally**; payer and split changes open directly, and optional category/date/notes live under Details. The last saved active group is remembered per account. Shared native forms, sheets and required-name entry use keyboard-aware scrolling and avoidance. Two generated transparent illustrations appear only in empty states.

Workspace types and **67 tests** passed, including delayed cache cleanup at sign-out and settings coalescing/rollback. Chromium and WebKit passed at 320/390/430px, including quick entry, split changes, reduced keyboard height, delayed network saves, failure rollback, themes and one-tap logout. Separate production-Worker and live-site checks passed persisted sign-in without a login flash, direct-route reload, keyboard-height sheets, installation metadata, service-worker activation and sign-out. Regular-member editing preserved original participants, comments and history; scoped synthetic entries were reversed. Physical Android keyboard and permission acceptance remains unverified.

Signed artifacts: `artifacts/Tracksy-0.5.0-arm64.apk` and `.aab`. APK SHA256 `b762d1d48ab6856d164cefd551440e083943fb8ec7f673d2cf22c85b34de1a6e`; AAB SHA256 `8704d2da9de2836956933df13b4073d31f4cb7e3182be231b89514af4be46738`. Signature, 16 KB alignment, backend configuration, artwork and APK/AAB embedded-bundle matching passed. Native source maps include the keyboard controller and contain zero NativeWind/CSS-interop modules. Existing release certificate retained.



The same app is also hosted for mobile browsers at https://tracksy-app.souravsharma191919.chatgpt.site, with Home Screen installation, persisted browser sign-in, native-style viewport sizing and direct-route server fallback. See [web deployment](deployment/WEB-APP.md) for checks, limitations and rebuild instructions.

**Earlier: 0.4.1/code 6.** Found an Android rendering fault missed by browser checks: CSS interop flattened Pressable style callbacks and discarded button/row geometry. Removed its unused Babel/Metro interception; controls now use direct React Native styles. Android-config regression checks cover buttons, icon touch areas and profile rows in both themes. Bundle inspection confirms no styling interceptor remains; APK/AAB embedded bundle hashes match that inspected build. Form headers and primary actions stay fixed while fields scroll; settlements use labelled pickers. Types, all 61 tests, 32 browser checks, five-width light/dark reviews and narrow/reduced-height form reviews passed. Physical Android runtime remains unverified because no device is connected. Google Play confirms **0.4.1 Changes in review**, with quick checks running; 0.4.0 is published. Earlier release history follows.

**Earlier: 0.4.0/code 5.** Profile now uses settings rows/sheets and real notification switches; group headers and theme contrast are simpler. Names come from the profile or Google metadata; unnamed accounts must supply a name. Email invitations, HTTPS sharing and sign-in continuation are live. Active members can edit expenses with actor/version history and retained comments/receipts. Saved participants stay explicit, and joining never changes earlier splits. Eligible creditors can send reminder emails. Native startup waits for session and encrypted per-user cache restoration. Types, 57 tests, 32 browser checks, five-width light/dark reviews and signed package verification passed. Live invitation, editing and preference-persistence checks passed. Physical Android acceptance remains pending; phone alerts cover foreground use and background push is unconfigured.

Earlier artifacts: `artifacts/Tracksy-0.4.0-arm64.apk` and `.aab`. Invitation/support/privacy pages are deployed. Google Play 0.4.0 shows **Changes in review**, with quick checks running; 0.3.0 remains published for selected testers. See [Play setup](deployment/PLAY-CONSOLE.md). The Spiti diagnostic did not reproduce automatic assignment in the saved records; no personal financial records were changed. The paragraphs below retain earlier release history.

Version **0.3.0/code 4** implements the supplied emerald native-app reference: illustrated sign-in and group header, compact balance cards and round actions, four bottom tabs with a central add button, native date picker, bottom-sheet selectors, participant avatars and actual-data analytics charts. Signup includes full name and password confirmation. Google OAuth is configured in the existing Tracksy Cloud project and Supabase; browser Google login successfully returned to the signed-in home. The public privacy page describes basic Google account data. Types, 45 unit/database tests, 32 browser checks and authenticated reviews at five widths passed. Signed APK/AAB verification passed. Android runtime, keyboard and OAuth handoff still require physical-device acceptance. See [artwork provenance](ARTWORK.md) and [testing instructions](../artifacts/TESTING.md).

Version **0.2.1/code 3** fixes authentication usability and accompanies the repaired Gmail SMTP service. Fresh hosted signup, inbox confirmation, password login and recovery delivery passed. The APK adds email normalization, separate login/signup validation, resend confirmation and clear errors/timeouts. Workspace types, 45 tests and 28 browser checks passed. Signed APK/AAB verification passed; physical Android acceptance remains pending. See [hosted repair](deployment/HOSTED-SETUP.md) and [current artifact](deployment/ANDROID-APK.md).

Version 0.2.0 (code 2) replaces the earlier game-like theme with simple system typography, neutral surfaces, clear blue actions, and standard bottom navigation. Signup navigation is above the form; buttons and cards retain their height, narrow layouts stack, and reduced-height forms scroll. All five tabs and core forms were checked at phone widths from 320px, including tab-label clipping checks.

Latest signed ARM64 APK and AAB are available under `artifacts/Tracksy-0.2.1-arm64.*`. The previous 0.2.0 responsive build passed its 40 tests, 22 browser checks and authenticated responsive review. Physical Android runtime and keyboard/inset acceptance remain pending.

The public support, privacy and deletion-request site is hosted at https://tracksy-support.coralprawn64.chatgpt.site. Play Console has the listing and content declarations, reviewer credentials with verified complimentary QA Plus access, the existing Testers list, all 178 available countries and the user-selected 13+ audience. The initial 0.2.0 Alpha release is now marked **Available to selected testers**. The 0.2.1 authentication update was submitted separately and shows **Changes in review**, with quick checks still running. The complimentary-access migration was applied after explicit user approval. No 14-day test completion is claimed. See [Play setup](deployment/PLAY-CONSOLE.md) for current state.

## Implemented locally

- npm workspaces, strict TypeScript, shared validation/financial/domain/UI packages.
- Expo development-build configuration; Router; four visible tabs and activity route; direct React Native styled controls; light/dark palettes; React Hook Form; Query cache; Zustand preferences.
- Supabase email/password registration, email verification, password reset, PKCE callback, Google OAuth and iOS Apple OAuth entry points. Provider configuration and device testing remain required.
- Native encrypted session storage with chunking; refresh lifecycle; per-device and global logout. Browser sessions and selected per-user cache records use encrypted IndexedDB with seven-day expiry and sign-out removal; restricted browsers fall back to tab memory. PKCE proofs expire after one hour. All browser encryption keys are origin-scoped and non-extractable; this does not defend against same-origin script compromise.
- Group creation, update, types, currency, icons, search, active/archive filters; members; email-bound single-use invitations; verified-email acceptance; owner/admin/member checks; separate billing-manager privilege; ownership transfer; safe leave/removal; archive.
- Expenses, multiple payers, participant selection, equal/exact/percentage/weighted/custom splits, date/category/notes, search and pagination, duplication, auditable corrections, reversal, comments, receipt upload and expiring signed links.
- Itemized receipt allocation by integer quantity shares, including tax, tips, and negative discount lines; shares recalculated on the database. Group Plus enforced.
- Append-only, zero-sum expense/settlement ledger; balances separated by currency; immutable audit events; optimistic version checks and payload-bound idempotency for financial mutations.
- Pending cash/bank/UPI/other payment records; counterparty confirmation; disputes; reversal; UPI app links clearly distinguished from confirmation. No custody or provider-verified bank transfer claims.
- Group entitlements, immutable purchase-to-beneficiary mapping, purchase intents, RevenueCat client integration, restore and management entry points, authenticated webhook + server subscriber re-fetch, duplicate/stale event handling, expiration/refund/cancellation/grace status handling. Only one immutable beneficiary group per paying account is supported in the first release.
- Group budgets, deterministic category/month analytics, optional net-balance settlement suggestions, CSV export, PDF report generation, recurring schedules with explicit fixed-expense authorization or per-run approval, idempotent scheduled runs, stop recurrence. Saved split rules can be created from an expense and loaded into a new expense for explicit review before posting. A standalone custom rule editor remains pending.
- User-scoped offline drafts, manual retry-safe sync, errors surfaced for conflicts or changed memberships.
- In-app notification records, device push registration, bounded retry worker, per-user quiet hours and generic lock-screen content. External scheduling, Expo delivery receipts, invalid-token cleanup and device delivery remain unverified.
- Next.js operations console: server cookie auth, admin role in trusted app metadata, TOTP enrollment/challenge, AAL2 enforced in database, audited aggregate metrics. No private expense access through the metrics API.

## Verification evidence

See [verification record](deployment/VERIFICATION.md) for final executed checks and limitations. Test suites contain generated rounding checks, actual PostgreSQL migrations and RPCs, and desktop/mobile browser smoke coverage. Production acceptance cannot be inferred from compiled source or these tests alone.

## Still incomplete

- Receipt OCR and conversational AI; provider integration, quotas, consent/retention and cost monitoring are not implemented. Both product flags stay disabled.
- Standalone custom rule editor; category budget editor and budget-alert processing; rich month/member comparisons; comprehensive settlement preferences.
- Trip/household experiences, personal expense tracker, external subscription tracker, wishlist/purchase planner, expense approval workflow, reminder scheduling and reaction/tag support.
- Group cover and profile avatar picker UI; profile/avatar storage exists. Join requests and invitation revocation UI.
- Full end-to-end Hindi translation. English/Hindi navigation labels and preference persistence are implemented; most body copy remains English.
- Automatic connectivity-driven draft synchronization, conflict-resolution editing UI, draft expiration/device cleanup. Current synchronization is explicit and server-authoritative.
- Account erasure/anonymization worker, retention/legal policy approval, self-service data export across the entire account. The current deletion flow records a request and requires a documented operator process.
- Background push delivery, full notification taxonomy and receipt polling; advanced reminder frequency controls. Foreground permission/status and expense/settlement/email-reminder switches are implemented.
- Stripe checkout, regional product management, verified revenue/churn/MRR/ARR, support triage/search, flag controls and detailed billing diagnostics in the admin console.
- Separate Next.js expense web client. The current cross-platform web client is Expo Web.
- React Native Reusables package integration; current reusable controls are custom. Complete motion, bottom-sheet, toast, skeleton and reduced-motion/accessibility audits.
- Idempotency keys for all nonfinancial mutations. Financial expense, correction, reversal and settlement paths are protected; some group/settings/comments operations remain ordinary transactional writes.
- Comprehensive rate limiting, paginated group loading and query profiling, backup/restore exercises, retention jobs, security audit, dependency advisory remediation, load testing and native device E2E.

## External setup / launch blockers

1. Hosted Supabase is configured and core multi-user Auth/RPC, storage, Realtime, and Gmail SMTP checks passed. Native device flows and completion of emailed authentication links still require acceptance testing. See [hosted setup](deployment/HOSTED-SETUP.md).
2. Paid billing still requires RevenueCat project/webhook/store configuration, product review and sandbox transactions. Google developer/closed-test setup exists; Apple setup remains pending. Keep restore behavior set to retain original purchase ownership; automatic transfers and family sharing are unsupported.
3. Signed standalone ARM64 APK/AAB verification passed. Device acceptance, EAS/Firebase background push credentials and iOS signing/builds remain pending. Google closed testing is configured; current submission state is recorded separately. See [Android build instructions](deployment/ANDROID-APK.md).
4. Scheduled worker invocations and secrets must be configured. Push ticket acceptance is not delivery verification. Receipt polling and invalid-token cleanup remain required.
5. Dependency audit has unresolved Expo SDK 55 toolchain advisories; see the verification record. Do not claim launch readiness while these and the incomplete acceptance items remain.

## Phase mapping

Foundation and core sharing have substantial source implementation, local tests, and hosted service checks. Native device acceptance remains pending. Billing, premium features, and operations are partial. Advanced modules and production-readiness requirements remain open. No phase is marked launch complete.
