# Verification record

## Faster everyday expenses 0.5.0 — 1 November 2026

**Current: 0.5.0/code 7.** Sign-out leaves protected navigation after the auth event while encrypted-cache cleanup finishes independently, and no longer refreshes protected profile queries. Settings respond immediately, serialize/coalesce rapid taps and restore the previous value when a final save fails. Expense entry defaults to **Paid by You / Split Equally**; payer and split changes open directly, and optional category/date/notes live under Details. The last saved active group is remembered per account. Shared native forms, sheets and required-name entry use keyboard-aware scrolling and avoidance. Two generated transparent illustrations appear only in empty states.

Workspace types and **67 tests** passed, including delayed cache cleanup at sign-out and settings coalescing/rollback. Chromium and WebKit passed at 320/390/430px, including quick entry, split changes, reduced keyboard height, delayed network saves, failure rollback, themes and one-tap logout. Separate production-Worker and live-site checks passed persisted sign-in without a login flash, direct-route reload, keyboard-height sheets, installation metadata, service-worker activation and sign-out. Regular-member editing preserved original participants, comments and history; scoped synthetic entries were reversed. Physical Android keyboard and permission acceptance remains unverified.

Signed artifacts: `artifacts/Tracksy-0.5.0-arm64.apk` and `.aab`. APK SHA256 `b762d1d48ab6856d164cefd551440e083943fb8ec7f673d2cf22c85b34de1a6e`; AAB SHA256 `8704d2da9de2836956933df13b4073d31f4cb7e3182be231b89514af4be46738`. Signature, 16 KB alignment, backend configuration, artwork and APK/AAB embedded-bundle matching passed. Native source maps include the keyboard controller and contain zero NativeWind/CSS-interop modules. Existing release certificate retained.

The mobile app Site is version 3, source `37e768e9f5ba9946c0f4a86c1e4575be0d55d4e5`, deployment `appgdep_6ae74afcdc40819180b2415ed7508ca2` (succeeded). The build removes only its checked generated `public` directory before export, preventing obsolete route folders from shadowing the runtime. Network-mocking checks block service workers; separate checks verify real service-worker activation and browser persistence. These checks use browser emulation, not physical-phone acceptance.

## Hosted mobile app - 30 October 2026

- Built the actual Expo mobile app for web, preserving its screens, navigation, images, shared backend and account data. Added installation metadata/icons, visual-viewport and modal keyboard sizing, live theme-color updates and encrypted browser session/cache persistence. Web records expire after seven days; PKCE proofs still expire after one hour. Root invitation handling now accepts trailing slashes.
- All workspace types and **63 tests** passed, including browser storage across module reloads, sign-out removal and expiry. The server project type check and production build passed.
- Chromium and WebKit at 320/390/430px passed authenticated reload without a login flash, direct group reload, fixed expense action area, light/dark profile layouts, reachable Save inside a 330px keyboard-height sheet, standalone manifest, active service worker and sign-out/reload. Private QA screenshots remain local.
- Live production checks at 390px passed the same flows in both engines. Public HTTP checks returned 200 for the Auth callback and direct group URL; the exact server runtime also passed group/expense route and MIME-type checks. An initial static-host deep-link 404 and generated worker syntax error were fixed before final acceptance. The install build now validates generated scripts; the deployed runtime has no obsolete static redirect rule.
- The former support hostname redirects to the current canonical hostname and serves the updated browser invitation option. No personal financial records were changed. A physical iPhone was not connected; WebKit emulation is not device acceptance. Native-only device/purchase APIs remain unavailable in a browser.
- Live iPhone-UA/WebKit invitation check passed: the legacy support link preserved its token through the hostname redirect, the browser option was primary and the Android store link hidden, login retained the invitation, and the existing member reopened/reloaded the group. Every saved split remained identical.
- App Site v2/source `e3c87cea76ee8ec4a306fa60d744604a6d3d8abb`, deployment `appgdep_6ae4b354b59c8191be2294e00f9492dd`, succeeded at https://tracksy-app.souravsharma191919.chatgpt.site. See [web hosting notes](WEB-APP.md) and [backend setup](HOSTED-SETUP.md).

