# VAULTIX Phase 3A Wanted Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish and implement the server-authoritative taxonomy, Wanted draft, duplicate-check and publication-intent boundary that Phase 3B can attach to verified payments.

**Architecture:** Add presentation-safe contracts first, then an append-only Supabase migration with RLS, followed by small domain services and Supabase repositories. Route handlers remain thin. Publication preparation validates and freezes snapshots but cannot open a Wanted; Phase 3B alone supplies a bill and activates it after a verified callback.

**Tech Stack:** Next.js 16 App Router, TypeScript 6 strict, Zod 4, Supabase PostgreSQL/Auth/RLS, Vitest 5, pgTAP, pnpm 11.

**Spec:** `docs/superpowers/specs/2026-09-15-vaultix-phase-3-wanted-money-design.md`

## Global Constraints

- Work only on `codex/backend` in `.worktrees/codex-backend`; do not merge, rebase or push.
- Follow red-green-refactor for every behavioral change.
- Money is integer sen; a first contribution is 100–5,000 sen.
- Duration is exactly 7, 14 or 30 days.
- A draft never becomes `open` in Phase 3A.
- Payment mode defaults to `disabled`; no provider call or fake success is introduced.
- Email verification permits browsing; institution verification plus no active restriction permits drafting and publication preparation.
- RLS and services both enforce authority. Browser-supplied institution IDs never grant authority.
- No migration seeds an authoritative UiTM catalogue.
- No DTO exposes user IDs, database-only IDs, secrets, raw provider payloads or storage references.
- Do not edit Claude-owned marketplace components or frontend fixture modules.

---

### Task 1: Publish marketplace contracts and validation schemas

**Files:**
- Create: `src/contracts/marketplace.ts`
- Create: `src/contracts/marketplace.test.ts`
- Modify: `src/contracts/index.ts`

**Interfaces:**
- Consumes: `OperationResult<TData, TCode>` from `src/contracts/operation-result.ts`.
- Produces: taxonomy DTOs; `WantedDraftInput`; duplicate and publication inputs/results; safe Wanted read DTOs; stable error-code unions.

- [ ] **Step 1: Write failing contract tests**

Test real Zod parsing with literals: reject `durationDays: 10`, reject `initialContributionSen: 100.5`, reject 99 and 5001 sen, trim required text, reject an empty acknowledgement, and accept a complete 7-day/1,250-sen input. Prove the output contains no caller-selected Commissioner or authority field.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm test -- src/contracts/marketplace.test.ts`

Expected: FAIL because `./marketplace` does not exist.

- [ ] **Step 3: Implement the contracts**

Export these exact boundary symbols:

```ts
export type Sen = number & { readonly __brand: "Sen" };
export type WantedDurationDays = 7 | 14 | 30;
export type WantedLifecycle = "draft" | "awaiting_payment" | "open" | "reviewing" | "expired";
export type MarketplaceOperationCode =
  | "AUTH_REQUIRED" | "EMAIL_NOT_VERIFIED" | "INSTITUTION_VERIFICATION_REQUIRED"
  | "ACCOUNT_RESTRICTED" | "NOT_AUTHORIZED" | "VALIDATION_ERROR"
  | "WANTED_NOT_FOUND" | "DRAFT_NOT_FOUND" | "DRAFT_NOT_EDITABLE"
  | "DUPLICATE_CHECK_REQUIRED" | "DUPLICATE_CHECK_EXPIRED"
  | "PAYMENT_DISABLED" | "PAYMENT_UNAVAILABLE" | "AMOUNT_OUT_OF_RANGE"
  | "MARKETPLACE_UNAVAILABLE";
export const wantedDraftInputSchema: z.ZodType<WantedDraftInput>;
export const duplicateSuggestionInputSchema: z.ZodType<SuggestWantedDuplicatesInput>;
export const publicationInputSchema: z.ZodType<PrepareWantedPublicationInput>;
```

`WantedDraftInput` contains taxonomy UUIDs, title, description, tag UUIDs, duration and policy acknowledgement. `PrepareWantedPublicationInput` contains only draft public ID, duplicate-check token and initial contribution sen. Result aliases use `OperationResult`.

- [ ] **Step 4: Run tests, typecheck and format check**

Run: `pnpm test -- src/contracts/marketplace.test.ts && pnpm typecheck && pnpm format:check`

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/contracts/marketplace.ts src/contracts/marketplace.test.ts src/contracts/index.ts
git commit -m "feat: publish Wanted marketplace contracts"
```

### Task 2: Persist taxonomy and private Wanted drafts with RLS

**Files:**
- Create: `tests/sql/wanted_core.sql`
- Create: `supabase/migrations/202609150001_wanted_core.sql`
- Modify: `src/lib/supabase/database.types.ts` using the repository's generation command

**Interfaces:**
- Consumes: Identity tables and `private.current_user_is_email_verified()`.
- Produces: taxonomy tables, `wanted_requests`, tags, duplicate-check records, snapshots, helper policy functions and RLS.

