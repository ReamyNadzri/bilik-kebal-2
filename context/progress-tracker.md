# Progress Tracker

Update this file after every meaningful implementation or specification change.

## Current Phase

- Supabase Cloud is the active backend environment, confirmed by the user on
  2026-09-23. Local Docker is optional tooling, not a prerequisite for continuing
  development. Cloud migration history and database test results must be verified
  separately; the environment change does not establish that new migrations passed.

- Phase 3B money/ledger, public Wanted reads, and the Phase 4 claims boundary are integrated on
  `main`. The Gemini frontier interface and Codex backend are now in one reviewable tree.
- Phase 4 Claims and moderation has started with quarantine RLS, upload-session authorization,
  scanner contracts, and human review policy.
- 2026-09-23 email-priority decision: deliver account/security and critical
  trust/moderation emails first. Defer payment status/receipt, refund, payout, and
  reconciliation emails until the payment gateway is applied and verified.

## Current Goal

- Prepare Phase 6: Hardening and controlled launch gates (monitoring, audit trails, and end-to-end integration flows).

## Completed

- Read and visually reviewed the 24-page `BILIK KEBAL 2 by afes.pdf` proposal.
- Defined VAULTIX as a production-oriented, UiTM-first, English-first academic resource bounty marketplace.
- Confirmed that any email may register but email verification is mandatory.
- Separated email verification from institution verification; the star emblem represents institution verification.
- Limited transactional, claim, and resource access to institution-verified users while allowing verified-email browsing.
- Confirmed that one student account may act as Commissioner, Backer, and Hunter.
- Selected ToyyibPay for payment collection with disabled, sandbox, and allowlisted live-limited modes.
- Defined RM1-RM50 contributions, payer-borne gateway fees, and a configurable 10% fee snapshotted at publication.
- Defined manual Owner payout and refund operations for the first release.
- Defined 7-, 14-, and 30-day bounty durations, no extension, and full manual refunds after unfulfilled expiry.
- Defined one best winning claim, with submission time used only as a tie-breaker.
- Defined one seven-day appeal reviewed by a different Sheriff and paused expiry/refund during appeal.
- Defined contributor-only access by default and rights-approved free release 48 hours after approval.
- Defined supported file types, 50 MB maximum, quarantine, duplicate strategy, reports, takedown, and retention.
- Defined Owner, Platform Sheriff, and institution-scoped Sheriff permissions.
- Selected a Supabase-centric architecture, with Supabase Storage first and an optional Cloudflare R2 hybrid path later.
- Initially selected Resend; superseded on 2026-09-23 by Brevo Free for transactional email after the user declined paid plans.
- Selected Supabase Queues and Cron for durable background work and scheduled lifecycle tasks.
- Assigned detailed visual design to a separate designer; recorded only product direction and accessibility constraints.
- Populated all six context files and completed the Phase 1 application foundation.
- Renamed the product identity from WANTED to VAULTIX while retaining `Wanted` as a marketplace feature term.
- Approved a six-phase full-MVP direction: Foundation; Identity and institution trust; Wanted marketplace and money; Claims and moderation; Fulfilment and operations; Hardening and controlled launch.
- Approved a `pnpm`-managed single Next.js App Router modular monolith with Supabase as the source of truth and provider integrations behind typed adapters.
- Wrote `docs/superpowers/specs/2026-09-13-vaultix-mvp-design.md` as the phased MVP design handoff.
- Assigned the complete provisional MVP frontend to Claude Code and backend/infrastructure implementation to Codex, with separate worktrees and Codex-owned shared contracts.
- Implemented Phase 2 identity schema, RLS, Auth, email confirmation, domain fallback, manual evidence workflow, role-scoped review, account restriction, audit events, and private signed evidence uploads in the Codex backend worktree.
- Implemented the six Identity read-contract operations: account view, selectable institutions, scoped Sheriff queue, audited evidence read URL, verification resend, and explicit callback outcomes.
- Published Phase 3A marketplace contracts, private RLS-protected Wanted storage and institution-scoped taxonomy reads.
- Implemented atomic private draft create/update operations, server-derived Commissioner identity, active taxonomy validation and owner-only editable-draft enforcement.
- Implemented public-only duplicate ranking, HMAC-authenticated 15-minute one-use duplicate-check tokens and a private publication snapshot transaction for the future money module.
- Published `docs/integration/marketplace-http-contract.md`; Phase 3A never confirms payment or opens a Wanted.
- Claude connected taxonomy, draft persistence, duplicate checks and publication preparation to the Phase 3A operations in `fed4576`.
- Implemented Phase 3B contribution intents, ToyyibPay bill creation and form callback verification, service-role event recording, one-use token consumption, immutable balanced ledger entries, first-contribution Wanted activation, outbox events and reconciliation reads.
- Implemented public Wanted Board and detail operations (`26a0427` plus follow-up hardening): safe
  public DTOs, email-verification gate, integer-sen bounty aggregation, distinct backer counts,
  taxonomy and public activity, validated query enums, and deterministic sorting.
- Added functional pgTAP coverage for atomic intent creation, pending callbacks, successful balanced posting and idempotent callback replay.
- Connected Wanted draft workspace and publication confirmation to ToyyibPay contribution bill creation (`POST /api/marketplace/wanted/drafts/:id/contribution`) with redirect handling and `PAYMENT_MODE=disabled` launch gate notice.
- Implemented `BackWantedModal` and wired "Back this Wanted" on `WantedDetail` for institution-verified students with preset RM1–RM50 contributions (100–5,000 sen).
- Implemented client-side quarantine upload operations (`computeFileSha256`, `validateClaimFile`, `requestClaimUploadSession`, `submitClaimFile`) uploading up to 50 MB directly to private Supabase Storage `quarantine` via signed PUT without passing untrusted bytes through the Next.js runtime.
- Built accessible `ClaimSubmissionForm` modal with client-side SHA-256 calculation, progress states, rights confirmation, and `PUBLIC_UPLOADS_ENABLED=false` launch-gate notice.
- Implemented server-side `HunterClaimsReadService` querying live `claims` joined with `wanted_requests` filtered by `claimant_id`, and updated `/claims` to display real claims for authenticated sessions while preserving `?preview=` fixtures.
- Published `docs/integration/claims-http-contract.md` and added Playwright E2E coverage for bounty creation, backing, and quarantine claim submission flows (`tests/e2e/marketplace-bounty-claim-flow.spec.ts`).

