# VAULTIX Identity and Institution Trust Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce the distinction between email verification and institution verification in backend policy code and Supabase persistence.

**Architecture:** Identity policy is framework-independent and consumes a small trust-state value object. Supabase repositories and RLS use the same states; no route or UI may invent a second interpretation.

**Tech Stack:** TypeScript strict, Vitest 5, Zod 4.6, Supabase PostgreSQL/RLS in the persistence units that follow.

**Spec:** `docs/superpowers/specs/2026-09-13-vaultix-mvp-design.md` and `context/architecture.md`

## Global Constraints

- Email verification and institution verification are separate trust states.
- Email-verified users may browse public Wanted metadata.
- Only institution-verified, unrestricted users may transact, submit claims, or download entitled resources.
- Authorisation is enforced server-side and through RLS; UI visibility is not authorisation.
- Use discriminated unions and exhaustive transition checks; do not scatter booleans.
- Every new policy function has a failing test before implementation.

---

### Task 1: Trust-state value object and access policy

**Owner:** Codex

**Files:**
- Create: `src/modules/identity/domain/trust-state.ts`
- Create: `src/modules/identity/domain/trust-state.test.ts`
- Create: `src/modules/identity/domain/access-policy.ts`
- Create: `src/modules/identity/index.ts`

**Interfaces:**
- Consumes: no database or framework dependency.
- Produces: `EmailVerificationState`, `InstitutionVerificationState`, `IdentityTrust`, `canBrowseMetadata`, `canTransact`, `canSubmitClaim`, and `canDownload`.

- [x] **Step 1: Write failing trust-state tests**

```ts
import { describe, expect, test } from "vitest";
import { canBrowseMetadata, canDownload, canSubmitClaim, canTransact } from "./access-policy";
import type { IdentityTrust } from "./trust-state";

const emailVerified: IdentityTrust = {
  email: "verified",
  institution: "unverified",
  restricted: false,
};

const institutionVerified: IdentityTrust = {
  email: "verified",
  institution: "verified",
  restricted: false,
};

test("email verification permits metadata browsing but not transactions", () => {
  expect(canBrowseMetadata(emailVerified)).toBe(true);
  expect(canTransact(emailVerified)).toBe(false);
  expect(canSubmitClaim(emailVerified)).toBe(false);
  expect(canDownload(emailVerified)).toBe(false);
});

test("institution verification permits transactional actions", () => {
  expect(canBrowseMetadata(institutionVerified)).toBe(true);
  expect(canTransact(institutionVerified)).toBe(true);
  expect(canSubmitClaim(institutionVerified)).toBe(true);
  expect(canDownload(institutionVerified)).toBe(true);
});

test("restriction overrides otherwise valid trust", () => {
  expect(canTransact({ ...institutionVerified, restricted: true })).toBe(false);
});
```

- [x] **Step 2: Run the focused tests and verify RED**

Run: `pnpm test -- --reporter=dot src/modules/identity/domain`

Expected: FAIL because the trust-state and policy modules do not exist.

- [x] **Step 3: Implement the discriminated states and policy**

```ts
export type EmailVerificationState = "unverified" | "verified";
export type InstitutionVerificationState = "unverified" | "pending" | "verified" | "rejected";

export interface IdentityTrust {
  email: EmailVerificationState;
  institution: InstitutionVerificationState;
  restricted: boolean;
}
```

`canBrowseMetadata` returns `true` only for `email === "verified"`. The other three policies require a verified email, verified institution, and `restricted === false`. Keep the policy functions pure and return booleans; route/server operations will map `false` to a typed failure code at their boundary.

- [x] **Step 4: Verify GREEN and exhaustive exports**

Run: `pnpm test -- --reporter=dot src/modules/identity/domain && pnpm typecheck`

Expected: all identity tests pass and the public module exports the value types and policy functions.

- [x] **Step 5: Commit when Git access is available**

```text
git add src/modules/identity
git commit -m "feat: enforce identity trust access policy"
```

### Task 2: Supabase identity schema and RLS

**Owner:** Codex

**Files:**
- Create: `supabase/config.toml`
- Create: `supabase/migrations/<timestamp>_identity_foundation.sql`
- Create: `tests/sql/identity_rls.sql`
- Create: `src/lib/supabase/database.types.ts`
- Create: `src/modules/identity/repositories/profile-repository.ts`
- Create: `src/modules/identity/repositories/profile-repository.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: Task 1 trust-state names and policy.
- Produces: profile, institution-membership, verification-request, role-assignment and restriction persistence with RLS-tested reads/writes.

- [x] **Step 1: Write SQL/RLS acceptance tests for anonymous, email-verified, institution-verified, Institution Sheriff, Platform Sheriff, and Owner actors.**
- [x] **Step 2: Run the SQL tests against local Supabase and verify RED because migrations are absent.**
- [x] **Step 3: Add ordered append-only migration with constraints, indexes, RLS and safe security-definer boundaries.**
- [x] **Step 4: Implement repositories that return view models and never expose service-role clients to browser code.**
- [x] **Step 5: Verify SQL/RLS, repository integration, typecheck, lint and build.**
- [x] **Step 6: Commit the migration and repositories as one independently verifiable unit.**

### Task 3: Authentication and verification operations

**Owner:** Codex; frontend integration owned by Claude Code

**Files:**
- Create: `src/modules/identity/services/auth-service.ts`
- Create: `src/modules/identity/services/verification-service.ts`
- Create: `src/app/api/auth/**`
- Create: `src/contracts/identity.ts`
- Create: `tests/e2e/identity/**`

**Interfaces:**
- Consumes: Task 1 policy and Task 2 repositories.
- Produces: typed registration, login, recovery, institution-domain verification, manual evidence review, role assignment and restriction operations.

- [ ] **Step 1: Write failing service tests for registration, mandatory email verification, domain allowlist, manual evidence review, and restriction.**
- [ ] **Step 2: Verify RED.**
- [ ] **Step 3: Implement one-command service operations with authentication, authorisation, validation, persistence and audit events.**
- [ ] **Step 4: Add recorded/synthetic Supabase fixtures; never call production Auth or send real email from tests.**
- [ ] **Step 5: Verify cross-role E2E and failure states; publish contracts for Claude UI.**
- [ ] **Step 6: Commit backend identity operations and contract fixtures.**

## Phase Completion Gate

- [ ] Trust-state policy tests cover all four permissions and restriction override.
- [ ] RLS tests cover all required actor classes and cross-institution access.
- [ ] Email and institution verification remain separate in database, service, and view models.
- [ ] No service-role credential reaches browser code or logs.
- [ ] Context tracker records the actual Supabase environment and unresolved launch gates.
