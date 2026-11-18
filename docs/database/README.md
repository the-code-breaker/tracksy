# Database

Apply migrations in timestamp order through Supabase CLI. The first helper migration is table independent; the following migrations install core records, RLS and finance RPCs, entitlements, private storage policies/realtime publication, reporting/push operations, and recurrence.

`group_members` preserves historical identity after leaving. Financial tables use composite expense/group foreign keys to prevent accidental cross-group attachments and split records. Membership changes and expense creation lock their group; corrections also lock their expense. Pending invitation tokens are hashed with SHA-256 and only returned once; rows never expose the raw token.

Sensitive public tables enable RLS. Ordinary client reads are scoped to the current user or active group membership. Direct client writes to financial and billing tables have no grant or write policy. Profile updates are column-limited. The service role must remain server-only and has full trusted privileges.

The shared domain package contains hand-written boundary interfaces; after starting a real Supabase backend, run `npm run db:types` and wire generated types into the SDK before final API acceptance. All app RPC outputs currently pass through typed adapters, rather than generated database typing.

Tests run real PostgreSQL SQL through PGlite with emulated Supabase auth/storage metadata. The Supabase Storage object server, JWT signature verification, Auth emails, realtime streaming, PostgREST serialization and managed default grants still require integration tests against a real project.

For production, verify PostgreSQL query plans and current Supabase defaults; enforce backup retention; rehearse restoration. Migration testing against an empty local database is necessary but does not validate upgrades against a populated production database.
