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
- Hunters wall: should members be able to opt out of being listed? Every institution-verified,
  unrestricted member is listed now; there is no profile visibility setting.
- Hunter profile stats: the design shows "Claims approved" and "Bounties backed". Not shown,
  because public profiles exclude claims and contributions (2026-09-24). Needs a decision before
  either count is published, even as a total.

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

## 2026-09-28 poster edit/withdraw, share poster, payment walkthrough (on `main`)

User-directed slice. Decisions the user made when asked: the payment "simulation" is a UI
walkthrough that writes nothing (the local app and the live site share one Supabase Cloud
database), and a withdrawn paid Wanted sends every contribution to the manual refund queue.

- **Poster edit/withdraw.** Migrations `202610130001` (enum value `withdrawn`, alone because a new
  enum value cannot be used in its own transaction) and `202610130002` (lifecycle constraint,
  `withdrawn_at`, private `wanted_request_revisions`, `my_wanted_change_window`,
  `update_own_published_wanted`, `withdraw_own_wanted`). Rules are in
  `context/project-overview.md` ("Changing a published Wanted"). Two guards close the gaps
  around a withdrawal: a trigger queues a refund for a contribution confirmed after withdrawal
  (late provider callback), and a `before insert` trigger on `claims` takes a share lock on the
  Wanted and refuses a claim unless it is open or reviewing, which orders claim creation against
  the withdrawal's row lock. No ledger entry is written by withdrawal; the Owner's existing
  `record_owner_refund_completion` posts the compensating entries.
- Routes: `PATCH /api/marketplace/wanted/:id` (title, description) and
  `POST /api/marketplace/wanted/:id/withdraw`; new operation code `WANTED_LOCKED` (409). The
  RPCs are called through an untyped client until the database types are regenerated.
- UI: `WantedPosterControls` on the detail page (countdown, edit dialog, withdraw confirmation
  that states the refund), a success notice on `/profile?withdrawn=1`.
- **Share.** `SharePoster` reuses the capture poster's drop, dust and thud without stamp or ink.
  The picture (1080×1350 PNG) is drawn on a canvas from the CSS tokens when the dialog opens, so
  the share button can hand it to the system share sheet inside the click. Where files cannot
  be shared (most desktops), WhatsApp/Telegram open with the caption and link and the picture is
  saved for the person to attach; web links cannot carry an image to either app.
- **Walkthrough.** `/payment/walkthrough` (optionally `?wanted=<id>&amountSen=` or
  `?title=&amountSen=`) steps through checkout, return page, verified callback and ledger, the
  first-hour window, claims, Sheriff review, payout arithmetic (fee rounded down in integer sen,
  as `approve_winning_claim_and_fulfill` does) and refund on expiry. Linked from the
  payment-disabled states of the draft workspace and the Back dialog. No request is sent.
- Verified: typecheck, full unit suite (172 files, 1326 tests), production build, ESLint and
  Prettier on the changed files. `supabase/tests/local/poster_edit_withdraw.sql` passes on the
  full migration chain in PGlite (Postgres 16 in WebAssembly; superuser, so grants and RLS are
  not exercised; single connection, so the claim/withdraw race is reasoned, not tested); a
  deliberately broken assertion failed as expected.
- **Not yet applied to Supabase Cloud.** Until `202610130001` and `202610130002` are pushed, the
  detail page shows no owner controls (the window read fails closed) and edit/withdraw answer
  "unavailable". After applying, regenerate the database types and drop the untyped cast in
  `supabase-wanted-poster-repository.ts`.
- Found, not fixed: `BackWantedModal` posts to `/api/marketplace/wanted/:id/contribution`, which
  has no route (only `drafts/:id/contribution` exists), so backing an open Wanted can never
  reach the provider even once payment is enabled. Needs a backend contribution operation for
  open Wanteds.
- Open questions: in-app or email notice to Backers when a Wanted they funded is withdrawn (not
  sent now; adding a notification kind would also enqueue email through the outbox trigger);
  whether withdrawing should return a used free request (it does not, because the allowance
  counts every non-draft free Wanted).

## 2026-09-28 Hunters wall, homepage Hunters, profile poster (branch `claude/hunters-wall`)

- Handoff: `design_handoff_vaultix_hunters/README.md` (not committed). Decisions (user, 2026-09-28):
  the wall lists institution-verified members with no active account restriction; the profile
  keeps its existing stats and does not add "Claims approved" or "Bounties backed"; the homepage
  sample is drawn in TypeScript from one random page of 20 (every member while there are 20 or
  fewer), so the migration adds one function only.
- Migration `202610140001_list_public_hunters.sql`: `list_public_hunters(page_size, page)`,
  security definer, `authenticated` only, refuses an unverified email (`EMAIL_NOT_VERIFIED`),
  page_size in {10, 15, 20} and page >= 1 or `22023`. Returns public id, display name, avatar
  key or preset, verified institution name and joined date; never email or user id. Order
  `created_at desc, public_id`. Called on the viewer's own session, untyped until the types are
  regenerated (`supabase-hunters-repository.ts`).
