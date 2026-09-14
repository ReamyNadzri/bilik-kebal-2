# Progress Tracker

Update this file after every meaningful implementation or specification change.

## Current Phase

- Phase 2 Identity backend complete on `codex/backend` (`6433239`), including all six read-contract
  operations. The provisional Identity frontend is complete on `codex/provisional-ui` (`b17490f`).
  Integration is under way on `codex/integration-identity`; `codex/provisional-ui` is pinned at
  `b17490f` by the user.
- The user approved a marketplace-first frontend pivot on `codex/integration-identity`. VAULTIX must
  read as an academic resource bounty marketplace before it reads as an authentication application,
  so `/`, `/board`, `/wanted/[id]` and `/claims` are built ahead of their Phase 3 backend behind one
  replaceable frontend fixture seam. The Identity integration above is unaffected and stays connected
  to its real operations.

## Current Goal

- Connect each provisional screen to its typed identity operation, removing that screen's
  `FixtureNotice` in the same slice. Phase 3 begins only after the identity journeys are accepted.

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
- Selected Resend for custom transactional SMTP.
- Selected Supabase Queues and Cron for durable background work and scheduled lifecycle tasks.
- Assigned detailed visual design to a separate designer; recorded only product direction and accessibility constraints.
- Populated all six context files and completed the Phase 1 application foundation.
- Renamed the product identity from WANTED to VAULTIX while retaining `Wanted` as a marketplace feature term.
- Approved a six-phase full-MVP direction: Foundation; Identity and institution trust; Wanted marketplace and money; Claims and moderation; Fulfilment and operations; Hardening and controlled launch.
- Approved a `pnpm`-managed single Next.js App Router modular monolith with Supabase as the source of truth and provider integrations behind typed adapters.
- Wrote `docs/superpowers/specs/2026-09-13-vaultix-mvp-design.md` as the phased MVP design handoff.
- Assigned the complete provisional MVP frontend to Claude Code and backend/infrastructure implementation to Codex, with separate worktrees and Codex-owned shared contracts.
- **Phase 1 Task 1** — application baseline on `codex/backend` (`aa0ecda`): Next.js 16.3.5 App Router, React 19.3, TypeScript 6 strict, Tailwind 4.3, Vitest 5 + RTL, Playwright, Node 24 / pnpm 11.3.0 pins, Prettier and the `format` / `format:check` scripts.
- **Phase 1 Task 2** — shared `OperationResult` contract with `success()` / `failure()` (`3da3016`).
- **Phase 1 Task 3** — Zod-validated server and public environment boundaries (`16e1fa5`); `PAYMENT_MODE` defaults to `disabled`, `PUBLIC_UPLOADS_ENABLED` to `false`, and the public parser strips unknown keys so no server secret can reach the browser bundle.
- **Phase 1 Task 4** — provisional accessible app shell (`7da61f0`): `AppShell` (skip link, `nav` labelled Primary, `main#main-content`), `UiStatus` across six states, presentation-only navigation module, and the provisional token layer with all thirteen required roles plus spacing, type, shape, elevation, focus and motion scales. All 23 colour pairings contrast-verified; recorded in `docs/superpowers/specs/2026-09-13-vaultix-provisional-ui.md`.
- **Phase 1 Task 5** — CI workflow, contributor commands in `README.md`, and this tracker entry.
- **Phase 2 backend** — identity trust states and access policy (`ee79078`), Supabase schema and RLS
  (`8f9ab7f`), then the identity operations (`175bc41`): Auth, email confirmation, domain fallback,
  manual evidence workflow, role-scoped review, account restriction, audit events, and private
  signed evidence uploads. The HTTP boundary is documented in
  `docs/integration/identity-http-contract.md`.
- **Phase 2 UI** — provisional Identity frontend on `codex/provisional-ui`: fixture marker and
  verification badges (`2797f47`), `/profile` verification status (`59c6cb3`), authentication forms
  (`d1f5d77`), `/profile/institution-verification` (`1f9d670`), role-aware navigation and the
  Sheriff Console landing (`102b7cb`), and `/verify-email` (`5633ed0`). Nine routes, 86 component
  tests and 29 Playwright UI tests.
