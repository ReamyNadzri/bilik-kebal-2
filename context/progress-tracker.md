# Progress Tracker

Update this file after every meaningful implementation or specification change.

## Current Phase

- Phase 3B money/ledger, public Wanted reads, and the Phase 4 claims boundary are integrated on
  `main`. The Gemini frontier interface and Codex backend are now in one reviewable tree.
- Phase 4 Claims and moderation has started with quarantine RLS, upload-session authorization,
  scanner contracts, and human review policy.

## Current Goal

- Complete the Phase 4 server delivery route and persistence slices on the integrated tree while
  keeping public uploads and live payment disabled.

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

## In Progress

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

## Next Up

1. Connect durable claim job dispatch to the scanner worker host after its provider is selected.
2. Add the review HTTP contract and Sheriff queue read model for the provisional interface.
3. Add Sheriff review persistence with reason codes, recorded actor, and one-winner constraints.
4. Hand `docs/integration/money-http-contract.md` to Gemini for the payment redirect/waiting UI slice.
5. Keep `/claims` fixture-backed until the claim HTTP contract and private upload flow are integrated.
6. Resolve the remaining launch-gate decisions before enabling public uploads or live payment.

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
- The user approved phased full-MVP development and separate frontend/backend ownership. Gemini
  replaces Claude Code in the frontend lane; Codex remains in the backend lane. Application coding
  begins after the relevant phase plan is written.
- Local Supabase project `vaultix` runs on API `55421`, DB `55422`, Studio `55423`, Mailpit `55424`; tests use synthetic accounts and never send real email.
- Official institution email domains remain intentionally unseeded pending product approval; `example.test` was used only as a temporary local smoke fixture and is not part of migrations.
- Production marketplace taxonomy remains intentionally empty until an authoritative UiTM source and maintainer are approved.
- Local development has the verified `hunter.demo@vaultix.test` account; migrations and CI do not depend on this machine-only identity.
- The earlier provisional Wanted workspace at `60e4566` was fixture-backed. The UI branch later
  connected marketplace reads at `804c934`; its current uncommitted visual work needs a Gemini
  checkpoint before any backend integration merge.
- ToyyibPay callback verification, fees, refund behaviour and settlement semantics remain unresolved launch gates. Payment defaults to disabled and Phase 3A has no success adapter.
- Phase 3B migrations `202609150004` through `202609150009` are applied locally without resetting the demo database; the follow-up migrations preserve the actually applied callback hardening history, and the money pgTAP suite exercises the real RPC paths.
- Phase 3A implementation commits: `d622bd5`, `7501359`, `f7ead1e`, `b1ebd02`, `0fcf925`, `43ef920`, documentation `4d52562`, and token-boundary hardening `fe6b534`.