## Native styling correction 0.4.1 - 30 October 2026

Earlier browser reviews bypassed Android's CSS interop runtime. Installed interop collected inline Pressable style functions and cloned them as objects, discarding their returned geometry/colors. Eight shared callback sites included buttons, text links, profile rows, icon controls and the centre Add control. The app uses no className styling, so its unnecessary NativeWind Babel replacement and Metro wrapper were removed. Web keyboard focus CSS remains.

- Four regression checks compile real component source with the actual Android Babel configuration: direct native element types, retained callbacks, touch dimensions, alignment, colors, pressed/disabled feedback, icon controls and settings rows in both themes. This compiled-component harness is not hardware rendering proof.
- Workspace types and **61 tests** passed; **32 browser checks** passed. Five-width authenticated light/dark reviews passed. Live editing passed with the fixed Save changes area, preserving participants/comments/history; scoped synthetic entries were reversed.
- Group/expense/payment headers and primary actions remain outside scrollable fields. Unsaved forms passed at 320/390px and reduced 330px height; no groups, expenses or settlements were submitted in these layout checks. Settlement button stacks became labelled pickers with a shorter Record payment action.
- Native source map contains **zero NativeWind/react-native-css-interop modules**. Verification compares embedded APK/AAB bundle hashes with that inspected native build, alongside signatures, alignment, version, artwork and backend settings.
- Signed **0.4.1/code 6**: APK SHA256 `f7d8b0354c9a7aec91651fa9fcf5682a2e97741d3abf54179f62f2452c3ec15d`; AAB `e9498ea42a20a1449d98da7d2a9afc26161467eb1b465917ebe6a50b46c69c16`. Existing certificate retained. No connected Android hardware/emulator; physical keyboard, permissions and handoff remain unverified. Background push stays unconfigured.

## Sharing and usability 0.4.0 - 30 October 2026

- Workspace types and **57 tests** passed after the final change. Actual PostgreSQL coverage includes member corrections/audit, unchanged old splits after joining, email-bound invitations, outbox privileges/idempotency, reminder eligibility/preferences/cooldown and version history. Cache tests cover interrupted encrypted writes and authentication return routing. **32 browser checks** passed.
- Authenticated light/dark reviews passed at 320/360/390/412/768px: profile/settings sheets, switches, invitation sharing/copying, group settings, charts and reachable expense actions. No page errors or horizontal overflow observed. Private QA screenshots were not uploaded publicly.
- Live regular-member editing deliberately delayed original loading: saving remained unavailable until hydration, original participants stayed selected, replacement actor/totals were correct, and earlier comments plus two-version history remained visible. Scoped synthetic entries were reversed afterward.
- Published HTTPS invitation and app deep link passed. An owned verified Gmail alias followed the link through sign-in/name onboarding and joining. Every earlier split stayed identical and the new member had no ledger balance. Reopening the accepted link was safe; temporary membership was removed.
- Reminder switch changed visibly, persisted server-side and stayed correct after reopening; the original QA preference was restored. Gmail SMTP accepted an invitation and reminder to owner-controlled Gmail aliases. This is SMTP acceptance, not inbox delivery proof. An earlier reserved example.com QA reminder is excluded from real-delivery evidence.
- Read-only Spiti diagnostic: two Dinner records, saved participant counts 2 and 1, two current members; neither included someone joining after its creation. The reported automatic reassignment was not reproduced in these records. No personal expenses were rewritten.
- Four 20261030 migrations and authenticated group-mail Edge Function deployed. Public support Site v4 deployed with invitation/open-app pages and updated privacy disclosures.
- Signed **0.4.0/code 5**, `app.tracksy.mobile`, ARM64/API24–36. Hermes, artwork, backend/UI strings, signatures and 16KB alignment verified. APK SHA256 `21eca07980fabb6a2ce1f1f3d644a0c30a2920392a56258d851467d020eeac94`; AAB `3ac37a26af24005c1c8391f152caafe5291f288a6c9bc0375b5cb04f7ed89e88`.
- No connected Android device/emulator. Native keyboard, cold-start cache, OS permission changes and Google/browser handoff need device acceptance. Phone alerts cover foreground use; background push is unconfigured.