- **Identity screen design specification** (`ae64567`) — state matrices for all ten required states
  across the four identity screens, responsive behaviour from 360 px, keyboard and focus flows,
  screen-reader and live-region rules, the institution-verification step flow, and the Sheriff queue
  and private evidence viewer, in
  `docs/superpowers/specs/2026-09-14-vaultix-identity-screen-design.md`.
- **Slice 1: `/profile` connected** (on `2a91d7f`) — the screen reads the real account through the
  Codex-published `loadAccountViewModel` and renders `AccountViewModel`. Its fixture and
  `FixtureNotice` are gone; the other three screens keep theirs. Account restriction is now a third
  trust axis in `VerificationStatus`, so a restricted but institution-verified account is no longer
  told to verify an institution it has already verified. Unauthenticated and identity-unavailable
  are separate explicit states, `/profile` is `force-dynamic` so user-specific data cannot enter a
  shared cache, and at most one `role="alert"` renders per update.
- **Identity read-contract gap analysis** — reviewed the published identity HTTP contract against
  the four screens still carrying `FixtureNotice` and found every one of them blocked on a missing
  read operation. Proposal written for Codex in
  `docs/superpowers/specs/2026-09-14-vaultix-identity-read-contract.md`. No frontend code was
  written, and no contract was forked.
- **Phase 2 read contract** (`6433239`) — the six Identity read-contract operations: account view,
  selectable institutions, scoped Sheriff queue, audited evidence read URL, verification resend, and
  explicit callback outcomes.
- **Slice 2: `/profile/institution-verification` connected** — the screen loads the real institution
  options and account state through `loadSelectableInstitutions` and `loadAccountViewModel`, runs the
  automatic domain check, and completes the evidence sequence: signed upload URL, direct `PUT` to
  storage, then the verification request. Its fixture and `FixtureNotice` are gone, leaving only
  `/console` and `/verify-email`. `EMAIL_VERIFIED_ONLY` and `APPROVED_INSTITUTION_DOMAINS` were
  deleted with the screen that used them.
- **Slice 3: `/verify-email` connected** — the four callback outcomes are the real ones Codex routes
  to, the address comes from the signed pending-verification cookie rather than a fixture, and
  "Resend the link" calls the resend operation with no browser-chosen recipient. An unrecognised
  `status` still falls back to waiting, never to success. Its `FixtureNotice` is gone, leaving only
  `/console`, and `PENDING_VERIFICATION_ADDRESS` was deleted with it.
- **Slice 4: `/console` connected** — the Sheriff Console loads the role-scoped pending queue through
  `loadVerificationReviewQueue`, opens evidence through the audited short-lived read URL, and records
  approve/reject through the review operation with a confirmation and its consequences. Its
  `FixtureNotice` is gone, so no screen carries one and `src/features/presentation/fixtures/` was
  deleted. The `FixtureNotice` component itself is kept: coordination plan section 5 still requires
  that marker for the screens later phases will add.

## In Progress

- Contract integration on `codex/integration-identity`. The whole identity read contract is now
  published (`57b11b9`, `6433239`) and merged here (`2a91d7f`, `06a1b01`). Slices 1 and 2 are
  complete, so `/profile` and `/profile/institution-verification` run on real operations.
- All four Phase 2 identity screens are connected to real operations. No screen is fixture-backed and
  no `FixtureNotice` remains in `src/app/`. Phase 2 integration is complete pending review.
- Marketplace-first frontend phase. The approved temporary visual direction is recorded in
  `docs/superpowers/specs/2026-09-14-vaultix-marketplace-visual-direction.md`: an organised academic
  bounty ledger, paper case files on a dark timber board, brass reserved for the money. Every value
  is provisional and the Final Visual Handoff Gate still applies.
- Four marketplace routes are built and fixture-backed: `/` (marketplace homepage), `/board`
  (searchable, filterable, URL-addressed Wanted Board), `/wanted/[id]` (Wanted detail) and `/claims`
  (Hunt and claim ledger). `/wanted/new` was added as a requirement explainer so the shell's one
  prominent action does not lead to a 404; it is deliberately not a creation form.
