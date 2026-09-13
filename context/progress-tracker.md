# Progress Tracker

Update this file after every meaningful implementation or specification change.

## Current Phase

- Phase 2 Identity backend complete on `codex/backend` (`175bc41`). The provisional Identity
  frontend is complete on `codex/provisional-ui` (`b17490f`). Integration is under way on
  `codex/integration-identity`; `codex/provisional-ui` is pinned at `b17490f` by the user.

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

## In Progress

- Contract integration on `codex/integration-identity`: consume
  `docs/integration/identity-http-contract.md` and replace each matching `FixtureNotice` flow with
  the real route, one screen at a time.

## Next Up

1. Connect the authentication forms, then `/profile` and `/console`, then institution verification,
   then `/verify-email` — each its own verifiable slice.
2. Decide what every screen shows with no session and no configured Supabase, so the gate keeps
   passing in CI.
3. Write and review the Phase 3 Wanted/ledger plan after the identity journeys are accepted.
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

- The workspace is a Git repository on `main`, tracking `origin/main` on GitLab.
- The user authorised the assistant to choose safe non-critical technical defaults and only escalate critical product, money, legal, privacy, ownership, migration, or recurring-cost decisions.
- The user wants patch-by-patch delivery and expects setup/navigation guidance for Supabase, Vercel, Cloudflare, Resend, and ToyyibPay when implementation begins.
- The current approved storage choice is Supabase Storage. Cloudflare R2 is a future hybrid option, not a current dependency.
- `Live Limited` may use real ToyyibPay payments for controlled tester accounts, with RM1-RM50 contributions and no platform-wide daily cap.
- Public upload remains disabled until a production scanning worker is available.
- The user approved phased full-MVP development and separate Claude frontend/Codex backend ownership. Application coding begins after the relevant phase plan is written.
- **Never run two agents in one checkout.** During Phase 1 both agents were active in `.worktrees/codex-backend`; the Claude lane overwrote five of Codex's untracked config files, which were unrecoverable because nothing was committed yet. Codex regenerated them. Verify the worktree is idle immediately before writing, not once at session start, and commit early so work is recoverable.
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
