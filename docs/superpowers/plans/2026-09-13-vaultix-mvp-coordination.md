# VAULTIX MVP Coordination Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement the linked phase plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the complete VAULTIX MVP through coordinated Claude Code frontend and Codex backend work without shared-file conflicts or contract drift.

**Architecture:** One `pnpm`-managed Next.js App Router modular monolith backed by Supabase, with provider integrations behind typed adapters and untrusted file processing in a separate worker. Codex publishes shared contracts and backend operations; Claude Code consumes those contracts to build a complete provisional accessible frontend.

**Tech Stack:** Node.js 24 LTS, pnpm 11, Next.js 16.3.3 Active LTS, React 19, TypeScript strict, Tailwind CSS 4, Zod 4, Supabase, Vitest, React Testing Library, Playwright

**Spec:** `docs/superpowers/specs/2026-09-13-vaultix-mvp-design.md`

## Global Constraints

- Read all six files under `context/` and the design spec before changing code.
- Work in separate Git worktrees and branches; never run both agents in the same checkout.
- Codex owns backend contracts. Claude must not redefine business enums, money types, permissions, lifecycle transitions, or operation result shapes.
- Claude owns provisional frontend files. Codex must not redesign or rewrite Claude-owned product components while integrating operations.
- Money is branded integer sen; floating-point arithmetic is forbidden.
- Every user-facing table and private bucket uses RLS with explicit role tests.
- Provider callbacks, queue jobs, cron jobs, entitlements, payouts, refunds, and notifications are idempotent.
- Public upload and unrestricted live payment remain disabled until their launch gates pass.
- Provisional UI values live behind semantic CSS variables and are not final brand approval.
- Every independently verifiable unit follows test-first development and ends with focused tests, lint, typecheck, relevant integration tests, build, context sync, and a small commit.

---

## 1. Branches and Worktrees

Use these long-lived integration lanes:

| Worker | Branch | Suggested worktree | Owns |
| --- | --- | --- | --- |
| Codex | `codex/backend` | `.worktrees/codex-backend` | tooling baseline, `src/contracts`, `src/modules`, server-only `src/lib`, route handlers/server actions, Supabase, Edge Functions, scanner worker, backend tests |
| Claude Code | `codex/provisional-ui` | `.worktrees/claude-ui` | page/layout presentation, `src/components`, client interactions, provisional tokens, frontend fixtures, component tests, UI-focused Playwright tests |

The first Foundation commit lands on `codex/backend`. Create the Claude worktree from that commit so both lanes share the same lockfile, configuration, test runner, aliases, and contract conventions.

Do not make unrelated edits on `main`. Integrate completed vertical slices through reviewed merges or cherry-picks after both sides pass their gates.

## 2. File Ownership

### Codex-owned paths

- `package.json`, `pnpm-lock.yaml`, runtime/tool configuration, and CI workflow
- `src/contracts/**`
- `src/lib/config/**`, `src/lib/server/**`, `src/lib/supabase/**`, `src/lib/observability/**`
- `src/modules/**`
- `src/app/api/**`
- `src/actions/**`
- `supabase/**`
- `workers/**`
- backend, SQL, RLS, provider-contract, and worker tests

### Claude-owned paths