- `GET /api/hunters?per=&page=` for paging; the service serves the last page when asked for one
  past the end. `/board?view=hunters&per=&page=` renders the first page on the server; later
  pages are fetched while the posters fly off and pushed to the URL without a round trip, and
  Back flips to the page in the URL. Reduced motion swaps in place.
- UI: `BoardViewToggle`, `HuntersWall`, `MissingPoster`, `HuntersWallScraps`, `HomeHunters`, a
  big poster, "Back to Hunters" (only with `?from=hunters`) and the privacy note on
  `/u/[publicId]`. New tokens in `globals.css` under "Hunters wall". The homepage strip's refusal
  carries no link of its own; Featured Wanted directly above already offers sign-in.
- Not yet applied to Supabase Cloud. Until `202610140001` is pushed, the wall and the homepage
  strip show "could not be loaded".
- `supabase/tests/local/list_public_hunters.sql` was written but not run in this session (no
  local Postgres, Docker not running).
- Share-a-Wanted parity with the handoff (section 4) was reviewed, not changed; the gaps are listed
  in the handoff review: no share button on cards, caption not editable, caption wording and
  days-left line, the kicker's code, the inherited thud, caption rise at 900 ms not 820 ms, button
  order and the "Other apps" fallback not saving the picture, no focus trap in the dialog.

## 2026-09-28 programme catalogue, searchable programme, typed course code, one Sheriff request (branch `claude/uitm-terengganu-taxonomy`)

Decisions (user, 2026-09-28): faculty and programme names in Malay only (the interface stays
English); faculties and programmes stay under the institution, not tied to a campus; members type
the course (subject) code themselves, capital letters required; one "Ask a Sheriff" button with the
kind of entry chosen inside; UMPSA added as a second institution (Pekan campus only).

- Data came from the user as lists compiled with ChatGPT from UiTM and UMPSA pages. It is still not
  the authoritative taxonomy source the launch gate asks for. Names given in English were put into
  Malay by Claude and are not the institutions' published Malay names; they need checking.
- Migrations, each dry-run on Supabase Cloud inside a block that always raised (so rolled back),
  then pushed with `supabase db push --linked`:
  - `202610150001` UiTM Kuala Terengganu, Dungun, Bukit Besi: 8 faculties, 26 programmes. The
    existing FSKM and computer science rows keep their ids (7 Wanteds reference them); only their
    names changed.
  - `202610150002` UiTM Puncak Alam and Shah Alam: 12 more faculties, 101 more programmes (UiTM
    now 20 and 127). HM240/HM242 renamed to their new codes HM260/HM262 with the old code in
    brackets. Every faculty and programme sort order is 0, so lists read alphabetically and
    programmes by code. Left out until confirmed: HM260/HM262 as separate rows, AS290/AS291,
    EM242-EM246, Pra Diploma Sains.
  - `202610150003` `ensure_course(programme, code)`: finds the institution's course with that
    code or files a new one under the programme, named by its code. Same eligibility as creating a
    draft; refuses lower case, a deactivated course and an inactive programme.
    `wanted_taxonomy_is_valid` no longer requires the course to sit under the chosen programme (a
    subject code such as ELC231 is shared). Verified by the assertions in
    `supabase/tests/local/ensure_course.sql`, run against Cloud and rolled back (Docker not
    running, so the local harness was not run).
  - `202610150004` UMPSA: institution, open campus "UMPSA Pekan" (map position approximate), 4
    faculties, 29 programmes. No UMPSA email domain seeded, so UMPSA members verify by evidence.
- Contract: the draft body carries `courseCode` instead of `courseId`
  (`docs/integration/marketplace-http-contract.md`). The service checks the rest of the taxonomy
  first and only then calls `ensureCourse`, so a refused draft files no course.
- UI: `SearchSelect` (WAI-ARIA combobox) for Programme; every programme is searchable until a
  faculty narrows it, and choosing a programme fills in its faculty. Course code is a text box
  that keeps capitals as typed, with the codes already in use suggested. One "Ask a Sheriff to add
  something" button opens `TaxonomyRequestDialog`, where the member chooses what is missing
  (courses are no longer asked for).
- Verified: typecheck, lint on changed files, 1,412 tests and the production build pass (the
  dialog change was re-tested on its own suites afterwards: 72 tests).
- Correction: `202610140001_list_public_hunters` is applied on Supabase Cloud (seen in
  `schema_migrations` on 2026-09-28).
- Open questions: any verified member can now add a course code, so a typo (CSC51O) becomes a
  listed course that everyone sees in the Board filter; there is no rate limit or Sheriff review
  of new codes yet. Which email domains prove UMPSA membership. Whether a campus should narrow the
  programmes offered there (the user chose not to, for now).
- Reporting a Wanted (bounty) to Sheriffs and the Owner was requested and then cancelled by the
  user (2026-09-28). Reporting still exists for claims only.

## 2026-09-29 each university browsed on its own (branch `claude/uitm-terengganu-taxonomy`)

