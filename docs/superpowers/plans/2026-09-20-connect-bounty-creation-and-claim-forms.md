# VAULTIX Connect Bounty Creation and Claim Forms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Connect the bounty creation workspace and backing flow to contribution bill payment, build the live claim submission form uploading to quarantine storage, and transition the Hunter workspace to live claims.

**Architecture:** Bounty creation initiates an atomic contribution bill via ToyyibPay; payment callbacks activate the Wanted to `open` on the append-only ledger. Claim submission enforces client-side hashing, validates file limits, acquires a pre-signed session from `/api/claims/upload-url`, and uploads directly to the private `quarantine` bucket without passing untrusted bytes through the Next.js runtime. Hunter workspace reads live user claims and open hunt opportunities while preserving preview fixtures.

**Tech Stack:** Next.js App Router (React 19, TypeScript), Tailwind CSS, Supabase Storage (quarantine), Web Crypto API (SHA-256), Vitest, React Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-20-connect-bounty-creation-and-claim-forms-design.md`

## Global Constraints

- Money is integer sen; initial bounties and backer contributions are RM1–RM50 (100–5,000 sen).
- Dual trust model: only institution-verified, unrestricted accounts may fund bounties or submit claims.
- Untrusted files (up to 50 MB) upload directly to the private `quarantine` bucket via signed PUT; Next.js server never parses or streams file bytes.
- Launch gates (`PAYMENT_MODE=disabled`/`sandbox`, `PUBLIC_UPLOADS_ENABLED=false`) default to safe disabled states with informative UI notices.
- Human moderation is mandatory: file screening produces evidence only; no claim is auto-approved.

### Task 1: Wire draft workspace and backing actions to contribution bills

**Files:**
- Modify: `src/features/marketplace/draft-operations.ts`
- Modify: `src/components/wanted-draft-workspace.tsx`
- Create: `src/components/back-wanted-modal.tsx`
- Modify: `src/components/wanted-detail.tsx`
- Create: `src/features/marketplace/draft-operations.test.ts`
- Modify: `src/components/wanted-draft-workspace.test.tsx`

- [ ] Write failing unit tests for `createDraftContributionBill` handling payment URLs, launch gate refusals, and integer sen amounts.
- [ ] Implement `createDraftContributionBill` client adapter calling `POST /api/marketplace/wanted/drafts/:id/contribution`.
- [ ] Connect `WantedDraftWorkspace` publication confirmation to `createDraftContributionBill`; present redirect state, payment waiting view, and launch-gate disabled notice.
- [ ] Build `BackWantedModal` and wire "Back this Wanted" on `WantedDetail` for institution-verified students with preset RM1–RM50 contributions.
- [ ] Run focused tests, typecheck and lint; commit `feat: connect bounty creation and backing to contribution bills`.

### Task 2: Implement live claim submission form and quarantine upload client

**Files:**
- Create: `src/features/claims/claim-operations.ts`
- Create: `src/features/claims/claim-operations.test.ts`
- Create: `src/components/claim-submission-form.tsx`
- Create: `src/components/claim-submission-form.test.tsx`
- Modify: `src/components/wanted-detail.tsx`

- [ ] Write failing tests for client-side SHA-256 hashing, MIME/size validation, signed URL PUT upload, and upload state transitions.
- [ ] Implement `computeFileSha256` using `crypto.subtle.digest` and `submitClaimFile` in `src/features/claims/claim-operations.ts`.
- [ ] Build accessible `ClaimSubmissionForm` with drag-and-drop file input, progress indicators (`hashing`, `authorizing`, `uploading`, `complete`), rights confirmation, and `UPLOAD_UNAVAILABLE` launch gate handling.
- [ ] Connect "Submit a Claim" button on `WantedDetail` to open `ClaimSubmissionForm` modal for institution-verified users on `open` Wanted requests.
- [ ] Run focused tests, typecheck and lint; commit `feat: implement claim submission form with quarantine upload`.

### Task 3: Implement live Hunter claims read service and update `/claims`

**Files:**
- Create: `src/modules/claims/services/hunter-claims-read-service.ts`
- Create: `src/modules/claims/services/hunter-claims-read-service.test.ts`
- Modify: `src/app/claims/page.tsx`
- Modify: `src/app/claims/page.test.tsx`

- [ ] Write unit tests for `HunterClaimsReadService` querying user claims and mapping to `ClaimSummary` presentation models.
- [ ] Implement `HunterClaimsReadService` joining `claims` and `wanted_requests` filtered by authenticated `claimant_id`.
- [ ] Update `src/app/claims/page.tsx` to query live user claims and live marketplace opportunities for authenticated sessions, while retaining fixture fallback for `?preview=`.
- [ ] Update claims page tests and accessibility checks; verify `FixtureNotice` only renders during preview mode.
- [ ] Run focused tests, typecheck and lint; commit `feat: connect hunter workspace to live claims`.

### Task 4: End-to-end integration, gate verification, and contract documentation

**Files:**
- Create: `tests/e2e/marketplace-bounty-claim-flow.spec.ts`
- Modify: `context/progress-tracker.md`
- Create: `docs/integration/claims-http-contract.md`

- [ ] Write Playwright E2E test covering the full lifecycle: draft creation -> contribution bill initiation -> active Wanted -> claim submission to quarantine -> claim visible in Hunter office.
- [ ] Document HTTP contracts, client error codes, upload timeouts, and launch-gate behaviors in `docs/integration/claims-http-contract.md`.
- [ ] Update `context/progress-tracker.md` with integrated Phase 4 slice status.
- [ ] Run the complete gate: format, lint, typecheck, Vitest, build and `git diff --check`.
- [ ] Commit `docs: complete bounty creation and claim forms integration`; leave branch clean with no merge or push.