## Reference-led native design 0.3.0 - 30 October 2026

- Workspace TypeScript checks and all **45 unit/database tests** passed. **32 browser checks** passed, including signup name/password confirmation before network requests, Google cancellation recovery, email error/resend handling, and reduced-height authentication forms.
- Authenticated checks at 320/360/390/412/768px covered home, groups, loaded Plus analytics, profile, group expenses, expense inputs, currency bottom sheets and group creation. No page errors or horizontal page overflow were observed. Light/dark screenshots were inspected locally. Public listing screenshots show unsaved forms and no account identifiers; authenticated record screenshots remain local.
- Existing Chrome completed Google OAuth to Supabase and returned to the signed-in Tracksy home. Public Auth settings confirmed Google enabled. The dedicated web client uses only the hosted Supabase callback. Native flow retains PKCE and `tracksy://auth/callback`. Secrets remain absent from client environment.
- Public support Site v2 deployed with Google privacy disclosures. Apple OAuth, paid store billing, OCR, push delivery and background scheduling remain disabled/unconfigured.
- Signed APK/AAB: **0.3.0/code 4**, `app.tracksy.mobile`, ARM64, minimum API24, target36. Embedded Hermes, backend/auth settings, support URL, signatures and 16KB ZIP alignment passed. APK SHA256 `22ed94cc18e9af799eeba969da115385b6d8f6c9f010d1e27a3e1152b8434289`; AAB `ec9e9a9c8c4b2917d33e761cebeb77bf2af678be5829f8db56ad09b1fb19991a`.
- No connected Android device/emulator. Browser OAuth proof does not establish native browser handoff, keyboard or safe-area runtime acceptance.
- Live QA form check posted INR4.80 using equal and exact split methods through the redesigned mobile form. Stored totals were 480 minor units; shares were 240/240 and 180/300 respectively. All check-prefixed synthetic entries were reversed afterward and shared balances restored.

## Authentication repair 0.2.1 - 29 October 2026

- Reproduced public signup HTTP 500 and Gmail SMTP 535 credentials rejection. After replacing the dedicated SMTP credential through the user's verified Google session, the same synthetic owned-alias account completed signup, inbox confirmation and password login. Password-reset email delivery was independently verified in that inbox. New-user email confirmation remains required.
- All workspace type checks and **45 tests passed**. Regression coverage includes email normalization, existing-password login validation, error explanations, stalled Auth fetch cancellation and retry, and preservation of caller cancellation/non-Auth requests.
- **28 browser checks passed**, including failed-email signup retry, unconfirmed-account resend, successful signup instructions and the prior responsive checks. Mock Auth error headers reproduce the live service's CORS API-version exposure.
- Signed 0.2.1/code 3 APK and AAB passed signature checks, 16KB-aware alignment and packaged backend/UI verification, including the new resend/error strings. APK SHA-256: `b4a32df1ce6f32f38d6e8dd6f273bba6e5ad53569a38221ae3f4be2c83070520`; AAB: `abbf5792451509affdb462cf576f8ddec1aea429466f36cb01a4ca0533a479f8`.
- No Android device was connected. Physical keyboard, native confirmation callback and runtime acceptance remain device checks; no device E2E claim is made.

## Responsive 0.2.0 update - 29 October 2026

The latest build supersedes the decorative UI described in the historical follow-up below. It uses system typography, a neutral palette, blue primary actions and standard bottom navigation. Signup actions appear above the form and remain accessible in narrow and reduced-height layouts.

