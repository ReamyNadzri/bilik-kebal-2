# Primary Email Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax.

**Goal:** Complete the important non-payment email paths: account recovery/security, institution trust decisions, claim/moderation decisions, and a usable notification inbox.

**Architecture:** Supabase Auth remains responsible for verification and recovery emails through Brevo custom SMTP. The app's Brevo API outbox handles domain notifications only after the owning database transaction commits. Payment emails remain deferred until the payment gateway is applied and verified.

**Tech Stack:** Next.js App Router, strict TypeScript, Supabase Auth/PostgreSQL, Brevo SMTP/API, Vitest, React Testing Library, Playwright.

**Spec:** `context/project-overview.md`, `context/architecture.md`, `context/code-standards.md`, and `docs/superpowers/specs/2026-09-13-vaultix-mvp-design.md`.

## Global Constraints

- Keep email verification separate from institution verification.
- Recovery links must establish a Supabase session before a password update is accepted.
- Do not reveal whether a submitted recovery address belongs to an account.
- Do not put credentials, evidence, bank details, private URLs, or provider errors in email or logs.
- Do not send real email from automated tests.
- Do not apply migrations to shared Supabase Cloud; reconcile cloud-only migration sources and use an isolated test project.
- Defer payment status, receipts, refunds, payouts, and reconciliation email until the gateway is applied and verified.

## Review Focus

- Missing/expired recovery code must not permit password update; route through callback and return a safe retry path.
- Existing session without recovery intent must not be sufficient to reset a password.
- Duplicate notification-producing decisions must remain idempotent and only notify the owning recipient.
- Institution and moderation notices must exclude review evidence and private reason text.
- Inbox must not disclose another user's notifications; pending/loading/empty/error states must be accessible.

## Tasks

### Task 1: Complete password recovery

**Owner:** Codex backend for service/route/contract; Codex frontend for page/form in its own worktree.

**Files:**
- Modify `src/modules/identity/services/auth-service.ts`, `supabase-auth-gateway.ts`, and their tests.
- Modify `src/modules/identity/delivery/auth-callback.ts` and tests; `src/app/auth/callback/route.ts`.
- Create `src/app/api/auth/reset-password/route.ts` and service/route tests.
- Create `src/app/reset-password/page.tsx`, `src/components/reset-password-form.tsx`, and component tests in the frontend worktree.
- Update `docs/integration/identity-http-contract.md` and add a Brevo Auth SMTP setup walkthrough.

Acceptance: recovery links exchange through `/auth/callback` into a recovery session; the reset page validates and confirms a strong password; server-side `updateUser` is session-scoped; invalid/expired links receive a safe message; no email enumeration or secrets leak.

### Task 2: Critical domain notifications

**Owner:** Codex backend.

Extend the notification contract and append-only migrations for institution-verification decisions and any approved appeal/restriction outcome that has an owning committed event. Add pgTAP cases for recipient scoping, idempotency, rollback, and private-data exclusion. Keep payment event kinds deferred.

Acceptance: only a committed owning-domain transition enqueues one notification and email job for the server-derived recipient; failed/no-op/retried transitions do not duplicate notices.

### Task 3: Notification inbox experience

**Owner:** Codex frontend, consuming `docs/integration/notifications-http-contract.md` and the backend's published contract.

Create `/notifications` with unread/read indication, pagination, loading, empty, unavailable, stale-session, and offline states. Add component and browser tests, keyboard support, and 360px layout checks. Do not fork domain types or construct cursors.

### Task 4: Verification walkthrough and release gate

Document local/production Supabase SMTP setup with Brevo's separate SMTP credential, redirect allow-list, template links, and reversible test steps. Record completed code checks separately from manual provider checks. Integrate only after SQL/RLS tests pass in an isolated database and cloud migration history is reconciled.
