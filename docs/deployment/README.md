# Development and deployment

The configured hosted development project and remaining provider setup are recorded in [HOSTED-SETUP.md](HOSTED-SETUP.md).

## Backend

Install Docker Desktop and the Supabase CLI for local development. `supabase start` runs Auth, PostgREST, PostgreSQL, Storage, Realtime, Studio, and local email services. `supabase db reset` is destructive to the **local** database; never use it against real records. All migration tests in this repository use an isolated PGlite database.

For a hosted project, create separate development/staging/production projects. Link only the intended environment with `supabase link --project-ref <ref>`, review migration SQL, and use `supabase db push`. Keep a recoverable backup and verify restoration before production changes.

For a brand-new, empty hosted project without CLI access, `npm run db:prepare` creates [supabase/bootstrap.sql](../../supabase/bootstrap.sql) for review and execution in Supabase's SQL editor. It applies all ten migrations in one transaction. This file is for clean projects only and is not an upgrade script. SQL-editor execution does not register CLI migration history: before later using CLI migrations, link the same project and mark the applied versions with `supabase migration repair --status applied <version>` for versions `202610270000` through `202610270009`, or use the CLI workflow from the beginning.

After database setup, copy the project's URL and public anon/publishable key into `apps/mobile/.env` and `apps/admin/.env.local` using their `.env.example` files. Keep the service-role key out of both clients. Restart Expo after changing public environment variables. The mobile client uses `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`; the admin uses `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

Configure email verification, strong-password policy, SMTP, rate limits, Google and Apple OAuth providers and redirect allowlists. Use `tracksy://auth/callback` for the native development build and explicit trusted web origins. Production web needs HTTPS. Password-reset callback carries `recovery=true`. PKCE links need the original device/browser verifier; cross-device email flows remain an acceptance item.

Do not permit arbitrary redirect URLs. Profiles are provisioned by an auth trigger. Memberships are created only by group creation or verified invitation acceptance.

## Edge functions and scheduled jobs

Set server-only secrets through Supabase's secrets manager, using a protected local env file or operator secret management. Never place secrets in CI output or commit them. Built-in `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are supplied by the Edge runtime.

Deploy `billing-webhook`, `push-worker`, and `recurring-worker`. Their function-specific `verify_jwt=false` settings are intentional: each handler requires its own strong server authorization secret. Billing expects the exact configured RevenueCat authorization header. Workers expect `Authorization: Bearer <SCHEDULE_SECRET>`.

Configure a trusted scheduler to POST to `recurring-worker` daily and `push-worker` at the desired bounded interval. Store scheduler secrets in Vault or the scheduler's secret manager. Do not embed secrets in SQL migrations. Jobs are bounded and retry-safe for database financial entries; push network delivery is at least once and can duplicate if a worker crashes after provider acceptance. Expo receipt polling is still required to claim delivery.

## Native builds

For an installable local Android APK, see [ANDROID-APK.md](ANDROID-APK.md). `npm run apk` builds and signs the ARM64 release using the configured local Android toolchain.

Install EAS CLI, log in to the correct Expo organization, and run `eas init` from `apps/mobile` to associate a project. Set your own bundle IDs, configure signing and APNs/FCM, and provide native public env variables through EAS environments.

```powershell
cd apps/mobile
eas build --profile development --platform android
eas build --profile development --platform ios
```

This repo targets Expo SDK 55 and aligned native dependencies. Development builds are required for store billing and push/device modules; Expo Go is not a storefront acceptance environment. Test real iPhones and small Android devices. Production build/submit profiles exist but submission is not authorized by merely running local tests. EAS Update channels/runtime policy and signing configuration still need environment-specific setup.

## Admin

Use the public Supabase URL/key in the Next.js server environment; no service-role key is needed for the metrics page. Provision `app_metadata.role = admin` through a trusted operator only. A valid TOTP factor and AAL2 JWT are required by the database. Role removal and sessions must be audited. In production set HTTPS so admin auth cookies remain Secure and HttpOnly. Configure CSP and other hosting security headers before launch.

The console compiles with `npm run build -w @tracksy/admin` and runs using `next start` from its workspace. No admin server has been deployed.

## Web

`npm run export -w @tracksy/mobile` generates `apps/mobile/dist`. The local preview server supports SPA fallback on loopback port 4317. It is intended for QA only. Real hosting needs HTTPS, SPA rewrites, environment configuration, security headers and auth redirect allowlisting.

No website has been published and no production service configuration was changed during implementation.