- The shell now carries two navigation landmarks — marketplace destinations and account utilities —
  plus the single `Post a Wanted` action. `main` became the parchment sheet, so the Phase 2 Identity
  screens inherit the theme without being edited.

## Next Up

1. Review the completed Phase 2 identity integration, then decide whether `codex/integration-identity`
   merges toward `main`.
3. Decide what every screen shows with no session and no configured Supabase, so the gate keeps
   passing in CI.
4. Write and review the Phase 3 Wanted/ledger plan after the identity journeys are accepted.
5. Incorporate the external visual design handoff into `ui-context.md` when it is available.
6. Resolve the remaining launch-gate decisions before enabling their affected public capabilities.

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
- Define how an account restriction is lifted, and what a restricted user may be told about it.
  Slice 1 states the restriction as a fact and offers no remedy, because inventing an appeal
  route or a contact address would promise something that does not exist. The restricted
  notice on `/profile` gains an action only once this is answered.
- Decide how a Sheriff or Owner role is seeded for local and CI end-to-end runs. The console's
  refused and unauthenticated paths are covered end to end, and every authorised path is covered by
  component tests, but no automated run exercises a real authorised queue because nothing grants a
  role assignment outside the database.
- Define the final legal metadata-retention periods after professional review.

## Backend Contracts the Marketplace Frontend Needs

Recorded for Codex. Every marketplace screen reads through one replaceable seam,
`src/features/marketplace/wanted-source.ts` and `hunt-source.ts`; nothing below it is imported by a
component, and no permission is decided there.

1. `listWanted(query)` — filtered, sorted, cursor-paginated Board read. Gross bounty in integer sen,
   backer count, lifecycle state, closing instant, taxonomy labels. No file data.
2. `readWanted(id)` — Wanted detail including the fee-rate snapshot taken at publication, the policy
   version, activity events and duplicate/similar suggestions.
3. `listHuntOpportunities()` — open Wanteds scoped to what the viewer may claim, carrying the
   eligibility reason when they may not.
4. `listMyClaims()` — the viewer's claims across the eight lifecycle states, exposing no other
   claimant beyond a competition count.
5. A viewer capability view model carrying the authoritative `canBrowseMetadata`, `canTransact` and
   `canSubmitClaim` decisions, so the frontend stops routing every protected action to verification
   by default.
6. A `next` parameter on `/sign-in`, so a protected action can return the reader to where they were.
   Until it exists, protected actions link plainly and say what they unlock.

Until these land, every marketplace screen keeps its `FixtureNotice`. Relative times are measured
against a fixed `FIXTURE_NOW`, which is deterministic and avoids a hydration mismatch; real closing
times must arrive with a server-rendered reference instant.

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

- The workspace is a Git repository on `main`, tracking `origin/main` on GitLab.
- The user authorised the assistant to choose safe non-critical technical defaults and only escalate critical product, money, legal, privacy, ownership, migration, or recurring-cost decisions.
- The user wants patch-by-patch delivery and expects setup/navigation guidance for Supabase, Vercel, Cloudflare, Resend, and ToyyibPay when implementation begins.
- The current approved storage choice is Supabase Storage. Cloudflare R2 is a future hybrid option, not a current dependency.
- `Live Limited` may use real ToyyibPay payments for controlled tester accounts, with RM1-RM50 contributions and no platform-wide daily cap.
- Public upload remains disabled until a production scanning worker is available.
- The user approved phased full-MVP development and separate Claude frontend/Codex backend ownership. Application coding begins after the relevant phase plan is written.
- **Never run two agents in one checkout.** During Phase 1 both agents were active in `.worktrees/codex-backend`; the Claude lane overwrote five of Codex's untracked config files, which were unrecoverable because nothing was committed yet. Codex regenerated them. Verify the worktree is idle immediately before writing, not once at session start, and commit early so work is recoverable.
- **The two-agents-in-one-checkout failure recurred.** During the marketplace-first phase a second
  agent was writing into `.worktrees/claude-ui` at the same time as this session. It committed this
  session's in-progress Board and detail files as `3ca1a6b` before they were finished, so the filter
  disclosure marker and the Playwright suite were left out of that commit, and it was concurrently
  editing `globals.css` and `fixtures.ts` — both files this session was also editing. Nothing was
  lost, but only because neither agent happened to write the same hunk at the same moment. The user
  stopped the second agent and this session verified a full minute of filesystem quiet before
  resuming. Check `git log` and file mtimes, not just `git status`, before assuming a worktree is
  yours alone.