## In Progress

- 2026-09-23: Started notifications/operations in isolated backend worktree
  `.worktrees/notifications-operations`, branch `codex/notifications-operations`,
  based on integrated `main` at `78ebe2a`. Backend code and shared contracts stay
  in this lane; the companion UI work is isolated in
  `.worktrees/primary-email-ui`, branch `codex/primary-email-ui`.
- Added a private notification inbox migration, recipient-scoped list/read APIs,
  typed contract, duplicate-event protection, and safe correlation logging for
  those APIs. Added an unapplied follow-up migration publishing recorded claim
  reviews and new account restrictions atomically to the inbox. Added a third,
  unapplied migration that creates a transactional email outbox with lease tokens,
  bounded exponential backoff, terminal failures and manual review after the
  provider idempotency window. New inbox events enqueue email in the same DB
  transaction. Added a server-only Supabase RPC repository and Brevo dispatcher,
  service-key-protected HTTP route, fixed copy, verified-recipient check, and
  stable correlation IDs across retries. The route is not scheduled or deployed.
  Outbox terminal states are persisted, but an operator-facing failure view is
  still needed. The dispatcher has not been scheduled or deployed. SQL/RLS tests
  for these migrations have not run
  because no isolated database test project is available in this worktree; do
  not apply the migration to shared Supabase Cloud. The frontend worktree now
  contains the inbox UI with read/unread, pagination, loading, empty, offline and
  retry states. Distributed rate limits and lifecycle schedules remain pending.
- Added server-generated correlation IDs and allowlisted structured logs to
  sign-in, sign-up, verification resend, password recovery, and sign-out responses.
  Auth logs omit request bodies, email addresses, passwords, user IDs, and provider
  details. Malformed JSON receives a correlated validation response.
- Historical Resend Marketplace/free-tier setup was superseded by the user's
  decision to use Brevo Free. No payment or paid email service was provisioned.
- Supabase Cloud connection and migration history were verified read-only. Cloud
  has applied versions `202609240001` (claim moderation/appeals) and `202609250001`
  (fulfilment) missing from the checkout. Their presence does not establish that
  those features pass acceptance tests. Reconcile source/history before deployment.
- Provider decision changed: replace Resend with Brevo Free. The server-side
  adapter now calls Brevo's transactional email API and the outbox retry cutoff
  is 14 minutes (Brevo idempotency retention is 15 minutes). Env names are
  `BREVO_API_KEY`, `BREVO_FROM_EMAIL`, and `BREVO_FROM_NAME`. Unit tests use fake
  HTTP responses only. User-confirmed Brevo API key configuration is present in
  local/Vercel settings and `bilikkebal.afes.my` is verified. A direct Brevo API
  sample email to the requested test inbox was accepted by the provider, but it
  did not exercise this app's outbox or Supabase Auth SMTP.
- Supabase Auth sends signup confirmation and recovery emails independently from
  the app notification dispatcher. Once a Brevo account is ready, configure
  Supabase Auth custom SMTP with Brevo SMTP credentials (a distinct SMTP key); this
  external dashboard setup has not yet occurred.
- Historical post-provider-switch verification: 102 unit-test files / 813 tests pass;
  TypeScript, Prettier, ESLint (zero errors; one existing sign-out warning),
  `git diff --check`, and production build pass at that earlier checkpoint.
- Resend sender domain `bilikkebal.afes.my` is verified (DKIM and SPF records
  verified; sending enabled). `RESEND_API_KEY` is present in the VAULTIX Vercel
  Production environment as a Secret; its value was not read. The Vercel CLI was
  installed and the Marketplace discovery returned `resend/resend-email`. The
  user accepted its terms but declined the paid resource. No Marketplace resource
  or charge exists. The later one-off authorized smoke email used the existing
  Resend key and did not create a Marketplace resource or charge.
- Notification schema and event-trigger SQL was validated against Supabase Cloud
  inside one explicit transaction with a final ROLLBACK. All 21 pgTAP smoke
  assertions passed; post-rollback checks confirmed the notification table and
  synthetic users were absent. This validated the migration SQL without applying
  it. The approved test was a targeted smoke set, not all 29 assertions in the two
  committed SQL test files. No lasting changes occurred during that database
  smoke; a separate direct provider sample email was subsequently accepted.
- Notification/auth-observability verification: 98 test files / 801 tests pass;
  TypeScript, formatting, and production Next.js build pass. Lint exits successfully
  with one existing sign-out navigation warning.
  TypeScript, format, production build, and 21 rollback-only cloud smoke assertions
  pass. The committed SQL files contain 29 assertions and still need to be run via
  the normal database test harness in an isolated test project. Changes remain
  uncommitted in the isolated worktree and are not integrated into `main`.
- 2026-09-23 primary non-payment email slice: password recovery now exchanges the
  Supabase link through `/auth/callback`, binds a short-lived signed HTTP-only
  grant to the authenticated user, and requires that grant before updating a
  password. The companion UI provides reset, expired-link, and success states.
  The notification inbox UI consumes the published contract and supports read
  state, cursor pagination, loading, empty, offline, and retry states. New
  append-only migration `202609280001_primary_email_events.sql` adds idempotent
  events for institution verification approved/rejected and claims marked
  not-selected. Full Vitest suites pass in the isolated worktrees: backend
  105 files / 824 tests; frontend 98 files / 793 tests. Both worktrees pass
  TypeScript, Prettier, ESLint (zero errors; one pre-existing sign-out warning),
  and production build. SQL/RLS tests for new migrations remain unrun because
  no isolated database test project is available; no changes were applied to
  Supabase Cloud, and no app-outbox email or production deployment was tested.
  Existing account restriction and claim review decision email events remain in
  scope; appeal events are withheld until the missing cloud-applied migration
  sources are reconciled. Payment email work remains deferred.
- Expiry scheduling depends on refund tasks and appeal holds; free release depends
  on recorded approval/rights and entitlements; retention depends on final decision,
  appeal and investigation closure state. Keep these schedules inactive until the
  owning domain operations exist. Final settlement remains deferred by user request.
- 2026-09-24: Integrated password reset and recovery flow on `main` with Brevo custom
  SMTP, added a 2-minute cooldown on the recovery request form, and updated sign-up
  to navigate directly to `/sign-in` when email confirmations are disabled.

