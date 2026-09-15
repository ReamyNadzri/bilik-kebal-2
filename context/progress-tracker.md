# Progress Tracker

Update this file after every meaningful implementation or specification change.

## Current Phase

- Phase 2 Identity and Phase 3A Wanted creation are integrated. Phase 3B money and ledger is
  implemented on `codex/backend`; both implementation lanes are being merged into `main`.
- The user approved a marketplace-first frontend pivot on `codex/integration-identity`. VAULTIX must
  read as an academic resource bounty marketplace before it reads as an authentication application,
  so `/`, `/board`, `/wanted/[id]` and `/claims` are built ahead of their Phase 3 backend behind one
  replaceable frontend fixture seam. The Identity integration above is unaffected and stays connected
  to its real operations.

## Current Goal

- Verify the combined frontend/backend tree, publish `main`, then implement the public Board and
  Wanted-detail read models before beginning Phase 4 Claims.

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

- **Phase 3C Wanted-creation integration** -- `/wanted/new` connected to the Phase 3A contract:
  the institution-scoped taxonomy read, draft create and update, the server duplicate check, and the
  publication request carrying the opaque one-use token. Every documented auth, trust, validation,
  duplicate-token and payment code is handled, form input and focus survive every failure, and
  `PAYMENT_DISABLED` / `PAYMENT_UNAVAILABLE` are honest refusals that never show payment success or
  an open Wanted. `taxonomy-source.ts` and `duplicate-suggestions.ts` were deleted with the
  `FixtureNotice` on that route. `Sen` is now re-exported from `src/contracts/marketplace`, so
  presentation and contract money are one type.
- **Phase 3A backend** -- marketplace contracts, private RLS-protected Wanted storage and
  institution-scoped taxonomy reads; atomic private draft create/update with server-derived
  Commissioner identity, active taxonomy validation and owner-only editable-draft enforcement;
  public-only duplicate ranking, HMAC-authenticated 15-minute one-use duplicate-check tokens, and a
  private publication snapshot transaction for the future money module. The HTTP boundary is
  documented in `docs/integration/marketplace-http-contract.md`. Phase 3A never confirms payment and
  never opens a Wanted.
- **Phase 3B backend** (`7434a77`) -- contribution intents, ToyyibPay bill creation and official
  form callback verification, service-role event recording, one-use token consumption, immutable
  balanced ledger entries, first-contribution Wanted activation, outbox events and bounded
  reconciliation reads. Reordered callbacks are retained and safely resolved on retry; no missing
  provider secret is replaced with a fabricated verification key.

## In Progress

- Marketplace-first frontend phase continues. The approved temporary visual direction is recorded in
  `docs/superpowers/specs/2026-09-14-vaultix-marketplace-visual-direction.md`: an organised academic
  bounty ledger, paper case files on a dark timber board, brass reserved for the money. Every value
  is provisional and the Final Visual Handoff Gate still applies.
- All four Phase 2 identity screens are connected to real operations, so no identity screen is
  fixture-backed. Phase 2 integration is complete pending review.
- Four marketplace routes remain fixture-backed: `/` (marketplace homepage), `/board` (searchable,
  filterable, URL-addressed Wanted Board), `/wanted/[id]` (Wanted detail) and `/claims` (Hunt and
  claim ledger). Each keeps its `FixtureNotice` until its own read contract exists.
- Phase 3C is complete for `/wanted/new`: the workspace consumes the real taxonomy, draft,
  duplicate-check and publication operations, and both payment refusals are honest. The other three
  marketplace routes still wait on their read contracts.
- Phase 3B's backend money boundary is complete; the frontend payment redirect/waiting slice still
  needs to consume `docs/integration/money-http-contract.md`.

## Next Up

1. Connect the payment redirect and waiting UI to `docs/integration/money-http-contract.md`.
2. Implement public Board and detail read models now that confirmed contributions can create real open
   Wanted records, and decide what every screen shows with no session and no configured Supabase so
   the gate keeps passing in CI.
3. Keep `/claims` fixture-backed until Phase 4 Claims and moderation.
4. Incorporate the external visual design handoff into `ui-context.md` when it is available.
5. Resolve the remaining launch-gate decisions before enabling their affected public capabilities.

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

## Wanted Creation Workspace — Connected to Phase 3A

`/wanted/new` runs on the real backend. The identity read is `loadAccountViewModel`, so every
eligibility state is real — signed out, identity unavailable, email unverified, restricted,
institution unverified, institution pending, eligible. The option lists come from the
institution-scoped taxonomy operation, and the workspace persists through the published Phase 3A
routes (`docs/integration/marketplace-http-contract.md`):

- **Review request** saves the draft — `POST /api/marketplace/wanted/drafts` the first time, then
  `PUT /api/marketplace/wanted/drafts/:id` — and runs
  `POST /api/marketplace/wanted/duplicate-suggestions` on the saved draft.
