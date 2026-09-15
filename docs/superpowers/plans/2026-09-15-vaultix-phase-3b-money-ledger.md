# VAULTIX Phase 3B Money and Ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add server-authoritative contribution bills, verified ToyyibPay callback handling, and an immutable balanced ledger that activates a Wanted exactly once after confirmed payment.

**Architecture:** The money module owns contribution intents, provider events, successful contributions, ledger transactions/entries, and activation. Provider adapters normalize external responses; a security-definer PostgreSQL transaction is the only authority allowed to consume a verified event and mutate financial state. Browser routes never accept provider success claims or write money tables directly.

**Tech Stack:** Next.js App Router route handlers, TypeScript, Zod, Supabase PostgreSQL/RLS/RPC, Vitest, pgTAP.

**Spec:** `docs/superpowers/specs/2026-09-15-vaultix-phase-3-wanted-money-design.md`

## Global Constraints

- Money is integer sen; contributions are RM1–RM50 (100–5,000 sen).
- Payment modes are `disabled`, `sandbox`, and `live_limited`; disabled mode creates no bill.
- ToyyibPay secrets and callback verification stay behind typed adapters and never enter DTOs or logs.
- A provider callback is untrusted until its signature, amount, bill and merchant identity are verified.
- Ledger entries are append-only and every committed transaction balances to zero.
- A Wanted changes to `open` only inside the same trusted transaction as its first confirmed contribution.
- No browser role may insert provider events, contributions, ledger entries, audit events or outbox rows.

### Task 1: Publish money contracts and provider boundary

**Files:**
- Modify: `src/contracts/marketplace.ts`
- Create: `src/contracts/money.ts`
- Create: `src/contracts/money.test.ts`
- Create: `src/modules/money/providers/toyyibpay.ts`
- Create: `src/modules/money/providers/toyyibpay.test.ts`

- [ ] Write failing Zod tests for contribution intent, callback envelope, provider result mapping, sen boundaries, and redaction of secrets.
- [ ] Implement typed contracts: `ContributionIntentInput`, `ProviderCallback`, `MoneyOperationCode`, `BillView`, `ContributionView`, and `LedgerPosting`; keep provider payloads internal.
- [ ] Implement `ToyyibPayAdapter` with `createBill`, `verifyCallback`, and normalized outcomes. Missing/disabled credentials map to `PAYMENT_DISABLED` or `PAYMENT_UNAVAILABLE`; no success is fabricated.
- [ ] Run focused tests, typecheck and lint; commit `feat: publish money and provider contracts`.

### Task 2: Add financial schema, constraints and RLS

**Files:**
- Create: `supabase/migrations/202609150004_money_ledger.sql`
- Modify: `tests/sql/wanted_core.sql`
- Create: `tests/sql/money_ledger.sql`
- Modify: `src/lib/supabase/database.types.ts` via `pnpm db:types`

- [ ] Write pgTAP RED tests for contribution intents, provider-event uniqueness, immutable ledger rows, balanced-entry constraints, and direct browser denial.
- [ ] Create tables for `contribution_intents`, `provider_events`, `contributions`, `ledger_transactions`, `ledger_entries`, and `money_outbox` with integer-sen checks, unique provider identities, and append-only triggers.
- [ ] Add RLS/grants denying browser inserts and expose only narrowly scoped trusted functions.
- [ ] Add a security-definer `record_verified_contribution` transaction that locks the intent, rejects mismatch/replay, inserts the provider event/contribution and balanced entries, and opens the Wanted once.
- [ ] Apply locally, regenerate types, run all pgTAP tests, commit `feat: add the immutable contribution ledger`.

### Task 3: Implement bill and contribution services/routes

**Files:**
- Create: `src/modules/money/services/contribution-service.ts`
- Create: `src/modules/money/services/contribution-service.test.ts`
- Create: `src/modules/money/loaders/money-operations.ts`
- Create: `src/app/api/marketplace/wanted/drafts/[id]/contribution/route.ts`
- Create: `src/app/api/payments/toyyibpay/callback/route.ts`
- Create: focused route tests beside both handlers

- [ ] Write RED service tests for eligibility, kill switch, amount boundaries, draft state, bill creation and safe error mapping.
- [ ] Implement contribution intent creation using the trusted publication snapshot and provider adapter; return only a safe `BillView`.
- [ ] Implement callback verification before calling the database function; persist malformed/reordered events safely without mutating the ledger.
- [ ] Map callbacks to `200` acknowledgement for accepted/duplicate/rejected provider events without revealing secrets; map user operations to documented status codes.
- [ ] Run focused tests and gates; commit `feat: orchestrate contribution bills and callbacks`.

### Task 4: Verify activation, idempotency and reconciliation boundary

**Files:**
- Create: `src/modules/money/services/reconciliation-service.ts`
- Create: `src/modules/money/services/reconciliation-service.test.ts`
- Modify: `tests/sql/money_ledger.sql`
- Create: `docs/integration/money-http-contract.md`
- Modify: `context/progress-tracker.md`

- [ ] Test duplicate callbacks, reordered callbacks, amount/bill mismatch, first-funded activation, later contributions, and kill-switch behavior.
- [ ] Implement read-only reconciliation projection for unresolved provider events; never “repair” financial state by editing ledger rows.
- [ ] Document exact request/response shapes, acknowledgement semantics, mode behavior, idempotency, and Phase 3C handoff.
- [ ] Run the complete gate: format, lint, typecheck, Vitest, pgTAP, build and `git diff --check`.
- [ ] Commit `docs: publish the money and ledger contract`; leave branch clean with no merge or push.