- [ ] **Step 1: Write the failing pgTAP suite**

Create actors for unverified, email-verified, institution-verified, restricted and unrelated verified users. Assert:

- all new user-facing tables have RLS;
- anonymous/unverified users cannot browse taxonomy or public Wanteds;
- email-verified users can browse active taxonomy and public Wanted rows only;
- only institution-verified unrestricted users can insert their own drafts;
- a user cannot read or update another Commissioner's draft;
- invalid duration, snapshot rate, policy version, hierarchy or lifecycle combinations fail;
- browser roles cannot insert snapshots, duplicate-check rows or force lifecycle transitions;
- public grants do not permit financial or authority columns.

- [ ] **Step 2: Run SQL tests and verify RED**

Run: `pnpm test:db`

Expected: FAIL because the Phase 3 tables do not exist.

- [ ] **Step 3: Add the migration**

Create:

```text
campuses, faculties, programmes, courses, academic_sessions,
resource_types, languages, tags,
wanted_requests, wanted_request_tags,
wanted_duplicate_checks, wanted_public_events
```

Use UUID primary keys, stable scoped slugs, active flags, sort order and UTC timestamps. `wanted_requests` carries an opaque `public_id`, Commissioner ID, institution-scoped taxonomy references, draft fields and nullable immutable publication snapshots. Add checks that snapshot fields are all-null for `draft` and all-present for `awaiting_payment|open|reviewing|expired`. Use composite foreign keys to keep campus/course/session under the stored institution.

Add security-definer helpers with `search_path = ''` for institution trust and draft ownership. Revoke default function access, grant only exact operations, enable RLS before table grants, and deny direct lifecycle/snapshot writes to browser roles.

- [ ] **Step 4: Reset local DB, regenerate types, run SQL tests**

Run: `supabase db reset --local`, then `pnpm db:types`, then `pnpm test:db`.

Expected: all pgTAP suites pass.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/202609150001_wanted_core.sql tests/sql/wanted_core.sql src/lib/supabase/database.types.ts
git commit -m "feat: persist Wanted drafts behind RLS"
```

### Task 3: Implement taxonomy reads

**Files:**
- Create: `src/modules/taxonomy/repositories/taxonomy-repository.ts`
- Create: `src/modules/taxonomy/repositories/supabase-taxonomy-repository.ts`
- Create: `src/modules/taxonomy/services/taxonomy-service.ts`
- Create: `src/modules/taxonomy/services/taxonomy-service.test.ts`
- Create: `src/modules/taxonomy/loaders/taxonomy-read.ts`
- Create: `src/app/api/marketplace/taxonomy/route.ts`
- Create: `src/app/api/marketplace/taxonomy/route.test.ts`

**Interfaces:**
- Consumes: active taxonomy rows and the authenticated Supabase server client.
- Produces: `loadMarketplaceTaxonomy()` and `GET /api/marketplace/taxonomy` returning `ListTaxonomyResult`.

- [ ] **Step 1: Write failing service and route tests**

Cover complete hierarchy mapping, deterministic sort order, inactive-row exclusion by repository contract, unauthenticated refusal, unverified-email refusal, empty taxonomy as successful empty arrays, and repository failure as `MARKETPLACE_UNAVAILABLE`.

- [ ] **Step 2: Run tests and verify RED**

Run: `pnpm test -- src/modules/taxonomy/services/taxonomy-service.test.ts src/app/api/marketplace/taxonomy/route.test.ts`

Expected: FAIL on missing modules.

- [ ] **Step 3: Implement repository, service, loader and route**

The service accepts a complete viewer trust record and `TaxonomyReader`. It does not infer email verification from an address. The route delegates to the loader and maps success to 200, auth failure to 401, trust failure to 403 and unavailable to 503.

- [ ] **Step 4: Run focused and full TypeScript gates**

Run: `pnpm test -- src/modules/taxonomy src/app/api/marketplace/taxonomy && pnpm typecheck && pnpm lint`

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/modules/taxonomy src/app/api/marketplace/taxonomy
git commit -m "feat: expose marketplace taxonomy reads"
```

### Task 4: Implement draft validation and ownership

**Files:**
- Create: `src/modules/wanted/domain/wanted-policy.ts`
- Create: `src/modules/wanted/domain/wanted-policy.test.ts`
- Create: `src/modules/wanted/repositories/wanted-repository.ts`
- Create: `src/modules/wanted/repositories/supabase-wanted-repository.ts`
- Create: `src/modules/wanted/services/wanted-draft-service.ts`
- Create: `src/modules/wanted/services/wanted-draft-service.test.ts`
- Create: `src/modules/wanted/loaders/wanted-operations.ts`
- Create: `src/app/api/marketplace/wanted/drafts/route.ts`
- Create: `src/app/api/marketplace/wanted/drafts/[id]/route.ts`
- Add focused route tests beside both handlers.