- Public Wanted detail now maps the authoritative `expired` lifecycle to the `closed` presentation
  status, even when a large bounty would otherwise display as well funded. The focused read-model
  regression test covers this case on `codex/backend`.

- The Phase 3B backend gate is now complete: local pgTAP passes all 102 database tests, and the
  non-database unit, format, lint, type and production-build gates also pass on `codex/backend`.
- Antigravity's `agy` launcher is installed and can access Gemini models. The legacy Gemini CLI
  remains rejected for this account with `IneligibleTierError` / `UNSUPPORTED_CLIENT`; use `agy`
  for frontend work.
- Gemini frontend checkpoint `70d2d1c` preserves the marketplace visual work. Follow-up
  `c2c2321` makes the provisional UI build without downloading Google Fonts; frontend tests,
  lint, typecheck and format now pass, and the production build passes offline.
- Phase 4 Slice 1 adds claim submission contracts and eligibility policy, a private `claims` and
  `claim_upload_sessions` schema, exact-checksum uniqueness, and a private `quarantine` bucket
  with no browser storage write policy. The full pgTAP suite now passes 110 tests.
- Phase 4 Slice 2 adds the server-side upload-session service. It validates trust, file limits, opaque quarantine object keys, expiry and the disabled-upload launch gate before a signed upload can be issued.
- Phase 4 Slice 3 adds identifier-only scanner job/result contracts and a human Sheriff review policy. Scanner evidence can inform review but cannot approve a claim.
- Phase 4 Slice 4 adds private, RLS-protected screening job and result persistence with idempotent
  result keys and a service acknowledgement contract. The full pgTAP suite now passes 119 tests.
- Phase 4 Slice 5 adds the separate scanner worker adapter. It reads quarantine bytes only in the
  worker boundary and writes identifier-only results or failure acknowledgements.
- Phase 4 Slice 6 adds human Sheriff review persistence, role and institution authorization, review
  reason codes, and a database-enforced single approved claim per Wanted. The full pgTAP suite now
  passes 125 tests.
- Phase 4 Slice 7 adds the Sheriff review HTTP contract, queue read model, and protected review
  route. Review responses expose metadata only and never private object keys or file content.
- Phase 4 Slice 8 connects the provisional Sheriff console to the claim review queue and decision
  route with loading, empty, unavailable, confirmation prompt and result states.
- Client auth state and route guards are in place. The shell now names the signed-in account and
  offers the only sign-out control in the interface; protected routes redirect on the server before
  rendering; sign-in returns the viewer to where they were; and an `AUTH_REQUIRED` refusal signs a
  stale session out once rather than per refused operation.
- Implemented event-driven status alerts for the Evidence Locker & bounty claim workspace:
  `DispatchAlertBanner` communicating lifecycle progression (quarantine screening, sheriff review,
  approved, needs information, distinct not_selected, and rejected), transient `DispatchAlertToast` on
  proof dispatch/removal events, 4-stage micro-pipeline indicators, and WCAG 2.1 AA accessible ARIA live regions.
- Implemented Claim & Bounty Settlement moderation:
  - Created database migration `202609240001_claim_moderation_and_appeals.sql` introducing `claim_reports` and `claim_appeals` with RLS, reason codes, high-risk auto-quarantine restrictions, and reviewer segregation RPC (`record_claim_appeal_decision`).
  - Added Wanted request freeze and countdown extension on active appeals (`is_paused`, `paused_at`, `total_paused_duration`, `closes_at` extension).
  - Built `ClaimModerationService` and `SupabaseModerationRepository` handling reports, 7-calendar-day appeal eligibility, and appeal resolution.
  - Created routes `/api/claims/[id]/report`, `/api/claims/[id]/appeal`, `/api/sheriff/appeals/[id]`, and `/api/sheriff/moderation`.
  - Added accessible UI components: `ReportClaimModal`, `ClaimAppealModal`, `WantedAppealPauseBanner`, `SheriffAppealConsole`, and extended `DispatchAlertBanner`.
- Implemented Phase 5 Evidence Locker, Contributor Entitlements, Manual Payouts & Operational Queues:
  - Created and pushed remote migration `202609250001_fulfilment_entitlements_and_payouts.sql` introducing `entitlements`, `payout_tasks`, `refund_tasks`, and updated `ledger_transactions` with compensating entry support.
  - Implemented `approve_winning_claim_and_fulfill` RPC atomically transitioning claim to `approved`, wanted to `fulfilled`, moving quarantine files to `approved` storage bucket, creating entitlement records for all verified contributors (`UNIQUE (wanted_request_id, user_id)`), and creating the 10% platform fee + net payout manual payout task for the winning hunter.
  - Implemented `record_owner_payout_completion` and `record_owner_refund_completion` double-entry balancing ledger transactions clearing `wanted_escrow` with debits and recording external reference, payout method, timestamp, and audit trail.
  - Implemented `expire_wanted_and_generate_refunds` RPC closing expired unfulfilled bounties and generating individual refund tasks per contribution.
  - Built Entitlement service (`src/modules/entitlements/`) with 15-minute signed download URLs (`/api/claims/[id]/download`), download metadata access policies, and automated access revocation upon report restriction/takedown.
  - Built Payout service (`src/modules/payouts/`) with owner-exclusive completion endpoints, staff refund/payout queue reads (`/api/sheriff/payouts`, `/api/sheriff/refunds`, `/api/owner/payouts/[id]/complete`, `/api/owner/refunds/[id]/complete`, `/api/marketplace/wanted/[id]/expire`).
  - Delivered accessible UI operational console (`src/components/claims/operational-console.tsx`, `owner-payout-queue.tsx`, `owner-refund-queue.tsx`, and updated `evidence-locker.tsx`) at `/console/operations` with WCAG 2.1 AA keyboard navigation, ARIA live states, integer sen currency formatting, and tabbed workflow.
- Implemented 6-digit OTP code password recovery flow:
  - Added `verifyRecoveryOtp` and `resetPasswordWithOtp` across `SupabaseAuthGateway` and `AuthService`.
  - Updated `POST /api/auth/reset-password` to support 6-digit OTP code verification directly with Supabase `verifyOtp({ type: 'recovery' })` alongside backwards-compatible grant cookie verification.
  - Enhanced `ResetPasswordForm` to accept email and 6-digit recovery code inputs, with automatic sessionStorage retrieval when transitioning from `/recover`.
  - Immunized password recovery against Microsoft 365 Defender Safe Links / Outlook email prefetching consuming single-use magic links for `@student.uitm.edu.my`.

