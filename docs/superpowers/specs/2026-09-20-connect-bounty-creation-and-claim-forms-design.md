# VAULTIX Connect Bounty Creation and Claim Forms Design

Status: approved direction, awaiting implementation-plan review.

## 1. Objective

This specification connects the two halves of the VAULTIX academic bounty marketplace:
1. **Bounty Creation & Backing (Demand)**: Connecting the `/wanted/new` creation workspace and `/wanted/[id]` backing action to the Phase 3B contribution bill and payment lifecycle, transitioning drafts into active, funded Wanted listings.
2. **Claim Submission & Hunt Workspace (Supply)**: Connecting the `/wanted/[id]` claim action to the Phase 4 signed upload session API (`/api/claims/upload-url`) and private quarantine storage, and transitioning `/claims` from static fixtures to authenticated user claims.

Both flows strictly adhere to repository invariants: dual-trust institution checks, integer sen currency, untrusted file quarantine isolation, and disabled launch-gate fallbacks.

## 2. Delivery Boundary

Codex / Antigravity owns:
- `src/contracts/**` additions or updates for claim submission views and contribution bill options;
- `src/features/marketplace/draft-operations.ts` and `src/features/claims/claim-operations.ts` client adapters;
- `src/modules/claims/services/hunter-claims-read-service.ts` and associated loader queries;
- `src/components/wanted-draft-workspace.tsx` payment transition handling;
- `src/components/claim-submission-form.tsx` accessible upload component;
- `src/components/back-wanted-modal.tsx` backer contribution interface;
- `src/components/wanted-detail.tsx` and `src/app/claims/page.tsx` integration;
- Focused unit, component, database, and Playwright E2E tests.

## 3. Slice A — Bounty Creation and Backing Flow Integration

### 3.1 Draft Publication & Bill Creation
The draft workspace (`src/components/wanted-draft-workspace.tsx`) currently saves drafts, performs duplicate checks, and calls `requestWantedPublication`, ending at `awaiting_payment`.
- Add client adapter `createDraftContributionBill(draftId, duplicateCheckToken, amountSen)` targeting `POST /api/marketplace/wanted/drafts/:id/contribution`.
- Upon duplicate check review confirmation:
  1. Call `createDraftContributionBill` with the validated integer sen bounty (RM1–RM50 = 100–5,000 sen).
  2. If response is `PAYMENT_DISABLED` (503): Render an informative refusal explaining that live payments are currently locked behind launch gates.
  3. If response is `200 BillView`:
     - In live/sandbox mode: Redirect browser to `billView.paymentUrl` or open checkout return handler.
     - In development/mock mode: Provide an instant simulated payment action triggering the local webhook for end-to-end testing.

### 3.2 Backer Bounty Contribution
On `/wanted/[id]` (`src/components/wanted-detail.tsx`), replace the static `/profile/institution-verification` link for Backers with `BackWantedModal`:
- Verify actor has `capabilities.transact === true`.
- Offer preset contributions (RM1, RM5, RM10, RM20, RM50).
- Generate a backer contribution bill and redirect to payment.

## 4. Slice B — Live Claim Submission & Quarantine Upload

### 4.1 Client-Side File Validation & Checksum
Before requesting an upload session, the browser client:
- Enforces `CLAIM_MAX_BYTES` (50 MB) and `claimMimeTypes` (PDF, DOCX, PPTX, XLSX, JPEG, PNG, WEBP).
- Computes SHA-256 hex digest using Web Crypto API (`crypto.subtle.digest("SHA-256", arrayBuffer)`).
- Enforces explicit `rightsConfirmed: true` checkbox and captures `freeReleaseOptIn: boolean`.

### 4.2 Signed Upload Session & Direct PUT
- Hunter client calls `POST /api/claims/upload-url` with `ClaimSubmissionInput`.
- Server validates institution verification, Wanted `open` status, and `PUBLIC_UPLOADS_ENABLED` launch gate.
- Server returns `ClaimUploadSession` with `signedUrl`, `token`, `objectPath`, and `claimId`.
- Browser uploads file directly to Supabase Storage via `fetch(signedUrl, { method: "PUT", body: file, headers: { "Content-Type": mimeType } })`.
- Direct browser-to-storage upload ensures the Next.js runtime never handles untrusted file payloads.

### 4.3 Form Presentation States
`src/components/claim-submission-form.tsx` must handle:
- `idle`: file selector with drag-and-drop, format guidance, and rights checkbox.
- `hashing`: computing SHA-256 with animated indicator.
- `authorizing`: requesting upload session from `/api/claims/upload-url`.
- `uploading`: upload progress tracking.
- `complete`: submission confirmation with link to track claim in `/claims`.
- `error`: validation error, unsupported file type, file too large, or `UPLOAD_UNAVAILABLE` launch gate banner.

## 5. Slice C — Live Hunter Workspace & Claims Read Model

### 5.1 Hunter Claims Query
- Implement `listHunterClaims(userId)` in `src/modules/claims/services/hunter-claims-read-service.ts`.
- Queries `claims` joined with `wanted_requests` filtered by `claimant_id = userId`.
- Maps database rows to `ClaimSummary` DTOs (id, wantedId, wantedTitle, courseCode, courseName, status, submittedAt).

### 5.2 Transition `/claims/page.tsx`
- Replace `listClaims(preview)` with live `listHunterClaims` for authenticated sessions.
- Replace `listHunts(preview)` with live open Wanted requests from marketplace query.
- Retain `preview` parameter support for offline testing fixtures.
- Remove `FixtureNotice` when real authenticated data is loaded.

## 6. Global Invariants & Security Guardrails

1. **Integer Sen Currency**: All financial amounts are branded integers in sen; floating-point math is forbidden.
2. **Dual-Trust Enforcement**: Only institution-verified accounts (`capabilities.transact === true`) may fund bounties or submit claims.
3. **Untrusted Payload Isolation**: Untrusted files never touch the Next.js process or edge functions; upload is direct to the private `quarantine` bucket.
4. **Launch Gate Safeguards**: `PAYMENT_MODE=disabled` and `PUBLIC_UPLOADS_ENABLED=false` must show friendly educational banners without crashing or corrupting state.
5. **Human Moderation**: No automated process approves a claim; claims enter the queue for human Sheriff decision.