Decisions (user, 2026-09-29): UMPSA and UiTM are separate. A filter, not a wall: a member sees only
their own university's Board, map and Hunters, and a shared link to another university's Wanted
still opens read-only. Anyone not yet institution-verified picks a university with a switch. UMPSA
student addresses are `@adab.umpsa.edu.my`. Assumed, stated to the user and not objected to: one
account belongs to one university.

- Migration `202610150005_university_separation.sql` (dry-run on Cloud and rolled back, then
  pushed): `institutions.short_name` (UiTM, UMPSA); `adab.umpsa.edu.my` as a UMPSA verification
  domain; `list_public_hunters_at(institution, page_size, page)`. The two-argument
  `list_public_hunters` stays so the deployed site keeps working until it moves over; drop it
  after that deploy. Dry run: 5 UiTM Hunters, 0 UMPSA.
- `loadUniversityChoice` (identity) and the pure `chooseUniversity`. The Board list, featured
  requests, campus map, Hunters wall, homepage Hunters and the filter catalogue of anyone not yet
  verified are read for that university. `ListWantedQuery.institutionId` is set by the loader and
  never taken from the URL. `WantedSummary.institutionId` is new.
- The institutions list for the switch is read with the service client (a signed-out reader has
  no RLS path to `institutions`); only id, slug and names of active institutions.
- UI: `UniversitySwitch` on the Board (both views), the map and the homepage's Featured Wanted; a
  verified member sees "Showing UiTM, the university you verified with." instead. Switching drops
  the filters in the URL. The Hunters wall label follows the university. A member verified at
  another university sees a Wanted read-only: no Back, Claim or reply, and a note naming its
  university. "UiTM email domain" copy is now "university email domain".
- Not done: a university badge on each card (the campus name, for example "UMPSA Pekan", already
  says it, and a Board only shows one university); an Institution Sheriff for UMPSA (Platform
  Sheriffs and the Owner review UMPSA meanwhile); profile pages still list a member's Wanteds
  whatever the viewer's university.

## 2026-09-29 theme music (uncommitted, in the `claude/uitm-terengganu-taxonomy` working tree)

Request (user, 2026-09-29): "I want the theme song for this game VAULTIX to be played in the
background of the page. 2 minutes is long enough."

- `public/audio/vaultix-theme.mp3`: 120.0 s, 128 kbps, 1.9 MB. An original western theme in A
  minor at 104 BPM (whistle, fingerpicked and tremolo guitars, trumpet, choir, gallop drums),
  synthesised in `brag-output-2026-09-29-201653/work/theme.py` (not committed, like the earlier
  brag cues; keep it to re-render). It opens with the whistle call from the brag videos. The last
  bar fades to silence, so the gap a browser leaves when looping an MP3 cannot be heard.