- `npm run check`: all workspace types and **40 tests passed**.
- Browser suite: **22 checks passed**, including 320/360/390/412/768px layouts, minimum control heights, no horizontal overflow, and a 360x330 reduced-height form.
- Authenticated browser review: all five tabs, group detail, expense form, group creation and dark theme at 320/360/390/432/768px; no page errors or clipped controls. An explicit label-bottom check caught the original tab clipping; the final 80px-plus-inset navigation passed.
- All three public support-site pages returned 200 without authentication. The deletion request opens the configured support email.
- Signed 0.2.0/code 2 APK and AAB built successfully. APK v2 signature, 16KB-aware alignment and AAB JAR verification passed. The release verifier checked the embedded hosted project/public key, Hermes, support URL, UI strings, version/package and blocked broad storage/media permissions in both files.
- No connected Android device was available. These checks do not establish physical keyboard behavior, safe-area behavior on hardware or native end-to-end acceptance.
- Reviewer-access follow-up: the complimentary-entitlement migration passed all workspace types and **41 tests**, including operator-only writes, denied outsider access, expiry and no fabricated purchase. After explicit user approval, it was applied to hosted Supabase and the synthetic QA group was granted nonrenewing access through 29 October 2027. Actual QA authentication verified all seven feature permissions plus successful analytics, export and report RPCs. Reviewer credentials and full-access instructions were saved to the authorized Google Play declaration.

Build hashes and the current Play Console state are recorded in [PLAY-CONSOLE.md](PLAY-CONSOLE.md). Historical dependency advisories and unconfigured services below remain applicable; no production-readiness claim is made.

27 October 2026. Executed on Windows with Node 24.21.0. The initial local verification is recorded below; the subsequent hosted development setup is recorded in [HOSTED-SETUP.md](HOSTED-SETUP.md).

| Check                         | Result                      | Scope                                                                                   |
| ----------------------------- | --------------------------- | --------------------------------------------------------------------------------------- |
| `npm run typecheck`           | Passed                      | Shared packages, tests, Expo screens, Next.js app                                       |
| `npm test`                    | **40 passed**, four files   | Finance, PostgreSQL/RLS/RPC integration and encrypted browser PKCE storage              |
| `npm exec -- playwright test` | **6 passed**                | Desktop/mobile authentication UI, protected routes, dark theme and horizontal layout    |
| Expo web export               | Passed                      | Compiled Expo Web SPA                                                                   |
| Expo Android + iOS export     | Passed                      | Hermes JavaScript bundles and native module resolution; not signed device builds        |
| Next.js production build      | Passed                      | Server routes, login, MFA page and session-refresh proxy                                |
| Deno strict check             | Passed                      | Billing webhook, push worker, recurring worker, with pinned SDK dependency and lockfile |
| `npm audit`                   | **8 unresolved advisories** | 5 high, 3 moderate, **0 critical**; launch blocker                                      |

The PostgreSQL suite loads all ten migrations in an isolated PGlite instance, with emulated Supabase JWT functions and storage metadata. It checks multiple-payer and all split methods, deterministic rounding, receipt items/tax/tip/discount, exact ledger balance, corrections, stale versions, reversals, partial payments, counterparty confirmation, private storage paths, RLS, role escalation denial, idempotency replay, immutable source and beneficiary fields, deferred privileged-write constraints, group premium membership/expiry, duplicate/stale billing events, purchase reassignment denial, payer departure/ownership transfer, recurring approvals/posting and saved-rule currency.

The initial local checks did **not** establish live Supabase behavior. Hosted Auth/PostgREST/Storage/Realtime and Gmail SMTP delivery checks were subsequently completed as recorded below. Completion of emailed PKCE links, Android/iOS device behavior, EAS build/signing, store sandbox purchases or restorations, push delivery, production security, and load capacity remain unverified. `npm run test:live` remains limited to disposable local Supabase; the hosted checks used separate disposable QA accounts in the new Tracksy development project.

## UI and hosted development follow-up

The app was redesigned with the PlaySpark visual reference: bundled Fredoka fonts (with SIL OFL license), a navy/violet/gold palette, custom native SVG wallet art and branding, layered cards, tactile buttons, a floating tab bar, and responsive sign-in/dashboard/group/profile screens. Light and dark themes remain available. Unsupported Google/Apple sign-in buttons are hidden until their providers are configured.

