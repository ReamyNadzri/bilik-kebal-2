# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Repository state

The approved phased MVP is under active implementation in two isolated worktrees. Phase 1 is
complete on `codex/provisional-ui`; `codex/backend` contains the shared Foundation plus the first
Phase 2 Identity trust policy. `main` intentionally remains behind those branches until the user
approves integration. Always inspect `git worktree list`, `git branch -vv`, and
`context/progress-tracker.md` before deciding which phase or lane is current.

The application baseline uses pinned `pnpm`, Next.js App Router, strict TypeScript, Tailwind,
ESLint, Prettier, Vitest + React Testing Library, Playwright, and validated environment boundaries.
Run commands from the relevant application worktree:

```text
pnpm install --frozen-lockfile
pnpm dev
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

Phase 2 UI remains fixture-backed until Codex publishes and integrates the corresponding identity
operations. A passing fixture UI is not an end-to-end backend flow.

## Context files — the source of truth

Read these before answering anything substantive; they are the accepted spec, not background notes.

| File | Owns |
| --- | --- |
| `context/project-overview.md` | Product behaviour, user flow, features, in/out of scope, success criteria |
| `context/architecture.md` | Stack, domain boundaries, storage model, auth model, money/file flow, retention, **invariants** |
| `context/code-standards.md` | TypeScript/Next.js/Supabase conventions, ledger and file rules, testing, folder ownership |
| `context/ai-workflow-rules.md` | Scoping, delivery order, decision authority, protected areas, verification and launch gates |
| `context/ui-context.md` | Approved UI constraints and what the external design handoff must deliver |
| `context/progress-tracker.md` | Current phase, decisions made, open questions, session-resumption notes |

`docs/superpowers/specs/2026-09-13-vaultix-mvp-design.md` is the phased MVP design handoff. It
**supplements and does not replace** the six context files: where it conflicts with them, the
stricter security, money, access-control, privacy, or launch-gate requirement wins and the conflict
must be reconciled before implementation continues.

When accepted behaviour changes, **update the relevant context file in the same patch** and append to
`progress-tracker.md`. A code change that contradicts a context file is a bug in one of the two.

## Domain vocabulary

VAULTIX is an academic-resource bounty marketplace (UiTM-first, English-only in release one).
A *Commissioner* publishes a **Wanted** request and funds it; *Backers* add to the **Bounty**
(RM1–RM50 each); a *Hunter* submits a **Claim** (a file); a **Sheriff** reviews and selects one
winner; the resource lands in the **Archive**. Roles above the student tier are `Owner`,
`Platform Sheriff`, and institution-scoped `Institution Sheriff`. `Wanted` is a feature term, not the
product name. UI copy may use these branded nouns; keep formal words (Pay, Refund, Report, Appeal)
for high-stakes actions.

Two trust states are deliberately separate and must never be conflated: **email verified** (can
browse metadata) and **institution verified** (can transact, claim, and download; earns the star
emblem).

## Architecture essentials

Supabase-centric **modular monolith**: one Next.js app on Vercel, with domains isolated behind
server-side services and explicit contracts. Supabase supplies Auth, PostgreSQL, private Storage,
Edge Functions, Queues (`pgmq`), and Cron (`pg_cron`). ToyyibPay collects payment; Resend sends mail.

File screening runs in a **separately deployed worker** (`workers/scanner/`) — untrusted 50 MB files
are never parsed in a browser, route handler, Vercel function, or Edge Function, and the worker is
never imported into the web runtime.

Planned boundaries: `src/app/` (delivery layer only) · `src/modules/<domain>/` (types, policies,
services, repositories, adapters, tests) · `src/components/` + `src/components/ui/` (generated
primitives) · `src/lib/` · `supabase/migrations/` (append-only) · `supabase/functions/` ·
`workers/scanner/` · `tests/e2e/`.

Domains: `identity`, `taxonomy`, `wanted`, `ledger`, `claims`, `moderation`, `entitlements`,
`payouts`, `notifications`, `audit`. Modules share identifiers and domain events only — never reach
into the tables of another module or bypass its owning service.

Storage records keep `storage_provider`, `bucket`, `object_key`, checksum, size, MIME, and lifecycle
state rather than URLs, so a later Cloudflare R2 hybrid needs no change to Claims or Entitlements.

## Invariants that constrain almost every change

The full list is in `context/architecture.md`; these are the ones most likely to be violated:

- Money is **integer sen**, branded at the type level; floating point is forbidden for financial values.
- The ledger is **append-only and balanced**. Never edit or delete an entry — corrections, refunds,
  fees, and chargebacks are compensating entries inside one transaction.
- A bounty changes only after a provider event is **verified and processed exactly once**. A redirect
  is UX; only a verified callback or status lookup confirms payment.
- No entitlement or payout may exist without a **recorded human Sheriff approval**. Automated
  screening, near-duplicate matches, and risk signals are reviewer *evidence* only.
- Exactly one winning claim per bounty (submission time is only a tie-breaker); at most one
  entitlement per successful contributor.
- Provider callbacks, queue jobs, cron jobs, entitlement creation, payout creation, and notification
  sends are **idempotent**.
- Unreviewed file content stays private and quarantined, and never enters logs, analytics, email, or
  notification payloads.
- Free release requires **Hunter opt-in plus Sheriff-confirmed rights**; otherwise contributor-only.
- Authorisation is enforced server-side **and** through RLS on every user-facing table and private
  bucket. Hiding a UI control is not access control.
- Secrets, service-role keys, bank details, and private file URLs never reach client bundles or logs.
- Fee rate and applicable policy version are **snapshotted when a Wanted request is published**.
- Public uploads and unrestricted live payment stay disabled until their launch gates pass — never
  flip them as a side effect of shipping code.

## Working rules

- Ship **one independently verifiable vertical slice at a time** (schema + policy + server action +
  minimal UI + tests), each with written acceptance criteria before implementation. The MVP is
  organised into six phases — 1 Foundation, 2 Identity and institution trust, 3 Wanted marketplace
  and money, 4 Claims and moderation, 5 Fulfilment and operations, 6 Hardening and controlled
  launch — each with its own acceptance criteria in the design doc; the 14-step delivery order in
  `ai-workflow-rules.md` is the finer-grained sequence within them.
- **Safe development defaults** while launch-gate questions stay open: payment mode `disabled`
  (sandbox only where explicitly enabled), public uploads disabled, synthetic scanner results
  confined to automated tests and controlled fixtures, neutral accessible tokens pending the design
  handoff, no automatic payout or refund execution, and no public launch on development-only plans.
- Tests for a single domain live beside that domain; shared test builders live in explicitly named
  test-support modules that production code never imports.
- Choose safe, reversible defaults for non-critical technical details without asking. **Escalate**
  anything affecting money, legal responsibility, ownership, privacy, public exposure, core product
  behaviour, irreversible migration, or recurring cost — with a recommendation, not a questionnaire.
  Record material assumptions in `progress-tracker.md`.
- Never infer unspecified financial, legal, privacy, entitlement, or moderation behaviour. Add it to
  the open questions in `progress-tracker.md` instead.
- Protected unless the task explicitly requires it: applied files in `supabase/migrations/` (add a
  new migration), generated files in `src/components/ui/` (wrap them), lockfiles outside the package
  manager, generated Supabase types, production provider settings, payment mode, the public-upload
  flag, RLS bypasses, and `BILIK KEBAL 2 by afes.pdf`.
- Sandbox providers by default. Automated tests never send real email, take real payment, release a
  payout or refund, or delete retained evidence — use recorded/synthetic ToyyibPay fixtures.
- Before calling a unit done: acceptance criteria pass, typecheck/lint/tests/production build pass,
  new RLS and privileged functions have explicit access-control tests, retry and idempotency paths
  are tested, no invariant is violated, nothing sensitive leaks into logs or client bundles, and the
  context files reflect reality.

## Two-lane delivery: Codex backend, Codex frontend

`docs/superpowers/plans/2026-09-13-vaultix-mvp-coordination.md` splits the build into two lanes that
must not edit each other's files. **Codex** owns `codex/backend`: tooling, `src/contracts/**`,
`src/modules/**`, `src/app/api/**`, `src/actions/**`, server-only `src/lib/**`, `supabase/**`,
`workers/**`. **Codex** owns `codex/provisional-ui`: `src/app/**` pages and layouts (not
`api/`), `src/components/**`, `src/features/presentation/**`, component tests, `tests/e2e/ui/**`.
`src/app/globals.css`, `src/app/layout.tsx`, `tests/e2e/**`, `context/**`, and `docs/**` are
shared-by-review — one lane per slice, named in the slice brief first.

Work in separate worktrees, never both lanes in one checkout. Execute only tasks labelled
`Owner: Codex`. Codex publishes contracts first; consume them rather than forking domain types,
enums, money types, permissions, lifecycle transitions, or result shapes in frontend code. Propose
contract changes in documentation instead. The plan's Stop Conditions — money, legal responsibility,
**ownership**, private evidence, public exposure, irreversible migration, recurring cost, final brand
assets, launch-gate activation — mean stop and ask, not improvise.

## UI constraints

Codex owns a **complete provisional frontend** across all MVP routes, flows, responsive
layouts, and interaction/accessibility states. Frontend work may proceed before the external
designer's handoff; what must not happen is treating provisional values as approved brand assets.
Keep every temporary colour, typeface, icon, radius, and decorative choice behind the semantic CSS
custom properties in `ui-context.md` (`--bg-base`, `--text-primary`, `--accent-primary`,
`--focus-ring`, `--state-error`, …) so the handoff replaces them without rewriting components. No
component hardcodes a visual value.

The provisional token layer and the `AppShell` / `UiStatus` contracts are specified with verified
contrast ratios in `docs/superpowers/specs/2026-09-13-vaultix-provisional-ui.md`.

A provisional unit is done when all its success/empty/loading/validation/failure/restricted/expired/
offline states exist, it works from 360 px upward by keyboard, it consumes tokens, money and policy
and security and error information read as clear English beside any themed wording, and tests cover
its critical interaction and accessibility behaviour.

The frontier bounty-board theme must be original — no Red Dead Redemption logos, artwork,
typography, UI assets, or trade dress — and the themed layer must never obscure payment, policy,
security, accessibility, status, or error information. Primary student and Sheriff flows target
WCAG 2.1 AA, full keyboard operation, and 360 px width upward.