- 2026-09-24 frontend consistency and bug sweep (Claude Code, branch
  `claude/compassionate-ramanujan-lpcrpr`):
  - Claims and operations screens (payout/refund queues, operations console, evidence locker,
    upload field, dispatch banner/toast, claim workspace, `/claims/new`) moved from ~250 inline
    styles with rounded corners and off-palette reds/greens onto shared tokenised classes
    (`.dialog`, `.ops-*`, `.locker-*`, `.upload-*`, `.dispatch-banner`, `.toast`, layout helpers).
  - Payment placeholder: the Back-this-Wanted dialog maps every refusal to its own message and
    treats the absent `POST /api/marketplace/wanted/[id]/contribution` route as "online payment is
    not open yet"; every branch states that no charge was made. Added `/payment/return` for
    `TOYYIBPAY_RETURN_URL`; it never treats the redirect as payment and never echoes provider
    references.
  - Fixed: Close/Cancel on paper dialogs used the timber-only ghost button (unreadable);
    claim file input was unreachable by keyboard; upload rights confirmation was pre-ticked;
    a malformed `wantedId` produced a simulated "uploaded" success in production; payout queue
    hard-coded a 10% fee instead of the snapshotted rate; SignOutButton navigated away even when
    sign-out was refused; operations tabs lacked tabpanel and arrow-key support; two
    set-state-in-effect lint errors in the recovery forms.
  - Removed invented policy copy (a 48-hour free-release delay, an "only refundable on expiry"
    rule, encryption claims). Free release copy now states only the invariant: Hunter opt-in plus
    Sheriff-confirmed rights, otherwise Backers only.
  - Desktop rail fits one row from 1280 px: the search starts at 8rem and grows to 15rem, the
    account control precedes Post a Wanted, and the account utilities are icon-only below 85rem.
  - Verification: typecheck, lint, format, 949 unit tests and production build pass; no route
    overflows at 360 px or 1440 px. Playwright against a production build without Supabase
    credentials: 135 passed / 85 failed, versus 134 / 86 on the untouched base `e032efe` — no new
    failures. The remaining failures need a reachable Supabase (sign-in refusal states, the
    Wanted intake form) or are strict-mode selector clashes in the specs.
  - Design system recorded as a Design System artifact built from `src/app/globals.css` and the
    handoff images; `bounty sample.png` in the handoff is third-party artwork and is reference only.

## Next Up

0. Codex lane: publish `POST /api/marketplace/wanted/[id]/contribution` (Backer contribution
   intent) — the Back-this-Wanted dialog already calls it and handles every `MoneyOperationCode`.
1. Connect durable claim job dispatch to the scanner worker host after its provider is selected.
2. Add claim upload completion dispatch and entitlement creation after a recorded approval.
3. Add Sheriff review persistence with reason codes, recorded actor, and one-winner constraints.
4. Verify the existing Supabase Cloud connection and applied migration history, then validate pending migrations and RLS tests in a designated cloud test environment.
5. Resolve the remaining launch-gate decisions before enabling public uploads or live payment.

## 2026-09-24 frontend overhaul and full-stack additions (PR #1)

User-authorised full-stack slice on `claude/compassionate-ramanujan-lpcrpr`:

- Migration `202609290001_profiles_free_requests_and_regions.sql` — applied to Supabase Cloud
  (confirmed 2026-09-25, see below). It adds request kinds (`academic`, `missing_item`, `discussion`), free requests
  (`is_free`, access basis `commissioner_free`), replies and reply notifications, profile
  `public_id`/avatar/bio, the public `avatars` bucket, campus region lock and map positions, the
  3–30 day duration, and adds `fulfilled`/`closed` to the lifecycle check (approval previously
  violated it). Open campuses are matched by name (`ilike`), so verify the four open campuses after
  applying.
- Decisions (user): free requests for all kinds; missing items and discussions are free-only with
  text replies; paid bounties stay academic-only; public profiles show name, avatar, joined date,
  badge and public Wanteds only; duration and contribution use sliders (duration 3–30 days replaces
  7/14/30).
- Posting terms `TERMS_VERSION` / policy version `2026-09-24.1` were drafted from the context files
  and are labelled **"Draft — pending legal review"**. They must be reviewed before public launch.
- Payment stays `disabled`; the Back modal slider only prepares an amount. The backer contribution
  endpoint still needs the ToyyibPay key and remains a launch gate.
- Verified: 1000 unit tests, typecheck, lint and production build pass; no horizontal overflow on
  17 routes at 360 px and 1440 px.

## 2026-09-24 (later) paid community requests, free limit, reward codes, entry requests

- Migration `202609300001_paid_community_codes_and_taxonomy_requests.sql` — applied to Supabase
  Cloud (confirmed 2026-09-25, see below). Verified locally: the whole migration chain applies on Postgres 16 with
  stubbed `auth`/`storage`, and the free limit, reward codes, taxonomy requests (RLS, notification,
  email outbox), community payout (request, Sheriff approval, payout task, 10% fee, conflicted
  reviewer refused) and campus seeding behave as specified.
- Decisions (user): missing items and discussions may be paid or free; the poster names the finder
  and a Sheriff approves before payout; 3 free requests per member for life; reward codes carry a
  word, free requests per redemption and a maximum number of redemptions, once per member; custom
  taxonomy goes to a Sheriff for approval with in-app and email notice; academic session optional;
  UiTM Kuala Terengganu and Dungun open; locked UiTM campuses seeded so the map shows grey pins.
- Paid missing-item and discussion posting returns `PAYMENT_DISABLED` while payment is disabled and
  writes nothing. `create_community_draft` exists for the gateway work; wiring its payment step is
  part of the pending contribution endpoint.
- Members may choose one of twelve drawn avatars (`profiles.avatar_preset`) instead of a photo.
- Posting terms bumped to `2026-09-24.2` (free limit, bounty release). Still a draft pending legal
  review.
- Account deletion is shown as not available: it needs a retention decision (ledger and audit
  records must be kept).
- Reward codes are created by the Owner via `create_reward_code` or the SQL editor; there is no
  Owner UI for codes yet.

## 2026-09-25 Supabase Cloud migration check (project `yuzgkjowtcfwqanituta`, "vaultix")