**Interfaces:**
- Consumes: `WantedDraftInput`, stored Identity trust and active taxonomy.
- Produces: `createWantedDraft()` and `updateWantedDraft()` with safe `OperationResult` failures.

- [ ] **Step 1: Write failing policy and service tests**

Cover trust denial, active restriction, inactive/mismatched taxonomy, title/description normalisation, exact duration values, owner-only update, non-draft refusal, preservation of Commissioner/institution identity, and repository failure mapping.

- [ ] **Step 2: Run tests and verify RED**

Run: `pnpm test -- src/modules/wanted/domain/wanted-policy.test.ts src/modules/wanted/services/wanted-draft-service.test.ts`

Expected: FAIL on missing modules.

- [ ] **Step 3: Implement policy, repository, service, loader and routes**

Derive the Commissioner and institution from the session/account read. Resolve every taxonomy UUID server-side and reject cross-institution combinations. Route status mapping is 201 create, 200 update, 401 auth, 403 trust/ownership, 404 missing draft, 409 non-editable and 422 validation.

- [ ] **Step 4: Run focused tests and gates**

Run: `pnpm test -- src/modules/wanted src/app/api/marketplace/wanted/drafts && pnpm typecheck && pnpm lint`

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/modules/wanted src/app/api/marketplace/wanted/drafts
git commit -m "feat: create private Wanted drafts"
```

### Task 5: Implement duplicate checks and publication intent

**Files:**
- Create: `src/modules/wanted/domain/duplicate-ranking.ts`
- Create: `src/modules/wanted/domain/duplicate-ranking.test.ts`
- Create: `src/modules/wanted/services/wanted-publication-service.ts`
- Create: `src/modules/wanted/services/wanted-publication-service.test.ts`
- Create: `src/app/api/marketplace/wanted/duplicate-suggestions/route.ts`
- Create: `src/app/api/marketplace/wanted/drafts/[id]/publication/route.ts`
- Add focused route tests beside both handlers.

**Interfaces:**
- Consumes: owned editable draft, public Wanted candidates, injected clock/token generator and current publication configuration.
- Produces: ranked safe suggestions, expiring one-use duplicate token and frozen `awaiting_payment` publication intent.

- [ ] **Step 1: Write failing ranking and publication tests**

Use hand-derived expected ordering. Cover same-course priority, metadata score, title-term normalisation, exclusion of drafts/private identity, token expiry, token/draft mismatch, token reuse, 100/5,000-sen boundaries, disabled payment result, immutable 10%/policy/duration/access snapshots, and no transition to `open`.

- [ ] **Step 2: Run tests and verify RED**

Run: `pnpm test -- src/modules/wanted/domain/duplicate-ranking.test.ts src/modules/wanted/services/wanted-publication-service.test.ts`

Expected: FAIL on missing modules.

- [ ] **Step 3: Implement ranking and publication preparation**

Generate an opaque hash of server state plus a random nonce; store only the token hash and expiry. Consume it transactionally while freezing snapshots. With payments disabled, preserve the editable draft and return `PAYMENT_DISABLED`; with an unavailable provider boundary, return `PAYMENT_UNAVAILABLE`. Phase 3A supplies no adapter capable of success and never fabricates a bill.

- [ ] **Step 4: Run focused tests and gates**

Run: `pnpm test -- src/modules/wanted src/app/api/marketplace/wanted && pnpm typecheck && pnpm lint`

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/modules/wanted src/app/api/marketplace/wanted
git commit -m "feat: prepare Wanted publication safely"
```

### Task 6: Document the contract and close Phase 3A

**Files:**
- Create: `docs/integration/marketplace-http-contract.md`
- Modify: `context/progress-tracker.md`
- Modify: `README.md` only if new local commands are required

**Interfaces:**
- Consumes: all published Phase 3A routes and stable error codes.
- Produces: frontend handoff containing exact request/response shapes and the Phase 3B dependency boundary.

- [ ] **Step 1: Document every route and state**

Include authentication, request JSON, success JSON, status mapping, safe errors, idempotency expectations, and an explicit statement that no Phase 3A response confirms payment or opens a Wanted.

- [ ] **Step 2: Update the tracker**

Record commit SHAs, tests, outstanding ToyyibPay contract questions, empty production taxonomy, the Claude integration dependency and that `/claims` remains Phase 4 fixture data.

- [ ] **Step 3: Run the complete gate**

Run:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:db
pnpm build
git diff --check
```

Expected: every command exits 0.

- [ ] **Step 4: Commit**

```bash
git add docs/integration/marketplace-http-contract.md context/progress-tracker.md README.md
git commit -m "docs: hand off the Wanted core contract"
```

- [ ] **Step 5: Report without merging or pushing**

Report every commit SHA, the complete gate totals, local DB reset impact, remaining Phase 3B work and a clean `codex/backend` worktree.