- **Continue to payment** carries the opaque one-use token that check issued to
  `POST /api/marketplace/wanted/drafts/:id/publication`, with the contribution in integer sen.

No fixture remains on `/wanted/new`, and its `FixtureNotice` is gone.
`src/features/marketplace/taxonomy-source.ts` and `duplicate-suggestions.ts` were deleted with it.

What the screen may never claim, and is tested for: it never reports a payment, a publication or an
open Wanted. `PAYMENT_DISABLED` and `PAYMENT_UNAVAILABLE` are honest refusals that state the draft
is saved, no payment was started, nothing was charged and no Wanted was opened. An `awaiting_payment`
success — which Phase 3A cannot produce — is presented as waiting for payment, never as a live
request.

Known gaps recorded rather than worked around:

- **The eligible form still cannot be browser-tested end to end.** It needs an institution-verified,
  unrestricted session, and institution membership cannot be granted outside the database or seeded
  for CI. The Playwright suite therefore drives the workspace through the development-only harness at
  `/wanted/new/preview`, and exercises the real `/wanted/new` for its refusal path. The harness runs
  the workspace in `preview` mode: it validates and previews only, saves nothing, asks the server for
  nothing, issues no token and offers no control that leads to payment, and it says so on the review
  sheet. Its option lists are the only fixture left, in
  `src/features/marketplace/preview-taxonomy.ts`, and the route keeps a `FixtureNotice` naming exactly
  them. The harness renders the not-found page in a production build — verified against a real
  `next start` server, where every form control is absent — though Next serves that body with a 200
  rather than a 404, so the guarantee is the absent content, not the status line. Seeding a verified
  test identity is a backend prerequisite before this harness and `preview-taxonomy.ts` can be
  deleted together.
- **The 10% platform fee shown on the review step is the product default**, not a snapshot. The
  authoritative rate is snapshotted by the backend when a request is published.
- **Duplicate suggestions are empty in practice** until Phase 3B, because nothing can reach `open`
  without a verified contribution. The non-empty path is covered by component tests against the
  contract shape.

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
7. `ListTaxonomyResult` from `GET /api/marketplace/taxonomy`, carrying the campus, faculty,
   programme, course, session, resource-type, language and tag vocabularies with the hierarchy the
   database enforces, so the creation form can stop shipping its own options.
8. `CreateWantedDraftInput` / `UpdateWantedDraftInput`, so the workspace can persist a draft instead
   of holding it in component state.
9. `SuggestWantedDuplicatesInput` and its server-issued token, so the review step performs the real
   duplicate check rather than a frontend approximation.
10. `PrepareWantedPublicationInput`, so the review step can end in a real action. While payment mode
    is disabled it returns `PAYMENT_UNAVAILABLE`, which the screen should render as the honest
    refusal it already describes.
11. A seeded institution-verified, unrestricted test identity, so the eligible creation flow can be
    covered by browser tests and `/wanted/new/preview` can be deleted.

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
  returns one -- `verify-domain` supplies it only on success, which cannot happen while the domain
  allowlist is empty. The evidence path is unreachable until an institution read exists. The UI must
  not hardcode a UUID to work around this.
- Production marketplace taxonomy remains intentionally empty until an authoritative UiTM source and maintainer are approved.
- Local development has the verified `hunter.demo@vaultix.test` account; migrations and CI do not depend on this machine-only identity.
- ToyyibPay callback verification, fees, refund behaviour and settlement semantics remain unresolved launch gates. Payment defaults to disabled and Phase 3A has no success adapter.
- Phase 3A implementation commits: `d622bd5`, `7501359`, `f7ead1e`, `b1ebd02`, `0fcf925`, `43ef920`, documentation `4d52562`, and token-boundary hardening `fe6b534`.
- Playwright's `webServer` has `reuseExistingServer` on outside CI, so any other project already
  holding port 3000 silently becomes the system under test and every assertion runs against the
  wrong application. During the Phase 3C run an unrelated local project held 3000, and the whole
  creation suite failed against its 404 page. Run the suite with `PORT` and `PLAYWRIGHT_BASE_URL`
  pointing at a free port when that happens.
- `tests/e2e/identity/auth-flow.spec.ts` follows a Supabase confirmation link built from
  `NEXT_PUBLIC_APP_URL`, so that opt-in spec only passes with the application on the port that
  variable names. It is Codex-owned and self-skips unless `VAULTIX_SUPABASE_E2E=1` is set.
- `ErrorSummary` now accepts an entry with no `fieldId` and lists it without a link, because the
  marketplace `VALIDATION_ERROR` can carry a `taxonomy` failure that belongs to the campus, faculty,
  programme, course and session judged together rather than to any one control. Dropping it would
  refuse a reader with no explanation; attaching it to one select would blame the wrong field.