- `supabase migration list --linked` shows every local migration through `202609300001` on the
  remote, and `supabase db push --linked --dry-run` reports "Remote database is up to date". Both
  `202609290001` and `202609300001` were already applied before this check, so nothing was pushed.
- Read-only verification passed:
  - both versions are in `supabase_migrations.schema_migrations`;
  - exactly five campuses are `region_open = true` (UiTM Shah Alam, Puncak Alam, Kuala Terengganu,
    Dungun and Bukit Besi), each with one row; the 11 other UiTM campuses are locked with map
    positions;
  - RLS is enabled on `wanted_replies`, `reward_codes`, `reward_code_redemptions`,
    `taxonomy_requests` and `community_payout_requests`;
  - `avatars` is the only public bucket (512 KB, `image/webp`); `approved`, `quarantine` and
    `identity-evidence` stay private;
  - `wanted_requests_lifecycle_check` allows `fulfilled` and `closed`;
  - `payout_tasks_source_check` requires exactly one of `claim_id` or
    `community_payout_request_id`.
- `supabase gen types typescript --linked` differs from the committed
  `src/lib/supabase/database.types.ts`. The cloud types add the `notifications` table, its RPCs and
  the relationships of `community_payout_requests`, but they type nullable RPC arguments (for
  example `academic_session_id`) as non-null. With them, `pnpm typecheck` fails with 12 errors in
  the profile, taxonomy-request and wanted repositories. The committed, hand-adjusted file was
  kept. Open item: regenerate and adapt the repositories, or keep the nullable overrides.
- With the committed types: `pnpm typecheck` passes and `pnpm test` passes (1,029 tests).

## 2026-09-25 branded auth and notification emails (branch `claude/branded-emails`)

Spec `docs/superpowers/specs/2026-09-25-branded-auth-and-notification-emails-design.md`, plan
`docs/superpowers/plans/2026-09-25-branded-auth-and-notification-emails.md`. The user approved
Claude Code implementing both lanes for this feature.

- Verification and recovery emails link to `/auth/confirm`; the token is spent only by the
  button's POST to `/api/auth/confirm`. Recovery emails keep the 6-digit code as a fallback.
  After sign-up the user now lands on `/verify-email`.
- New notification kinds: `institution_verification_submitted` (Sheriff alert, fixed message with
  display name and institution) and `welcome` (once, on first email confirmation).
- `WELCOME` reward code: production already had an Owner-created code (2 free requests, 50
  redemptions). The user chose to keep it. The migration seeds the same values only where the code
  is missing, and the welcome email reads the live credit count, dropping the offer once the code
  can no longer be redeemed.
- Every email is branded HTML plus plain text using the provisional theme and
  `public/brand/email/logo.png` (provisional, 160×155, displayed at 96 px). `@react-email/components`
  was rejected because npm marks it unsupported, and `react-dom/server` fails the build inside App
  Routes, so the layout is an escaped string template with hostile-input tests.
- Spam-folder guidance appears after sign-up, on `/verify-email`, after a resend, after a recovery
  request, and in every email footer.
- Found and fixed in migration `202610010001`: `claim_notification_email_batch` returned
  `auth.users.email` (`varchar`) for a `text` column, so the version on Supabase Cloud fails the
  moment it leases a job. Queued notification emails have therefore never been sent from Cloud.
- Database verification: migration plus pgTAP ran against Supabase Cloud inside one transaction
  that always aborted (nothing committed). 9 of 13 assertions passed; the 4 failures were test
  assumptions (pre-existing platform Sheriffs, the existing WELCOME values), since corrected. The
  corrected 14-assertion run was blocked by the permission classifier and still needs to be run.
- `supabase migration list --linked` later showed `202610010001` applied on Supabase Cloud (applied
  outside this session, before the corrected test ran).
- The corrected `tests/sql/welcome_and_sheriff_alert_emails.sql` then ran against Supabase Cloud
  (test statements only, inside a transaction forced to abort, so nothing was kept): 14 of 14 pass.