- `ThemeMusic` (`src/components/theme-music.tsx`) sits on the rail in `AppShell`, which the root
  layout keeps mounted, so the music carries on across client-side navigation. Behaviour is in
  `context/ui-context.md` (Sound). New pixel icons `sound`, `sound-off`; new token
  `--bg-rail-selected` (the nav's current-page tint now uses it too).
- Verified: 11 component tests plus the shell suite (38), typecheck, and lint on the changed
  files. In Chrome on `pnpm dev`: plays, fades in to 0.45, carries on across a navigation, stays
  off after a reload once turned off (the file is not fetched), and starts on the first tap when
  autoplay is blocked (360 px, touch). No console errors.
- Assumed, not asked (reversible): on by default and on every screen, including the Sheriff
  console; a toggle rather than a volume slider.
- Open questions: whether screens that call for focus (claim review, payment, evidence) should
  stay silent; whether the owner or designer wants to approve or replace the provisional theme
  before launch (it is a brand asset).

## 2026-09-29 two more songs; the music becomes a three-song playlist (uncommitted, same working tree)

Request (user, 2026-09-29): "I want two other songs, about 2 minutes each, each one different."

- `public/audio/vaultix-boomtown.mp3`: a saloon romp in G major at 132 BPM (fiddle, honky-tonk
  piano, banjo, washboard), up a step to A halfway, ending on "shave and a haircut".
  `public/audio/vaultix-campfire.mp3`: a quiet night in E minor, 6/8 (nylon guitar, harmonica,
  cello, crickets and a fire). Each is exactly 120.0 s and ends in silence. Sources are in
  `brag-output-2026-09-29-204049/work/` (`vx_synth.py`, `boomtown.py`, `campfire.py`, and
  `master.py`, which matches all three songs, the theme included, to -17.1 LUFS and encodes
  them). Not committed; keep them to re-render.
- `ThemeMusic` plays `THEME_TRACKS` in turn (theme, Boomtown, Campfire, then the theme again)
  instead of looping one file, keeps the rail on through each handover, and names the song
  for the operating system's media controls.
- Fixed: the fade-in could set a negative volume when the first animation frame was stamped
  a moment before the fade began. The browser threw and the fade stopped at volume 0, so the
  song played silently. Seen in Chrome's console, reproduced in a test, clamped.
- Verified: 40 tests (theme music and shell), typecheck, lint. In Chrome on `pnpm dev`: Theme ->
  Boomtown -> Campfire -> Theme, each 120 s, the rail stays on and the media title follows.
- The earlier `.theme-music` styles and the `--bg-rail-selected` token were committed by the
  other session in `9c3203f` (they were in `globals.css` when it committed).

## 2026-09-29 Clerk production setup (decision: move auth to Clerk)

- Decision (user): option A, Clerk replaces Supabase Auth; Supabase trusts Clerk tokens as a
  third-party provider. `architecture.md` still says Supabase Auth until the migration slices land;
  plan and open questions in `docs/superpowers/plans/2026-09-29-clerk-auth-migration.md`.
- Done: Clerk production instance `ins_3K0FcdljHNhcTPvFfTf4SHyNygS` on `bilikkebal.afes.my`
  (cloned from dev); Vercel project `bilik-kebal` linked to the GitLab repo with Clerk live keys and
  sign-in/up URL vars in Production only.
- Pending (user): DNS CNAMEs, Vercel domain, Clerk `role: authenticated` session claim, Google
  OAuth production credentials, Supabase Clerk third-party provider, remaining Production env.
- Later the same day (user): Vercel project is `reamynadzris-projects/vaultix` (the
  `haziq3010s-projects/bilik-kebal` project created by mistake is to be deleted); Clerk live keys and
  URL vars set there; DNS records added and verified; Supabase Clerk third-party provider enabled
  for `https://clerk.bilikkebal.afes.my`; session claim `role: authenticated` and Google
  production credentials set. Decisions: import users with passwords, Clerk sends auth email,
  Sheriff step-up = Clerk reverification with the 15-minute window.
- Until slices 1–3 of the plan ship, a production deploy signs people into Clerk but Supabase RLS
  still keys on `auth.uid()`, so identity-backed screens will not work. Do not launch on it.
- Slice 1 (branch `claude/clerk-auth-migration`): migration `202610160001_clerk_identity_bridge.sql`
  adds `private.user_identities` (Clerk subject, email, email verified; private because
  Institution Sheriffs can read profiles), `private.current_user_id()`, rewrites every `auth.uid()`
  in public/private functions and public/storage policies from their live definitions, reworks the
  five functions that read `auth.users`, and drops `profiles → auth.users`. Supabase Auth sessions
  keep working through a transitional uuid branch and an `auth.users` sync trigger. Step-up reads
  Clerk `fva` (0–14 minutes). Tests: `supabase/tests/local/clerk_identity_bridge.sql`; all 12 local
  DB suites pass on PGlite (no local Postgres here). Cloud check:
  `supabase/tests/cloud/verify_202610160001_clerk_identity_bridge.sql`. **Not pushed to Supabase
  Cloud** — waits for review.
- Slice 2: migration `202610160002_clerk_user_sync.sql` adds `public.sync_clerk_user(...)`
  (service role only): creates the profile and identity for a new Clerk user, links an imported
  Supabase Auth account through Clerk `external_id`, ignores out-of-order deliveries by Clerk
  `updated_at`, and enqueues the one-per-account welcome when the email is verified. Route
  `POST /api/webhooks/clerk` verifies the Svix signature (`CLERK_WEBHOOK_SIGNING_SECRET`), answers
  400 on a bad signature and 503 on a failed sync so Clerk retries, and logs no payload.
  `user.deleted` is acknowledged and not acted on (deletion is still an open question). Tests:
  `supabase/tests/local/clerk_user_sync.sql`, `clerk-user-sync.test.ts`,
  `clerk-webhook-http.test.ts`; full unit suite (185 files) and 13 DB suites pass.
- Slice 3: with a Clerk session, `createSupabaseServerClient()` sends the Clerk session token
  (`accessToken`, no `auth` API) and `getRequestUser()` reads the member through
  `public.current_identity()` (migration `202610160003`), keeping Supabase's `User` field names
  (`RequestUser`) so callers are unchanged; `last_sign_in_at` comes from Clerk `fva`. A Clerk
  account the webhook has not reached yet is provisioned on first request through
  `sync_clerk_user`. Without a Clerk session everything still runs on Supabase Auth. The Supabase
  Auth flows (confirm, recover, reset, reauthenticate, callback, auth gateway) use
  `createSupabaseAuthClient()` until slice 4. The proxy's Supabase refresh and 7-day idle backstop
  only affect Supabase Auth sessions; the Clerk equivalent is the instance inactivity timeout
  (dashboard, pending). Sign-out does not end a Clerk session yet (slice 4). Unit suite, 14 DB
  suites and the production build pass.
- Slice 4: sign-in (password, Google via the new `/sso-callback`, Clerk device-trust email code),
  sign-up (email code before the session starts, `#clerk-captcha`), `/recover` (Clerk reset code +
  new password; unknown addresses answered like known ones), `/verify-email` (Clerk email code for
  a signed-in unverified account) and the Sheriff step-up (`ConfirmIdentity` → Clerk session
  reverification, token refreshed so `fva` reaches the server) run on Clerk. `/reset-password`
  permanently redirects to `/recover`. Sign-out and idle sign-out clear the old Supabase cookie,
  then end the Clerk session. `POST /api/identity/clerk-sync` copies the caller's own Clerk
  account to VAULTIX immediately (idempotent; no body). Clerk refusals go through
  `clerk-messages.ts` so a wrong password and an unknown address read the same. The Supabase auth
  routes stay until slice 6. **The import (slice 5) must run before slice 4 is deployed.**
  A Google-only Sheriff has no password to reverify with and is told so. 189 unit files, lint,
  typecheck and build pass.
- Slice 5: `scripts/sql/export-supabase-users-for-clerk.sql` (read-only; output holds bcrypt
  hashes, keep outside the repo and delete after) and `scripts/import-users-to-clerk.mjs` (Node
  24, no new dependencies; dry run by default, `--apply`, `--production` required for `sk_live_`).
  Planning is `src/modules/identity/services/clerk-user-import.ts` (tested): creates Clerk users
  with the bcrypt digest, `external_id` = Supabase user id and the original join date, then links
  each through `sync_clerk_user`; re-runs skip created users and re-check their link. Skips
  unverified emails (Clerk would mark them verified — open question), addresses already in Clerk,
  duplicates and malformed rows; emails masked in output. Dry run and a create/delete probe ran
  against the dev Clerk instance only. Cutover runbook in the migration plan. Not run on
  production.
- 2026-09-30: migrations `202610160001`–`202610160003` pushed to Supabase Cloud (`vaultix`) after a
  pre-migration snapshot of every public/private function, public/storage policy and the profiles
  FK (restore script kept outside the repo; `supabase db dump` needs Docker, which did not start).
  Cloud check: all 7 PASS. Security advisor: only the intended `current_identity()` authenticated
  SECURITY DEFINER warning. Production has 7 accounts, all email-verified, so the unverified-import
  question does not arise. The live site keeps working on Supabase Auth through the transitional
  paths until the branch is deployed.
- 2026-09-30: the 7 production accounts were imported into Clerk production (`--apply
  --production`) and linked: 7 profiles, 7 distinct Clerk ids, 7 verified; a re-run plans nothing.
  The export file was deleted. Remaining: Clerk webhook + `CLERK_WEBHOOK_SIGNING_SECRET` and
  `SUPABASE_SERVICE_ROLE_KEY` in Vercel Production, merge and deploy, smoke test, then slice 6.
- 2026-09-30 production smoke test found two sign-in bugs (fixed on `claude/clerk-signin-hang`):
  a password sign-in from a new device stayed on "Signing in…" because an exception from the
  device-trust step (`supportedSecondFactors` null) was not caught; and Clerk's nested API error
  (`errors[0].code`) was not unwrapped, so "Couldn't find your account." leaked account existence.
  Every Clerk call in the sign-in, sign-up and recovery forms is now guarded, device trust always
  asks for the email code, and `toClerkError` unwraps nested refusals. Google sign-in failed first
  on swapped Client ID/secret in Clerk production (corrected by the user; the old secret was
  exposed in the session and is being replaced), and Clerk production paths still point to the
  Account Portal (set sign-in/sign-up to the application domain in the dashboard).

## 2026-09-29 tumbleweed animation and share poster fit (uncommitted, same working tree)

Request (user, 2026-09-29): implement `design_handoff_vaultix_tumbleweed_share` "for animation";
then (2026-09-30) "just complete implement all", so section 2 (share poster fit) too.

- `src/components/motion/tumbleweed.tsx`, ported from the handoff reference with its values
  unchanged: three nested layers (roll, hop with a squash on landing, spin), a random sprite,
  size, direction, speed, hop and spin per pass, one pass at a time, removed when the outer roll
  ends. It is portalled to the body and rendered once in `src/app/layout.tsx` inside
  `GunshotProvider`. Styles are in the motion section of `globals.css`, and `display: none` is
  added to its reduced-motion safety net.
- `public/brand/tumbleweed-{1,2,3}.webp`: the handoff PNGs (1254 px) scaled to 250 px, twice
  the largest on-screen size, with nearest-neighbour as the handoff asks, WebP q90 with lossless
  alpha, 15–34 KB each. They are fetched only when a pass rolls.
- Adapted, not changed: `noUncheckedIndexedAccess` on the sprite pick, a typed style object, and
  a pass already rolling disappears at once if reduced motion is switched on.
- Tests: `tumbleweed.test.tsx`, 8 tests (nothing before 15 s; a pass by 40 s; removed on the
  outer `animationend` only; the next pass after 50 s; hidden tab skipped but rescheduled; range
  ends; reduced motion; `enabled={false}`). jsdom lacks `AnimationEvent`, so the file defines one
  before React DOM loads; without it React listens for `webkitAnimationEnd` and the test passes
  vacuously.
- Verified: full unit suite (184 files, 1478 tests), typecheck and lint clean for project
  sources. In Chrome on `pnpm dev`: a pass appeared after about 27 s at z 96, pixelated, above the
  page, and was removed when it finished. `pnpm build` compiles, but its type check fails only
  on the untracked handoff's own `reference/tumbleweed.tsx`, which `tsconfig` picks up. Move or
  exclude the handoff folder before building.
- Share poster fit: `src/components/motion/use-share-fit.ts` and the fit rules after the
  existing share-poster rules in `globals.css`. `share-poster.tsx` gains the two scale wrappers
  and refs; the share logic, focus, Escape and copy are unchanged. The poster is laid out at a
  fixed 420 px and scaled 0.36–1 on a wrapper, since the sheet animates its own transform.
- Three departures from the reference, each because it broke the handoff's own acceptance or
  arithmetic: (1) a short landscape viewport goes side by side when stacking would need a scale
  under 0.36. At 667×375 the handoff's 760 px rule stacked the dialog, and it scrolled 50 px even
  at the floor. (2) The caption's `flex: 0 1 400px` became a 400 px height basis when stacked, so
  it is `0 0 auto` there. (3) The 18 px gap moved from the tight class to the stacked class. The
  tight class also cut the side-by-side gap to 18 px while the hook budgets 44 px; the README says
  44 px side by side and 18 px stacked. No wrapping in either layout: side by side, the width
  budget is exact to the pixel.
- Verified in Chrome on `pnpm dev`, through a temporary page (since deleted) that opened the
  dialog with a sample Wanted, the shell hidden: `scrollHeight <= innerHeight` at 360×640 (stacked,
  0.77), 390×844 (stacked, 0.85), 667×375 (side, 0.455), 768×1024 (stacked, 1), 1024×768,
  1280×720 and 1440×900 (side, 1). The handoff expects 0.4–0.5 at 360×640, but the sample
  poster, one title line, is only 485 px tall, so it needs less shrinking. Only the finished
  (transparent) dust puffs reach past the sides, inside the dialog's `overflow-x: hidden`.
- Tests: `use-share-fit.test.ts`, 19 tests (the handoff's three layouts plus 768×1024, the scale
  inside 0.36–1 at every acceptance size and two extremes, the stacked and side scale arithmetic,
  the landscape fallback, an unmeasured poster, and re-measuring on resize and rotation).
- Not added: the Playwright check that the share dialog does not scroll on the `mobile` project.
  The dialog is on `/wanted/[id]`, which needs an email-verified session and a published Wanted.
  CI cannot seed either, and this checkout points at the hosted Supabase project, where signing
  up would send real email. Add it with the gated specs once a local stack has a seeded Wanted.
- Seen, not touched: on the other session's in-progress mobile shell, `.shell-compact` and
  `.mobile-tab-bar` reach 473 px at a 360 px viewport, so mobile Chrome widens the layout viewport.
- Open question: WCAG 2.2.2 (Pause, Stop, Hide, Level A) covers moving content that starts on
  its own and lasts over 5 s. The tumbleweed respects reduced motion but has no on-page control.
  Recommendation: let the Gunshot toggle (or a general Motion toggle) also turn it off.

## 2026-09-30 — Mobile and tablet shell (design_handoff_vaultix_mobile)

- Lane: Claude Code, frontend only; `globals.css` and `context/**` shared-by-review for this slice.
  No contract, money, entitlement or backend change.
- Breakpoints: mobile below 720 px (`44.9375rem`), tablet 720–1199 px, desktop from 1200 px
  (`75rem`), unchanged. The same queries live in `src/features/presentation/viewport.ts` for the
  script-only behaviours. The old stacked-rail rules (60rem, 30rem) are gone.
- New: `shell-menu.tsx` (menu state, header hide-on-scroll, Menu toggle, panel with focus held
  between toggle and panel, Esc returns focus, closes on navigation, backdrop tap and widening),
  `shell-back-button.tsx` (Navigation API `canGoBack`, else screens seen; no in-app history goes
  home), `mobile-tab-bar.tsx`, `page-swipe.tsx` with the pure rules in
  `features/presentation/page-swipe.ts`. `AppShell` gains `compactAccount` and `menuAccount`
  slots (`CompactAccount`, `MenuAccount` in `account-menu.tsx`) so it still renders without a
  session. `GunshotProvider` exposes `go(href, point)` for swipes and `useOptionalGunshot()`.
- Departures from the handoff, each because the design predates or cannot hold it:
  (1) Music: `ThemeMusic` is split into `ThemeMusicProvider` (the one `<audio>`) and
  `ThemeMusicToggle`; the compact menu carries a Music row, because the rail toggle is hidden below
  1200 px and WCAG 1.4.2 needs a way to stop it. (2) Hunt is `/claims`, not `/hunt`. (3) Signed in
  below 448 px the row needs ~445 px, so the wordmark shows its logo tile only (word kept for
  assistive technology); the prototype overflows the same way. (4) The Inbox link's name is
  "Inbox, N unread", not "Notifications, N unread", to keep the visible label in the name
  (WCAG 2.5.3). (5) The Board filter toggle look applies to the whole disclosure range (below
  896 px), not only below 720 px, so one component has one look; filters now start collapsed even
  when some are applied, as the handoff asks; the summary still states the count. (6) The Hunters
  "Verified students…" line is trimmed on both the Board Hunters view and the Hunters wall.
- The Post Wanted intro trimmed on phones includes "A Sheriff reviews every claim…"; the form keeps
  its own policy and money notes. Revisit if the designer wants that sentence kept.
- Verified with headless Chromium on `pnpm dev` (guest session) at 360, 390, 768, 1024 and
  1280 px across `/`, `/board`, `/map`, `/claims`, `/archive`, `/wanted/new`, `/sign-in`:
  `scrollWidth` equals the viewport everywhere, no new header or tab-bar target under 44 px, footer
  hidden only below 720 px, Esc on the open menu returns focus to the toggle. The signed-in row was
  measured with injected Inbox and avatar controls: fits at 360 and 390; 320 (below the 360 floor)
  still overflows by 25 px. The other session's note of 473 px at 360 matched the desktop Post
  button leaking into the compact row, a specificity bug fixed here.
- Tests: `app-shell.test.tsx` scoped to the rail landmark (jsdom applies no media queries, so all
  layouts are in the document) plus compact header, menu (open, Esc, focus ring, backdrop,
  navigation, never tucked while open) and tab bar; Featured rail and hint in `page.test.tsx`;
  collapsed filters in `board/page.test.tsx`; `page-swipe.test.ts`. Full suite 1524 passed;
  typecheck clean for project sources. `pnpm build` compiles; its type check fails only on the
  untracked tumbleweed handoff's `reference/tumbleweed.tsx`, as recorded above.
- Not verified: real touch swipes and the hint timer on a device, and the signed-in menu with a
  real session. Not added: Playwright specs under `tests/e2e/ui/` for these.

## 2026-09-30 — Guest account actions standardised (`claude/mobile-tablet-layout`)

- One vocabulary for getting in: **Sign in** and **Create account** (plus Sign out). "Sign up" on
  the desktop rail and "Create an account" on the sign-up heading, the sign-in form and the email
  verification screen are gone; the sign-up form now reads "Already have an account? Sign in".
  `src/app/api/auth/resend-verification/route.ts` still says "Sign up again." — Codex lane, left
  for them.
- One look: Sign in is the ghost-on-timber `.button`, Create account the brass one, on the desktop
  rail, the tablet row and the compact menu (`SignInLink` / `CreateAccountLink` in
  `account-menu.tsx`). The rail and menu previously used three different treatments.
- Where each appears: the rail shows both from 1312 px; from 1200 to 1311 px it keeps Sign in only,
  as the tablet row does, because the guest rail could not hold one row there. The menu shows both
  at every compact width; a phone row shows neither.
- The rail's Notifications bell is hidden for guests (CSS `:has(.account-menu--guest)`); for a guest
  it was only a second link to sign-in, and the compact row already shows Inbox to members only.
- Fixed on the way: the guest rail wrapped "Post a Wanted" onto a second row at every desktop
  width; now one row from 1200 px up (checked every 5 px from 1200 to 1330 px, plus 1440 and 1600).
- Verified: unit suite 1577 passed, typecheck, lint and `pnpm build` clean. Playwright
  `auth-guards`, `auth-forms`, `email-verification` and `hunters` specs: 60 passed, 14 failed, and
  the same 14 fail on an unmodified build of HEAD (the `/verify-email` specs predate the Clerk
  screen, the 360 px shell test expects a header Sign in that the phone row moved into the menu,
  and the recovery spec times out) — not caused by this change, still to be updated.

## 2026-09-30 — Google sign-in hang fixed; Google photo as the default avatar (`claude/google-signin-and-avatar`)

- **Hang:** "Continue with Google" stayed on "Signing in… / Checking your details" in a browser that
  still held an unfinished Clerk sign-in (incognito worked). Clerk's `signIn.sso()` (clerk-js v6)
  only creates a Google attempt when no sign-in is open; otherwise it reuses the old one, which has
  no Google redirect, so it neither leaves nor errors, and no request is sent. The form now calls
  `signIn.reset()` first and starts Google from the fresh sign-in on the next render (the `signIn`
  in hand still points at the old attempt). Both Google buttons (sign-in and sign-up) also stop
  waiting after 10 s (`leavesPageWithin`) and say Google did not start.
- **Google photo (decided with the user):** a member who signs in with Google starts with their
  Google photo; an email-only member keeps the drawn avatars. Order shown: uploaded photo, chosen
  drawn avatar, Google photo, default drawing. Choosing a photo or drawn avatar replaces the Google
  photo; "Use my Google photo" on `/profile` brings it back. Only the link is kept (Clerk's copy,
  from a verified Google external account in the Clerk webhook or the member's session sync),
  never the image; it is visible to other members like any avatar.
- Migration `202610170001_google_profile_photo.sql`: `private.user_identities.clerk_avatar_url`
  (raw), `profiles.external_avatar_url` + `external_avatar_enabled`, `sync_clerk_avatar`
  (service role, stale-delivery safe), `use_own_external_avatar` (own account),
  `console_reset_member_avatar` now also turns the Google photo off, and both Hunters wall RPCs
  return `externalAvatarUrl`. Links are limited to `https://img.clerk.com/` and
  `https://lh3.googleusercontent.com/` in the database and in `resolveAvatarUrl`.
  `database.types.ts` was hand-edited for the two profile columns (no local Docker to regenerate).
- The account menu no longer falls back to Clerk's `imageUrl` (a generated placeholder for
  email-only members); a Google member still on the default drawing gets one Clerk sync per
  browser session so accounts synced earlier pick up their photo.
- **Deploy order:** the migration must be applied to Supabase Cloud **before** this code ships —
  profile, Wanted and account reads select `external_avatar_url`. Not yet applied.
- Verified: unit suite 1597 passed, typecheck, lint and `pnpm build` clean. Not verified: the
  migration against Postgres (no local Docker) and a real Google round trip with a leftover
  sign-in.

## 2026-09-30 — Faster pages: region, fewer round trips, cached lists (`claude/perf-round-trips`)

- **Cause found:** Vercel functions ran in `iad1` (US East) while Supabase is in `ap-southeast-1`
  (Singapore), so every query crossed the Pacific (~0.2 s), and a signed-in page made 5–7 in a
  row. The user moved the Function Region to `sin1` in Vercel project settings (Hobby: one
  region) and redeployed; `X-Vercel-Id` now reads `sin1::sin1`. Anonymous time to first byte went
  from 0.4–1.2 s to 0.2–0.4 s.
- **Gunshot (C):** the route is requested at the click instead of 390 ms later; a thin
  `.route-pending` bar (role status, "Loading the page…") stays until the new page renders, so a
  slow page no longer looks like an ignored click. Overlay timing is unchanged (1050 ms).
- **Account read (D):** `current_account()` (migration `202610170002`) returns identity, profile,
  membership + institution name, restriction, latest verification request and console access in
  one call. `readOwnIdentity` uses it and keeps the result for the request
  (`currentAccountSnapshot`); `readAccount` builds from it instead of seven more queries. Falls
  back to `current_identity` + the old queries until the migration is applied. A member with
  several membership rows is read as their verified one (the old read refused such an account).
- **Map (E):** `campus_region_totals(target_institution_id)` sums open/reviewing Wanteds and their
  contributions per campus in the database, same sums as before; service role only. Falls back to
  the old table reads until applied.
- **Caching (F):** active institutions cached 5 min and marketplace taxonomy 60 s per university
  (`unstable_cache`, service client, returning only the active rows the browse policies give any
  email-verified member; `TaxonomyService` still refuses others first). New taxonomy entries can
  take up to a minute to appear.
- Not done yet (user's call): `loading.tsx` for `/map`, `/hunt`, `/archive`, `/`, `/u/[id]`,
  `/wanted/[id]` (item B); removing the transitional Supabase session refresh from the proxy.
- Verified: typecheck, lint, `pnpm build`; full suite run hit 5 s timeouts on 10 unrelated files
  under machine load, all 10 pass when re-run. Migration not run against Postgres (no Docker).

## 2026-09-30 — Loading indicator and page skeletons (`claude/perf-round-trips`)

- `LoadingIndicator` (`src/components/loading/`): a small pill at the bottom of the screen (above
  the phone tab bar) with a turning cylinder and "Loading …" text, one `role="status"`. It fades
  in only after 150 ms (CSS delay), so fast pages never flash it, and turns for as long as the page
  loads; reduced motion shows it still. The cylinder face is provisional: the pixel-art revolver
  (still under review, previews in the untracked `output/`) replaces `.loading-indicator__cylinder`.
- The gunshot transition shows it while a navigation is pending (replacing the thin bar); a page's
  `loading.tsx` shows it with the skeleton once that renders.
- Skeleton `loading.tsx` (`PageSkeleton`, `SkeletonPanel`, `SkeletonBlock`): new for `/` (and any
  route without its own), `/map`, `/archive`, `/notifications`, `/u/[publicId]`, `/wanted/[id]`;
  `/claims`, `/profile`, `/profile/institution-verification`, `/wanted/new` and `/console` moved
  from a status box to skeletons; `/board` keeps its poster skeleton plus the indicator. Fixed
  headings stay real; placeholders are `aria-hidden`; no focus moves.
- Still to decide: removing the gunshot overlay and its toggle, and the revolver art itself.
- Verified: typecheck, lint, 751 UI tests; indicator checked at desktop and 375 px in the dev
  server. Locally `/map` and `/archive` show their "unavailable" state because `.env.local` has no
  `SUPABASE_SERVICE_ROLE_KEY` (unrelated to this change).
- Follow-up (same day, user decisions): the gunshot overlay stays but is **off by default** (a saved
  "on" still wins). The loader uses Claude's original pixel-art revolver
  (`public/brand/revolver-reload.png`, 33 frames of 72 x 48, shown x2, 2.39 s loop, drawn in
  `scripts/revolver-art/preview.html`, re-export with `node scripts/revolver-art/export.mjs`). It is
  now centred on a dim, lightly blurred backdrop (`--bg-loading-scrim`, clicks pass through) with
  no card and no visible text; the words remain for screen readers.
