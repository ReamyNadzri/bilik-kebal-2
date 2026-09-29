# Clerk auth migration plan

Decision (user, 2026-09-29): VAULTIX moves from Supabase Auth to Clerk (option A). Supabase keeps
PostgreSQL, Storage, RLS, Queues and Cron; it trusts Clerk session tokens as a third-party auth
provider. This supersedes the Auth row of `context/architecture.md` once the slices below land.

## Infrastructure state (2026-09-29)

| Item | State |
| --- | --- |
| Clerk app | `app_3JzZ5mK1gUx0gBAmfL0MnQrHf5X` ("Vaultix") |
| Dev instance | `ins_3JzZ5oGPyQqxZG7EIfTFcMYRcI8` |
| Prod instance | `ins_3K0FcdljHNhcTPvFfTf4SHyNygS`, cloned from dev, domain `bilikkebal.afes.my` |
| Clerk Frontend API | `https://clerk.bilikkebal.afes.my` (pending DNS) |
| Vercel project | `haziq3010s-projects/bilik-kebal`, GitLab repo connected |
| Vercel Production env | Clerk live keys and the four `NEXT_PUBLIC_CLERK_*_URL` values set; nothing else |
| Supabase project | `yuzgkjowtcfwqanituta`, Clerk third-party auth **not yet enabled** |

Pending manual steps (owner: user):

1. DNS at the `afes.my` provider, all CNAME:
   - `clerk.bilikkebal` → `frontend-api.clerk.services`
   - `accounts.bilikkebal` → `accounts.clerk.services`
   - `clkmail.bilikkebal` → `mail.z8zp2wjs50fk.clerk.services`
   - `clk._domainkey.bilikkebal` → `dkim1.z8zp2wjs50fk.clerk.services`
   - `clk2._domainkey.bilikkebal` → `dkim2.z8zp2wjs50fk.clerk.services`
   - plus the record Vercel shows for `bilikkebal.afes.my` itself.
2. Vercel dashboard → project `bilik-kebal` → Domains → add `bilikkebal.afes.my` (CLI refused:
   `domain_not_owned` in this team).
3. Clerk session token claim `{"role":"authenticated"}` on dev and prod (Dashboard → Sessions →
   Customize session token, or the Supabase integration toggle).
4. Google OAuth production credentials (Clerk prod has Google enabled with no client id/secret).
5. Supabase Dashboard → Authentication → Sign In / Providers → Third-party → Clerk, domain
   `clerk.bilikkebal.afes.my`; add the dev Clerk domain too for local/preview.
6. Remaining Vercel Production env (Supabase, Brevo, secrets). `PAYMENT_MODE` and
   `PUBLIC_UPLOADS_ENABLED` stay at safe defaults; setting them is a launch-gate decision.

## Identity mapping (recommended)

Keep every existing `uuid` user column and foreign key. Add a mapping instead of retyping ~60
columns:

- `identity.profiles` gains `clerk_user_id text unique not null` (backfilled for existing users).
- New `security definer` SQL function `public.current_user_id() returns uuid` that resolves
  `auth.jwt() ->> 'sub'` to `profiles.user_id`, `stable`, `search_path` pinned.
- A new migration replaces `auth.uid()` with `public.current_user_id()` in every policy, function
  and storage policy (26 migration files, 157 call sites). Applied migrations are never edited.
- The foreign key `profiles.user_id → auth.users(id)` is dropped; `user_id` becomes
  `default gen_random_uuid()`.
- Triggers on `auth.users` (profile provisioning, welcome email, `email_confirmed_at`) are
  replaced by a Clerk webhook handler (`user.created`, `user.updated`, `user.deleted`) verified
  with the Svix signature and processed idempotently by event id.
- Reads that join `auth.users` for email (notification outbox, member console) read a
  `profiles.email` column kept in sync by the webhook.

## Slices

Each slice ships with acceptance criteria, RLS access-control tests and a passing build.

1. **Schema bridge.** Migration adding `clerk_user_id`, `email`, `current_user_id()`, and the
   policy rewrite. Tests: every RLS test in `supabase/tests` passes with a Clerk-shaped JWT
   (`sub = user_…`, `role = authenticated`); an unknown `sub` sees nothing.
2. **Webhook provisioning.** `POST /api/webhooks/clerk`: Svix verification, idempotent by
   `svix-id`, provisions/updates/soft-deletes profiles, enqueues the welcome email through the
   existing outbox. Retry and replay tests.
3. **Session plumbing.** Supabase clients pass `accessToken: async () => (await auth()).getToken()`;
   `getRequestUser` becomes Clerk `auth()` + profile lookup; `src/lib/supabase/proxy.ts` session
   refresh and `signOut` removed; the 7-day idle backstop and 30-minute Sheriff limit move to
   Clerk session settings plus the existing browser timer.
4. **Auth screens.** Sign-in/up, verify email, reset password and reauthenticate on Clerk hooks;
   delete `supabase-auth-gateway`, `/auth/confirm`, `/api/auth/confirm`, `/auth/callback` and the
   Supabase auth email templates once unused.
5. **Existing users.** Import Supabase Auth users into Clerk (bcrypt hashes are accepted by the
   Clerk user import), write `clerk_user_id` back. Dry-run on a copy first.
6. **Context update.** `architecture.md` auth row and auth model, `code-standards.md`, and the
   progress tracker.

## Decisions (user, 2026-09-29)

- Existing Supabase Auth users are imported into Clerk with their bcrypt password hashes; they sign
  in unchanged (slice 5).
- Clerk sends verification and password-reset email. The branded Supabase/Brevo auth templates,
  `/auth/confirm` and `/api/auth/confirm` are retired; Brevo keeps app notifications (slice 4).
- Sheriff/Owner step-up uses Clerk reverification with the existing 15-minute window, enforced
  server-side (slice 4).

## Open questions (escalate, do not infer)

- Deleting a Clerk user: soft-delete the profile (ledger and audit references must survive) — confirm
  retention behaviour against `architecture.md`.