- Pending user actions: in Supabase enable
  Confirm email, paste `supabase/templates/confirmation.html` (Confirm signup, subject "Confirm
  your VAULTIX email") and `recovery.html` (Reset password, subject "Reset your VAULTIX
  password"), and add `<origin>/auth/confirm` to the redirect URLs; confirm `NEXT_PUBLIC_APP_URL`
  in Vercel Production is the public origin.

## 2026-09-25 chat threads and 7-day retention

User decisions (all four recommended options accepted):
- After a missing item is marked found (or a discussion resolved), its chat and card stay on the
  Board for 7 days, then the messages are deleted and the card vanishes; a small record remains.
- Free missing items and discussions with no new message for 30 days close themselves; the poster
  is notified in-app and may reopen within the 7 days. Paid ones never auto-close (they keep the
  expiry and refund path, so no bounty is stranded).
- Academic bounties get a text-only Q&A thread. Links, email addresses and chat handles are refused
  in the database, so a resource cannot change hands outside a reviewed Claim. Questions are
  deleted 7 days after the bounty closes and the claim-review appeal window ends; the academic card
  stays in the Archive.
- Open threads refresh every 15 seconds while the tab is visible (no Supabase Realtime).

Implementation: migration `202610100001_chat_threads_and_retention.sql` (not yet applied to
Supabase Cloud). Verified locally: the whole chain applies on Postgres 16 with stubbed `auth` and
`storage`, and scripted assertions cover auto-close, idempotent re-runs, the 7-day purge, the
paid-release and refund holds, reopen rules, and the academic link refusal. pg_cron is scheduled
only where the extension exists.

Also fixed: the reply reader accepted only `open`/`closed`, so a thread under release review or
fulfilled looked empty. The migration grants `wanted_replies` to `service_role` explicitly, because
`202609210001` granted only the tables existing then — the likely cause of "Replies could not be
loaded" in the cloud (unconfirmed; check `has_table_privilege('service_role', 'public.wanted_replies', 'select')`).

## 2026-09-25 Sheriff and Owner step-up prompt

Reported: the Owner, while signed in, was told to "sign in again" when opening verification
evidence. Cause: evidence reads, verification decisions and restrictions require a sign-in within
the last 15 minutes (`private.current_user_recently_authenticated`, `last_sign_in_at`), and a
refreshed session does not renew it; the console had no way to re-confirm. Added
`POST /api/auth/reauthenticate` (password only; the email is always the signed-in account's own)
and an inline "Confirm it is you" prompt in the review console that retries the action. The
15-minute rule itself is unchanged.

## 2026-09-25 chat answer, edit, delete and hide

User decisions: quote-style answers; the author may edit for 15 minutes while the thread is open
(marked "edited", no history kept); the author may delete at any time (text erased, "Message
deleted" placeholder kept so answers still read); a Sheriff (platform, or institution Sheriff for
the Wanted's institution) or the Owner may hide any message with a reason code and restore it.
Hidden messages keep their text for moderation, are unreadable to members, survive the 7-day purge,
and every hide/restore is written to `identity_audit_events` (`chat.reply_hidden`,
`chat.reply_restored`). Migration `202610100002_chat_reply_edit_delete.sql` (not yet applied to
Supabase Cloud); verified on local Postgres 16 with scripted assertions. Restoring hidden messages
has no UI yet: it belongs to the Owner console slice.

Also decided (next slices, not built yet): Owner console for people management and content
moderation (no raw database editor; money stays read-only there); Owner-awarded badges shown beside
names, separate from the institution-verified star; timed account timeouts (1 hour, 24 hours,
7 days, auto-lifting, permanent restriction Owner-only) and idle sign-out.

## 2026-09-25 timeouts, idle sign-out, member console and badges

Built from the decisions recorded above (user chose: timeout = both a moderation timeout and idle
sign-out; Owner console = manage people + moderate content; badges = Owner-awarded, separate from
the verified star; no raw database editor).

- Migration `202610100003_account_timeouts.sql`: `account_restrictions.expires_at`;
  `timeout_account` (1 h, 24 h, 7 days) for the Owner, platform Sheriffs, and institution Sheriffs
  over verified members of their institution; nobody times out the Owner and only the Owner times
  out a platform Sheriff. **Behaviour change:** `restrict_account` (permanent) is now Owner-only;
  platform Sheriffs could call it before. `lift_account_restriction`; a pg_cron job lifts expired
  timeouts every minute. All need a sign-in in the last 15 minutes and are audited.
- Migration `202610100004_member_console_and_badges.sql`: console functions (search, rename, reset
  avatar, manual institution verification grant/revoke, appoint/remove Sheriffs, timeouts, hidden
  message list) and badges (`badges`, `badge_awards`, public `badges` bucket writable only by the
  Owner). Institution Sheriffs see only their institution's members and never email addresses. The
  Owner role is not assignable anywhere in the app.
- Console pages: `/console/people`, `/console/moderation`, `/console/badges`. Badges show beside
  names in chat and on public profiles. A timed-out member sees when the timeout ends.
- Idle sign-out: Sheriffs and the Owner after 30 minutes idle (browser, warned 2 minutes before),
  members after 7 days (browser and a `vaultix_last_seen` cookie checked by the proxy).
- `supabase/tests/local/` holds the scripted SQL assertions and a runner for a throwaway local
  Postgres 16; never point it at Supabase Cloud.

Open questions added: taking down a Wanted from the console (a paid one involves refunds, so it
was not built); whether institution Sheriffs should rename members; retention of orphaned badge and
avatar images after a reset or retirement.

`202610100001` to `202610100004` were later renumbered to run after `202610010001` (welcome and
Sheriff-alert emails); `supabase migration list --linked` shows all five applied on Supabase Cloud.

## 2026-09-25 cloud apply of the 202610 migrations

The user applied `202610010001_welcome_and_sheriff_alert_emails` (branded-emails work) and then
`202610100001`-`202610100004` to Supabase Cloud (`supabase db push`). Read-only check afterwards:
the chat-cleanup, edit/delete, timeout and badge schema exist, `service_role` can read
`wanted_replies`, pg_cron is installed, and the Owner is `rahiminazri432@gmail.com`. The chat and
console migrations were renumbered from `202610010001`-`202610020002` before any was applied,
because the welcome migration already used `202610010001`; the chat migration now appends its
notification kind to the current list instead of replacing it, and leaves the email-outbox
function to the welcome migration. The `claude/branded-emails` branch carried unresolved merge
markers in `src/contracts/notifications.ts`, `email-delivery-service.ts` and this file; resolved
by keeping both sides (subjects now live in `notification-email-content.ts`).

## 2026-09-25 QA fixes and email delivery (branch `claude/festive-lamport-trp95d`, on `production`)

User QA reported that no email arrived and listed UI and console defects. The user approved the
recommended options for all four open decisions.

Email:
- Notification emails were queued but never sent: nothing called the dispatcher. Migration
  `202610110001` schedules it with Supabase Cron + pg_net every minute, only when a job is due.
  The endpoint now takes `NOTIFICATION_DISPATCH_SECRET` (32+ characters) instead of the
  service-role key. Jobs older than 14 minutes go to manual review rather than being sent late.
- Sign-up no longer sends people to "check your email" when Supabase returns a session
  (Confirm email off, so no email was sent); it goes straight to the profile.
- Pending user actions: apply `202610110001`-`202610110003`; set `NOTIFICATION_DISPATCH_SECRET`
  in Vercel and add Vault secrets `notification_dispatch_url`
  (`https://bilikkebal.afes.my/api/internal/notifications/email`) and
  `notification_dispatch_secret`; confirm pg_net is enabled; check Supabase Auth custom SMTP
  (Brevo host, SMTP login and SMTP key), turn Confirm email on, and read Brevo's transactional
  logs for the recovery test email.

Decisions (user approved the recommendations):
- The platform fee panel is shown only to the poster. Other viewers see the provider checkout
  charge that applies to a Backer; the fee rate stays snapshotted and unchanged.
- The bell opens a dropdown of the latest 8 notifications with Mark all read
  (`202610110002`, `mark_all_notifications_read`); `/notifications` stays as the full inbox.
  Opening a notification marks it read and refreshes the unread count.
- A Sheriff hiding a chat message notifies the writer (`wanted_reply_hidden`, `202610110003`)
  in-app and by email, naming neither the message nor the Sheriff. Restoring does not notify.
- Board cards show a pixel drawing of what is wanted (resource type, magnifier for missing
  items, speech bubble for discussions). No uploaded images.

Fixes:
- Assign Sheriff: the password step-up form was nested inside the action form, so confirming
  re-submitted the action and the change never saved. Same for badges. Console ids now accept
  hand-seeded UUIDs.
- Entries & releases hid the viewer's own requests. They are now listed, labelled, with
  decisions disabled.
- Claim submission: the upload route looked the Wanted up by its internal id while screens send
  the public id, so every submission failed. The route now resolves the public id.
- Mark as read saved but the server-rendered badge never refreshed.
- Chat "Answer" is now "Reply"; profile opens with Your requests; campus cards are one size;
  institution verification is grouped into spaced cards; loading states carry a spinner; the
  Board loads with poster skeletons; the masthead reads WANTED.

## 2026-09-26 motion handoff (gunshot transition, capture poster, living map)

Ported `design_handoff_vaultix_motion/` into `src/components/motion/` with the prototype's values
unchanged. Inline styles became classes and tokens at the end of `src/app/globals.css`, so no
component restates a colour. Colours the theme already had reuse its tokens (same values).

- Gunshot transition: `GunshotProvider` in the root layout; `ShotLink` on the primary nav,
  "Post a Wanted", the wordmark and the two Wanted card links, and nowhere else. The route
  changes at 390 ms and the overlay clears at 1050 ms. Modified clicks, reduced motion and the
  toggle set to Off all navigate normally. Outside a provider `ShotLink` is a plain link.
- Toggle: fixed bottom-left, saved as `localStorage["vaultix.gunshot"]`, default on. It hides
  while the idle sign-out warning is up, because on narrow screens the warning spans the bottom
  edge and the warning matters more.
- Capture poster: shown only when `submitClaimFile` succeeds. The word is picked once and never
  repeats the previous one. Esc closes only the poster. The Hunt link gets focus through a ref,
  because React applies `autoFocus` only to form controls. The Hunter name is
  `useAuth().state.account.displayName`, falling back to "you".
- Living map: `MapLife` over the map image. It does not render when reduced motion is on.
- The handoff bundle is left out of ESLint and Prettier (`design_handoff_*`); it is reference
  material, not shipped code.

## 2026-09-26 Sheriff console fixes, People redesign, badge awards, Wanted pictures

- **Entry requests (root cause).** The Add/Decline buttons were disabled on the viewer's own
  request, and the only pending request (a campus) was the Owner's own. The database already let
  the Owner decide it (verified as the Owner in a rolled-back transaction). Now the Owner may
  decide their own entry request; a Sheriff still leaves theirs to someone else. A party still
  never decides a bounty release (money), the Owner included.
- **Campus duplicates.** Approving a campus request whose name is already listed (for example
  "Machang" against the locked "UiTM Machang") now reuses and opens that campus instead of adding
  a second pin (`decide_taxonomy_request`, migration `202610120001`).
- **People** is a directory on the left and the chosen member's settings on the right, in three
  tabs (Moderation, Profile, Roles & badge). Below 60rem the settings open above the list. A
  Sheriff can see the Owner's row but not manage it.
- **Badges** can be awarded from the Badges page: a member dropdown per badge (the first 50
  members; others from People), the current wearers with Remove, and the password step-up shown
  beside the action that needs it. Awarding replaces a member's current badge.
- **Wanted pictures** (user decision 2026-09-26: a picture per Wanted, shown at once, removable
  by a Sheriff). A poster picks the automatic drawing, one of 50 drawings
  (`src/features/presentation/pixel-drawings.ts`, append-only: the index is stored), or uploads
  their own. The browser crops, zooms, pixelates (16/24/32 grid, optional retro colours) and
  saves a 192 px PNG, which drops camera metadata; the file goes straight to the public
  `wanted-pictures` bucket (PNG, 64 KB) in the uploader's own folder. Pictures live in
  `wanted_pictures`, apart from the Wanted row, so setting one never changes the draft's
  `updated_at` or its duplicate-check token; the paid path saves it on the draft before payment.
  A Sheriff who moderates the Wanted, or the Owner, removes a picture with a reason code
  (audited in `identity_audit_events`; the upload is kept). A failed picture read shows the
  automatic drawing instead of failing the Board.
- **Not yet applied to Supabase Cloud:** migration `202610120001_wanted_pictures_and_entry_fixes`
  was written but the push was not run from this session. Until it is applied, the picture
  routes answer "unavailable" and the Board shows automatic drawings. After applying, regenerate
  the database types and drop the untyped casts in `src/lib/wanted-pictures.ts` and
  `supabase-wanted-picture-repository.ts`.
- Open question: moderation of uploaded Wanted pictures beyond Sheriff removal (reporting, a
  review queue) is not specified.

## 2026-09-26 performance remediation (branch `claude/vibrant-heisenberg-3g7ujl`)

User-directed full-stack slice executing a Gemini diagnostic report after verifying it against the
code and the installed Next.js 16.3.5 sources. Record:
`docs/superpowers/plans/2026-09-26-performance-optimization-plan.md`.

- **Root cause found (not in the report):** production functions run in `iad1` while Supabase is in
  `ap-southeast-1`; every Supabase call crosses the Pacific. Not changed in code (production
  provider setting). Owner action: set the Vercel function region to `sin1`.
- **Corrections to the report:** Next already memoises identical GET fetches within a render, so
  pages made 1 Supabase Auth call, not 7; prefetches never rendered layouts or pages; the hero and
  map are already about WebP q80 and served resized by `next/image`.
- **Changed:** `prefetch={false}` on per-item and per-tab links, with intent prefetch on the shell
  rail; request-scoped `getRequestSupabaseClient()`, `getRequestUser()`, `loadAccountContext()` and
  `readAccount()` (`React.cache`, one request only); independent reads run together (layout,
  `/claims`, `/wanted/[id]`, library, console guards); console overview counts read on the server
  (`loadConsoleQueueCounts`) instead of four browser calls; `/map` ship sprites read a 43.8 KB strip
  (`public/brand/map-ships.webp`) instead of the 397 KB map; plain `<img>` elements load lazily.
- **Verified:** lint, format, typecheck, 1,291 unit tests and production build pass. Production
  builds against a stand-in Supabase with 100 ms per call: `/claims` 644 → 333 ms,
  `/console/people` 532 → 325 ms, most pages ≈430 → ≈325 ms; prefetch requests per page view
  13–27 → 0–4. Supabase itself was not reachable from this environment (egress policy), so no
  request reached production.
- **Deliberately not done:** a shared cross-user cache for taxonomy, institutions and campus
  regions (needs the service-role client, an RLS bypass; campus regions carry bounty totals).

## Open Questions

- Should the writer of a hidden chat message see the reason code (needs notification context or
  author read access to their own hidden message)?
- With the platform fee shown only to the poster, should Hunters see the net payout before
  claiming?

- Account deletion and retention: what is deleted, anonymised or kept, and when.
- Performance (Owner): move Vercel functions to `sin1` beside the Supabase project (check regional
  pricing on a paid plan); confirm Supabase uses an asymmetric JWT signing key so the session proxy
  verifies locally; decide whether loaders may use `auth.getClaims()` (faster, but does not notice
  revoked sessions and lacks `email_confirmed_at` and `last_sign_in_at`); validate embedding the
  institution in the account read on a preview deployment before adopting it.
- Moderation of reward-code abuse beyond the 10 failed attempts per hour limit.

- Legal review of the drafted posting terms (`src/features/legal/terms.ts`).
- Moderation of free-text replies on missing-item and discussion requests (reporting exists for
  claims only).

### Critical Before Public Launch

- Name the legal platform operator and ToyyibPay merchant account owner for Terms, Privacy Notice, receipts, payout, and complaints.
- Confirm ToyyibPay's live callback security contract, merchant fees, refund route, settlement behaviour, and access to any payout/disbursement API.
- Obtain legal/provider review of funds flow, liability treatment, refunds/chargebacks, takedown, copyright, PDPA obligations, taxation, and retention.
- Confirm official UiTM email domains and the evidence accepted for manual institution verification.
- Select the authoritative UiTM campus/faculty/programme/course taxonomy source and the staff member allowed to maintain it.
- Select and fund the isolated scanning worker/provider before public uploads are enabled.
- Decide the paid or otherwise compliant Vercel/Supabase production arrangements before public commercial use.
- Receive the external designer's final tokens, assets, responsive screens, and state designs.

### Can Be Resolved During Implementation Planning

- Select the exact error-tracking provider and retention settings.
- Select the scanner container host and document-conversion toolchain.
- Define the initial moderation reason-code catalogue and institution-specific policy flags.
- Define the final legal metadata-retention periods after professional review.

## Architecture Decisions

- **Supabase-centric first:** one managed platform reduces initial setup and operational burden. Storage records include a provider field so R2 can be introduced later without rewriting Claim or Entitlement logic.
- **Modular monolith:** domains remain isolated in code and data contracts without premature microservices.
- **Separate scanner worker:** large untrusted-file processing is not suitable for Vercel or Supabase Edge Function limits.
- **PostgreSQL source of truth:** financial and access relationships require transactions, constraints, and auditable relational state.
- **Immutable ledger:** refunds, chargebacks, fees, and corrections are compensating entries rather than edits.
- **Manual money release first:** Owner records payout/refund performed outside the system until provider automation is validated.
- **Human moderation:** automated screening prioritises and supplies evidence but never approves or finally rejects a claim.
- **Configuration snapshots:** fee, access basis, duration, policy version, and relevant limits are preserved per bounty/claim so later patches do not rewrite historical obligations.
- **Free tiers for controlled testing:** free infrastructure is acceptable for development and invited tests; public commercial use requires launch-gate review and appropriate service plans.

## Session Notes

- The session-refresh proxy had never run. Next resolves the `proxy` convention relative to the
  directory holding `app/`, so the file at the repository root was silently ignored while
  `src/app/` existed, and no Supabase session was ever refreshed — every session died at its access
  token's expiry. Moving it to `src/proxy.ts` fixes it. Verified by probe: the proxy executes from
  `src/` and does not from the root. A failure inside it now degrades to an unrefreshed request
  rather than a 500 on every route, including the sign-in screen someone needs to recover.
- The frontend deliberately has no `hasRole`. `AccountViewModel` publishes capabilities and a
  navigation-only `console.hasAccess`, and no role, so a frontend role model would fork a
  backend-owned domain type. Guards read the published capabilities as-is.
- Route guards are a courtesy to the reader, not access control: every operation behind them
  authorises again server-side and is repeated by RLS.
- The workspace is a Git repository on `main`, tracking `origin/main` on GitLab.
- The user authorised the assistant to choose safe non-critical technical defaults and only escalate critical product, money, legal, privacy, ownership, migration, or recurring-cost decisions.
- The user wants patch-by-patch delivery and expects setup/navigation guidance for Supabase, Vercel, Cloudflare, Resend, and ToyyibPay when implementation begins.
- The current approved storage choice is Supabase Storage. Cloudflare R2 is a future hybrid option, not a current dependency.
- `Live Limited` may use real ToyyibPay payments for controlled tester accounts, with RM1-RM50 contributions and no platform-wide daily cap.
- Public upload remains disabled until a production scanning worker is available.
- The user approved phased full-MVP development and separate frontend/backend ownership. Gemini
  replaces Claude Code in the frontend lane; Codex remains in the backend lane. Application coding
  begins after the relevant phase plan is written.
- Supabase Cloud has replaced the local Supabase runtime for active development.
  Historical local configuration used API `55421`, DB `55422`, Studio `55423`
  and Mailpit `55424`; these ports do not describe the current cloud environment.
  Automated tests continue to use synthetic accounts and must not send real email.
- 2026-09-23 correction: do not treat stopped Docker as a project blocker or
  Supabase Cloud setup as outstanding. Confirm the intended cloud project and
  test isolation before applying migrations or running database mutation tests.
- Official institution email domains remain intentionally unseeded pending product approval; `example.test` was used only as a temporary local smoke fixture and is not part of migrations.
- Production marketplace taxonomy remains intentionally empty until an authoritative UiTM source and maintainer are approved.
- Local development has the verified `hunter.demo@vaultix.test` account; migrations and CI do not depend on this machine-only identity.
- The earlier provisional Wanted workspace at `60e4566` was fixture-backed. The UI branch later
  connected marketplace reads at `804c934`; its current uncommitted visual work needs a Gemini
  checkpoint before any backend integration merge.
- ToyyibPay callback verification, fees, refund behaviour and settlement semantics remain unresolved launch gates. Payment defaults to disabled and Phase 3A has no success adapter.
- Phase 3B migrations `202609150004` through `202609150009` are applied locally without resetting the demo database; the follow-up migrations preserve the actually applied callback hardening history, and the money pgTAP suite exercises the real RPC paths.
- Phase 3A implementation commits: `d622bd5`, `7501359`, `f7ead1e`, `b1ebd02`, `0fcf925`, `43ef920`, documentation `4d52562`, and token-boundary hardening `fe6b534`.
