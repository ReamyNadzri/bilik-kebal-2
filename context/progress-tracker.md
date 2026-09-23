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

## Next Up

1. Connect durable claim job dispatch to the scanner worker host after its provider is selected.
2. Add claim upload completion dispatch and entitlement creation after a recorded approval.
3. Add Sheriff review persistence with reason codes, recorded actor, and one-winner constraints.
4. Verify the existing Supabase Cloud connection and applied migration history, then validate pending migrations and RLS tests in a designated cloud test environment.
5. Resolve the remaining launch-gate decisions before enabling public uploads or live payment.

## Open Questions

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
