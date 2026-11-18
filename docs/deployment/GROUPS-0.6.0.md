# Group lifecycle and early access, 0.6.0

The 4 November 2026 update adds owner-only restoration and deletion, larger per-currency card balances, top-right group filters, clipped keyboard-aware invitation sheets, aligned currency selectors, and complimentary Group Plus during early access.

## Backend

Applied migrations `202611040000_group_lifecycle.sql` and `202611040001_early_access.sql` together in a transaction in the existing Tracksy Supabase project. The SQL editor confirmed `group_lifecycle_and_early_access_ready` and `early_access = true`.

Restoration clears the archived date without changing memberships or financial records and records `group_restored` in activity. Deletion is owner-only and blocked by any member's nonzero balance in any currency, pending/disputed payments, or a renewing active store subscription. It marks the group deleted and unavailable through membership-based RLS, stops recurring rules, expires invitations, fails pending mail jobs, and retains the immutable financial/audit records. The UI explains removal for everyone and retention before confirmation. No existing personal group was deleted during development.

The server flag `product_flags.group_plus_early_access` enables supported Plus features for every active member of existing and future groups, without creating purchases or subscription entitlements. Feature-specific disable settings and manager permissions remain enforced. Receipt scanning and AI assistance remain excluded. A dedicated authenticated RPC reports the launch flag to the app, whose Plus page explains the complimentary period and future paid plans. The backend prevents beginning a store checkout while this flag is enabled. Turning the flag off later restores the existing entitlement checks; it does not charge anyone automatically.

## Verification

Workspace types and **73 automated tests** passed. Actual PostgreSQL tests cover owner permissions, restoration/audit, debt in another currency, unresolved payments, RLS after deletion, retained ledger records, invalidated invitations, access for new and existing groups, checkout prevention, and ending the launch flag. Filter tests cover multi-currency amounts without offsetting unlike currencies, owing/owed/settled states, archive visibility and search.

Chromium and WebKit at 320/390/430px passed card/filter controls, reduced-height invitation input and action visibility, deletion disclosure, complimentary Plus copy and KWD currency alignment. This initial visual pass mocked only the launch-status RPC while deployment was pending; it did not submit invitations, deletions or purchases.

A separate live browser/API check used a new synthetic QA group with two members. It verified both members received all supported Plus features without an entitlement, non-owner deletion and checkout were rejected, the archived filter and two currency balances appeared, restoration preserved exact balances and wrote activity, deletion while indebted was rejected, budget access worked, and owner-confirmed deletion of the settled group removed access for both members. Scoped synthetic expenses were reversed and the temporary group removed; personal financial records were untouched.

Physical Android keyboard/device acceptance remains for the user, who chose to test the APK themselves. APK/AAB verification and deployment status are recorded separately in the release artifact and Play Console notes.

The signed 0.6.0/code 8 APK and App Bundle passed package/signature checks, 16 KB alignment, the configured backend/public key, bundled artwork, native keyboard integration, direct-native controls, and the newly required group/early-access strings. The embedded APK/AAB bundle hashes match the inspected native bundle. Existing certificate SHA256 `8dcb70bdbe134eff879cd59a67c1b491e9e49918cbf8818e2bc6c6ebae81ad46` was retained. APK SHA256: `f69b48df862af936d487bbba6ce62cca02f690377decf0419f411beb95559f61`; AAB SHA256: `565658596a58db3ac14edfcc70cbc7f501b2e7d5427ba1714bd0473879992c9c`. All 32 existing browser authentication/responsiveness regressions also passed.

Play validation confirmed code 8/0.6.0, unchanged device coverage compared with the prior release, no errors and the existing missing-deobfuscation warning (R8 is disabled). The existing Alpha track, tester selection and all 178 countries were retained. No private QA screenshots or new credentials were uploaded.

Saved release `7`, completed **Submit 1 change for review > Send changes for review**, and verified **Changes in review** for **0.6.0 - Groups and free early access**. Quick checks were running (up to 14 minutes remaining); managed publishing is off. Google approval is not claimed. The previous 0.5.0 release remains published for selected testers.

## Hosted web

The shared Expo web source is updated, but the Sites connection reports `project_not_found` for the existing app project `appgprj_6ae4a1bfad848191a6eaafd1804b6221`. The user has been asked to switch to its owning account/workspace. Preserve this identity and public audience; do not create a replacement Site. No 0.6.0 web deployment is claimed until the original project can be opened and published through the Sites workflow.