- `src/app/**/page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, and `not-found.tsx`, excluding `src/app/api/**`
- `src/components/**`
- `src/features/presentation/**`
- provisional visual tokens in `src/app/globals.css`, coordinated through review if Codex must touch that file
- component tests and frontend fixture builders
- UI-focused Playwright scenarios under `tests/e2e/ui/**`

### Shared-by-review paths

- `src/app/globals.css`
- `src/app/layout.tsx`
- `tests/e2e/**`
- documentation under `context/**` and `docs/**`

Only one branch edits a shared-by-review file in a vertical slice. The slice brief names that owner before work begins.

## 3. Contract Rules

Codex publishes runtime-validated contracts in `src/contracts/`. Every command exposes:

```ts
export type OperationResult<T, C extends string> =
  | { ok: true; data: T }
  | { ok: false; code: C; message: string; fieldErrors?: Record<string, string[]> };
```

Each UI flow consumes a view model rather than database rows. View models contain opaque public identifiers, display-safe timestamps/amounts/statuses, permissions, and available actions. They never expose provider payloads, object keys, private URLs, service identifiers, or evidence contents.

Contract changes land in Codex first with tests. Claude rebases or merges that contract commit, updates fixtures, then implements or integrates the UI. Claude may propose a contract change in documentation but must not silently fork it in frontend code.

## 4. Phase Dependency Map

| Phase | Codex backend units | Claude frontend units | Integration proof |
| --- | --- | --- | --- |
| 1 Foundation | toolchain, configuration boundary, result contracts, CI | provisional token system, app shell, global states | clean install; lint, typecheck, unit test, build; shell renders at 360 px |
| 2 Identity | Supabase baseline, profiles, trust states, roles, verification RLS and operations | auth, recovery, profile, verification, restricted-access and role navigation screens | anonymous/email-verified/institution-verified/role E2E journeys |
| 3 Wanted & money | taxonomy, Wanted lifecycle, duplicate query, bills, callback verification, ledger and reconciliation | Board, detail, create flow, duplicate selection, checkout/result and contribution history | sandbox create/fund flow; duplicate callbacks alter ledger once |
| 4 Claims & moderation | upload sessions, quarantine records, scanner contracts, review/report/appeal policies | claim form/upload states, Hunter claim history, Sheriff queues/detail, report and appeal flows | controlled file reaches human review without unauthorised exposure |
| 5 Fulfilment & operations | atomic approval, entitlements, download authorisation, release, payout/refund, notifications, retention | Archive/download, notification centre, Owner payout/refund and operational state screens | approval creates exact entitlements/payout; expiry creates exact refunds |
| 6 Hardening | observability, rate limits, backup/recovery, reconciliation, provider health and live gates | accessibility pass, responsive polish, full error/offline/loading coverage | complete controlled-environment E2E and launch-gate report |

## 5. Merge Order Per Vertical Slice

1. Codex writes the slice acceptance criteria and contract tests.
2. Codex implements the backend contract, migration/RLS where needed, and deterministic fixture adapter.
3. Codex commits and provides the commit hash plus focused verification output.
4. Claude incorporates that commit and implements the complete provisional UI against the real contract.
5. Claude commits and provides the commit hash plus component/E2E verification output.
6. Codex runs cross-domain/backend verification; Claude runs frontend/accessibility verification.
7. Merge the slice only when both reports pass and the context tracker reflects reality.

Claude may build non-integrated screens earlier against typed fixture repositories. Those screens must display a visible development-only fixture marker and must switch to the real operation without changing domain types.

## 6. Phase Plans

- [ ] Phase 1: execute `docs/superpowers/plans/2026-09-13-vaultix-foundation.md`.
- [ ] Phase 2: write and approve `docs/superpowers/plans/2026-09-13-vaultix-identity.md` after Phase 1 contracts pass.
- [ ] Phase 3: write and approve `docs/superpowers/plans/2026-09-13-vaultix-wanted-ledger.md` after Phase 2 RLS passes.
- [ ] Phase 4: write and approve `docs/superpowers/plans/2026-09-13-vaultix-claims-moderation.md` after institution permissions and Wanted lifecycle are stable.
- [ ] Phase 5: write and approve `docs/superpowers/plans/2026-09-13-vaultix-fulfilment-operations.md` after claim approval contracts are stable.
- [ ] Phase 6: write and approve `docs/superpowers/plans/2026-09-13-vaultix-hardening-launch.md` after all controlled-environment flows pass.

Each phase receives its own executable plan because a single full-MVP instruction file would mix independent subsystems, hide dependency errors, and make safe review impractical.

## 7. Claude Code Start Instructions

Claude must begin with this sequence:

1. Read `CLAUDE.md`.
2. Read all six `context/*.md` files.
3. Read `docs/superpowers/specs/2026-09-13-vaultix-mvp-design.md`.
4. Read this coordination plan and the current phase plan.
5. Confirm it is in the Claude UI worktree on branch `codex/provisional-ui`.
6. Confirm the Foundation commit from Codex is present.
7. Execute only tasks labelled `Owner: Claude Code`.
8. Do not add backend behavior, database models, payment logic, or alternate domain contracts.

Suggested prompt after the Claude worktree is ready:

```text
Read CLAUDE.md, all context/*.md files, docs/superpowers/specs/2026-09-13-vaultix-mvp-design.md, docs/superpowers/plans/2026-09-13-vaultix-mvp-coordination.md, and the current phase plan. You own only tasks labelled Owner: Claude Code. Build the complete provisional accessible frontend using Codex-owned contracts and semantic tokens. Do not redefine backend rules or edit Codex-owned paths. Work test-first, commit each independently verifiable task, and report commit hashes plus verification output.
```

## 8. Stop Conditions

Stop the affected slice and ask the user when work requires a decision about real money, legal responsibility, ownership, private evidence, public exposure, irreversible migration, recurring cost, final brand assets, or launch-gate activation. Continue unrelated safe work when its contracts and tests are independent.