- `npm run check` passed again: all workspace TypeScript checks and **40 tests**.
- The expanded browser suite passed **10 tests** across desktop Chrome and Pixel 7 emulation: authentication navigation, route protection, theme/overflow, password visibility with retained input, and invalid recovery email rejection before any Auth request.
- The updated mobile TypeScript check and Expo Web export passed after the Realtime subscription change. The built bundle was checked to contain the hosted URL and public client key; clearing Metro's stale environment transforms was necessary.
- Hosted account/RPC checks passed for authentication, profiles, group access isolation, invitations, exact splitting, idempotency, balances, role protection, and settlement confirmation.
- Hosted service checks passed for Realtime Postgres updates, private receipt upload and attachment, signed member downloads, and blocked public downloads.
- Signed-in browser checks passed at 1440×1050 and 390×844: real sign-in, a populated dashboard, a live cross-user balance update without refreshing, both themes, all five tabs, group detail, and no horizontal page overflow or browser page errors. Synthetic data belongs only to the dedicated QA accounts.
- After tightening the phone dashboard, a final targeted browser check passed at both widths: the secondary balance metrics sit side by side, both themes render correctly, and no page errors or horizontal overflow were introduced. Mobile TypeScript and the final Web export passed.

Two synthetic QA accounts and their dedicated group remain in the development project. Their passwords are protected with Windows DPAPI under ignored `.local` files; no service-role key was retrieved. OAuth, workers, billing, and production-release limitations are listed in [HOSTED-SETUP.md](HOSTED-SETUP.md).

## Gmail SMTP follow-up

Gmail SMTP was activated and verified on 27 October 2026 with a dedicated Google App Password and SSL port 465. The saved non-secret configuration was reloaded and verified. Public Auth signup and recovery requests sent test emails to a unique alias of the same owned Gmail account; email confirmation remained required. Both signup-confirmation and password-reset messages were confirmed visible in a Gmail inbox search restricted to the test alias. No verification links were opened and no message bodies or unrelated mail were printed.

The temporary encrypted App Password copy was removed after verification; the server credential is stored in Supabase's encrypted SMTP settings. An additional unconfirmed mail-test account remains without group or financial data. This verifies delivery to the selected Gmail inbox, not deliverability across all mail providers, production sending volume, or emailed-link completion.

## Android testing APK — 28 October 2026

The standalone ARM64 release APK built successfully with release lint enabled. APK Signature Scheme v2 verification passed for the dedicated Tracksy 3072-bit RSA key. `zipalign -c -P 16 4` passed. Manifest inspection confirmed `app.tracksy.mobile`, version `0.1.0`/code `1`, minimum API 24, target API 36, ARM64 native libraries, and no debuggable flag. Archive inspection confirmed the embedded Hermes runtime, JavaScript bundle, fonts, and exact configured public Supabase endpoint/key.

`npm run check` passed again after the build: all workspace TypeScript checks and **40 tests** across four files. The APK is 53,062,747 bytes with SHA-256 `58fa3468d11b15d315a7856a07a00173f4f58ce07c91131ce62ff8ac1e135645`. See [build and signing details](ANDROID-APK.md) and `artifacts/TESTING.md` for phone acceptance steps. Physical-device runtime, emailed-link completion, store billing, and push delivery remain unverified.

## Dependency audit

The initial critical test-runner advisories were removed by updating Vitest and its required Vite peer. Application validation uses patched Zod 4.6.7. Remaining npm audit findings are in the selected Expo SDK 55 toolchain dependency graph: `node-forge`, `@expo/code-signing-certificates`, `@expo/cli`, `expo`, the CLI's older Zod, and `decode-uri-component` / `query-string` / `expo-router`.

Compatible `npm audit fix` was applied. The remaining suggested fixes include changing Expo/Router major versions; no blanket `--force` downgrade or untested transitive major override was applied. `node-forge` currently has no newer patched version in the registry queried for this implementation. Review upstream fixes or a supported SDK migration and repeat security/build/device acceptance before release. This project is not declared free of security advisories.

Sentry reports that organization/project configuration is absent at bundle time. Supplying environment-specific Sentry settings and checking upload/redaction remains an operator task. No Sentry event delivery has been verified.