- Codex completed Phase 1 Tasks 1-3 but hit a usage limit before running any `git commit`; the Claude lane finished the gate and committed all three on its behalf.
- `.gitattributes` pins `eol=lf`. This machine has `core.autocrlf=true`, which checked out CRLF while Prettier expects LF, so `pnpm format:check` failed locally while CI would have passed.
- `next dev` used to write `AGENTS.md` and an `@AGENTS.md` stub `CLAUDE.md` into whichever worktree it ran from; committing that stub would have overwritten the real project `CLAUDE.md`. `next.config.ts` now sets `agentRules: false`, which stops it at the source.
- The approved institution email domain list is still unresolved, so the frontend renders it from
  configuration and the fixture supplies none. `/profile/institution-verification` therefore says the
  list has not been published yet rather than naming a domain. Populate it only from reviewed
  configuration once that open question is closed.
- Playwright drives the dev server over `127.0.0.1` while Next serves `localhost`. `next.config.ts`
  sets `allowedDevOrigins` accordingly; without it Next blocks its own `/_next/*` dev resources and
  every Client Component silently fails to hydrate, which shows up as static tests passing while
  every interactive test fails.
- Next injects a `role="alert"` route announcer, so an unfiltered `getByRole("alert")` matches two
  elements in a Playwright strict-mode query.
- Local Supabase project `vaultix` runs on API `55421`, DB `55422`, Studio `55423`, Mailpit `55424`; tests use synthetic accounts and never send real email.
- Official institution email domains remain intentionally unseeded pending product approval; `example.test` was used only as a temporary local smoke fixture and is not part of migrations.
- Supabase rate-limits outgoing mail per project, so end-to-end specs that register accounts compete
  for one budget. Creating an account per test made `tests/e2e/identity/auth-flow.spec.ts` fail
  intermittently when the suites ran in parallel; the UI specs now create one confirmed account per
  gated group and sign in again for each test, which costs no email.
- Running the Supabase-gated e2e specs locally needs both the stack up and a gitignored `.env.local`
  holding `NEXT_PUBLIC_SUPABASE_URL`, the publishable key from `supabase status`, and
  `IDENTITY_PENDING_COOKIE_SECRET`. Without it the dev server has no Supabase configuration and every
  identity screen renders its unavailable state instead.
- `tests/e2e/identity/auth-flow.spec.ts` is intermittently red at the line expecting the first resend
  to return 429. Supabase enforces a one-second minimum between messages, and that test puts a
  sign-in round trip between sign-up and the resend, so whether the call lands inside the window is
  timing rather than behaviour. It fails in isolation as well as in a full run, and the file has not
  been touched since `6433239`. Codex owns the fix; asserting the refusal needs two calls in quick
  succession rather than one call assumed to be quick. The UI specs deliberately assert only the
  resend success path for the same reason.
- The published identity HTTP contract is **write-only**: all nine operations are `POST` mutations,
  and the application's only `GET` is the Supabase OTP callback. A frontend screen cannot be
  retired from its fixture by integration work alone if it renders state it cannot read. Check for
  the read side of a contract before planning integration slices.
- `ProfileReader` has no implementation because `ProfileRecord`'s four fields span four sources:
  `public.profiles`, the session's `auth.users.email_confirmed_at`, `institution_memberships`, and
  `account_restrictions`. It needs a composing reader in the identity module, not a table read.
- `requestManualVerification` needs an `institutionId` UUID from the browser, and no operation
  returns one — `verify-domain` supplies it only on success, which cannot happen while the domain
  allowlist is empty. The evidence path is unreachable until an institution read exists. The UI must
  not hardcode a UUID to work around this.
