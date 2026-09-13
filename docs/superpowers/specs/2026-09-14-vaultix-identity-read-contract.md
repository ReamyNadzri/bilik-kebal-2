# VAULTIX Identity Read Contract — Proposal

**Date:** 2026-09-14
**Status:** Proposed by the Claude frontend lane. Not implemented. Awaiting Codex.
**Owner of the implementation:** Codex (`codex/backend`)
**Raised from:** `codex/integration-identity` at `17d47b7`

## 1. Purpose

The published identity HTTP contract exposes nine operations. Every one of them is a
`POST` mutation. The only `GET` in the application is `src/app/auth/callback/route.ts`,
which completes a Supabase OTP exchange and redirects.

Because of that, no screen can read the trust state, capabilities, institution list,
role, or review queue that its presentation depends on. Four screens therefore still
carry `FixtureNotice` and cannot be retired by integration work alone:

| Screen | Presentation input it needs | Available today |
| --- | --- | --- |
| `src/app/profile/page.tsx` | caller's trust state and capabilities | no |
| `src/app/profile/institution-verification/page.tsx` | caller's institution state, latest request, and an `institutionId` to submit | no |
| `src/app/verify-email/page.tsx` | verification outcome, and a resend operation | no |
| `src/app/console/page.tsx` | caller's console role, and a pending request queue | no |

This document proposes the missing read surface. It follows
`docs/superpowers/plans/2026-09-13-vaultix-mvp-coordination.md` §3: Claude may propose a
contract change in documentation but must not fork it in frontend code. No frontend code
was written for these operations, and the four `FixtureNotice` markers stay in place until
Codex publishes.

## 2. Why `ProfileRepository` has no implementation

`src/modules/identity/repositories/profile-repository.ts` already defines `ProfileReader`
and maps a `ProfileRecord` into a browser-safe `ProfileViewModel`. Nothing implements
`ProfileReader`, and a single-table read cannot satisfy it, because `ProfileRecord`'s four
fields live in four places:

| `ProfileRecord` field | Source |
| --- | --- |
| `displayName` | `public.profiles.display_name` |
| `emailConfirmedAt` | `auth.users.email_confirmed_at` — reachable only through the session, not `public.profiles` |
| `institutionVerificationState` | `public.institution_memberships.verification_state` |
| `hasActiveRestriction` | `public.account_restrictions` where `lifted_at is null` |

`public.profiles` holds only `user_id`, `display_name`, `created_at`, `updated_at`. A
`ProfileReader` implementation must therefore compose the session user with
`institution_memberships` and `account_restrictions`. That composition is the missing
piece, and it belongs to the identity module, not to a page.

The RLS needed for all of it already exists in
`supabase/migrations/202609140001_identity_foundation.sql`. This proposal adds no table
and no policy; it asks for a delivery layer over policies that are already in place.

## 3. Design principle: server loader first, HTTP route only where a client refreshes

`/profile`, `/profile/institution-verification`, and `/console` are Server Components.
Their first paint should not depend on a client fetch. So each view model should be
published twice, with one implementation:

1. **A server-side loader** exported from `src/modules/identity/` — awaited directly in
   the page's Server Component. This is the primary path and the one that renders.
2. **An HTTP route** returning the same view model — used only where a client component
   must re-read after a mutation (the verification form after submitting, and the console
   queue after a decision).

Both return the same `OperationResult` envelope and the same `data` shape, so a screen
re-reads with the shape it rendered with.

View models must obey §3 of the coordination plan: opaque public identifiers,
display-safe timestamps and statuses, permissions, and available actions. They must not
carry storage object keys, private URLs, provider payloads, service identifiers, or
evidence contents.

## 4. Proposed operations

### 4.1 Account view model

- **Loader:** `loadAccountViewModel(): Promise<AccountViewModel | null>`
- **Route:** `GET /api/identity/account`
- **Auth:** authenticated. `null` / `AUTH_REQUIRED` otherwise.

```ts
export interface AccountViewModel {
  displayName: string;
  trust: {
    email: "unverified" | "verified";
    institution: "unverified" | "pending" | "verified" | "rejected";
    restricted: boolean;
  };
  // Decided by the identity access policy. The frontend must never recompute these
  // from `trust` — see src/features/presentation/account-capabilities.ts.
  capabilities: {
    browseMetadata: boolean;
    transact: boolean;
    submitClaim: boolean;
    download: boolean;
  };
  institution: { id: string; name: string } | null;
  // The caller's own latest request. Drives the pending and rejected presentation on
  // the institution-verification screen. Never includes the evidence object key.
  latestVerificationRequest: {
    requestId: string;
    state: "pending" | "approved" | "rejected";
    submittedAt: string;
    decidedAt: string | null;
    reasonCode: string | null;
    evidenceDeleteAfter: string;
  } | null;
  console: { hasAccess: boolean };
}
```

`capabilities` must come from `canBrowseMetadata`, `canTransact`, `canSubmitClaim`, and
`canDownload` in `src/modules/identity/domain/access-policy.ts`, so there is exactly one
interpretation of the trust states.

`console.hasAccess` is a convenience for navigation only. It is not authorisation: the
console operations already enforce role and institution scope server-side and through
RLS, and must keep doing so.

**Retires:** the `FixtureNotice` and `EMAIL_VERIFIED_ONLY` fixture on `/profile`, and the
status half of `/profile/institution-verification`.

### 4.2 Selectable institutions

- **Loader:** `loadSelectableInstitutions(): Promise<InstitutionOption[]>`
- **Route:** `GET /api/identity/institutions`
- **Auth:** authenticated and email verified. `EMAIL_NOT_VERIFIED` otherwise.

```ts
export interface InstitutionOption {
  id: string;
  name: string;
  slug: string;
}
```

**This is the hard blocker on the evidence path.**
`VerificationService.requestManualVerification` requires `institutionId` as a UUID
(`src/modules/identity/services/verification-service.ts`), and `withTrustedFields`
injects only `userId` and `emailVerified` — so `institutionId` must come from the browser.
No operation returns one. `POST /api/identity/verify-domain` returns an `institutionId`
only on success, and the domain allowlist is deliberately empty pending the open UiTM
question, so it always refuses with `DOMAIN_NOT_APPROVED`. The UI must not invent or
hardcode a UUID, so the evidence path cannot complete until this read exists.

RLS already anticipates it: `institutions_browse_after_email_verification` permits
`select` on active institutions once the caller's email is verified.

Return only `active` institutions. Ordering is presentation's concern, but a stable
`name` ordering from the server keeps the select deterministic.

### 4.3 Sheriff review queue

- **Loader:** `loadVerificationReviewQueue(): Promise<VerificationQueueItem[]>`
- **Route:** `GET /api/identity/verification-requests?state=pending`
- **Auth:** authenticated Platform Sheriff, Owner, or Institution Sheriff.
  `NOT_AUTHORIZED` otherwise.

```ts
export interface VerificationQueueItem {
  requestId: string;
  institutionId: string;
  institutionName: string;
  // Display name only. The applicant's email address is not needed to review evidence
  // and should not be sent to the console.
  applicantDisplayName: string;
  state: "pending" | "approved" | "rejected";
  submittedAt: string;
  evidenceDeleteAfter: string;
  // No evidence_object_path. Evidence is fetched per request — see 4.4.
}
```

Scope must come from `institution_verification_requests_read`, which already limits rows
to the caller's own, platform staff, or an Institution Sheriff for that institution. An
Institution Sheriff must not receive another institution's rows.

`POST /api/identity/verification-requests/review` requires both `requestId` and
`institutionId` from the client. This queue is the only sanctioned source of that pair;
without it a Sheriff has no `requestId` to act on and the review route is unreachable.

**Retires:** the `FixtureNotice` and `VIEWER` fixture on `/console`.

### 4.4 Evidence read access for an authorised reviewer

- **Route:** `POST /api/identity/verification-requests/evidence-url`
- **Request:** `{ requestId }`
- **Success:** `{ signedUrl, expiresAt }`
- **Auth:** an authorised reviewer for that request's institution, recently
  authenticated. `NOT_AUTHORIZED` / `RECENT_AUTH_REQUIRED` / `REQUEST_NOT_FOUND`.

A Sheriff cannot decide a request without opening the evidence, and no operation issues
read access to it. `identity_evidence_read_own_or_authorised_reviewer` on
`storage.objects` already permits the read, so this is a delivery gap.

Requirements:

- The URL is short-lived. The reviewer's browser receives a time-boxed signed URL, never
  the bucket name or object key.
- The server resolves the object key from `requestId`. The client must never supply,
  receive, or be able to guess a key.
- Each issuance is written to `identity_audit_events`. Access to another person's
  identity document is a privacy event and must be attributable.
- Refuse once `evidence_delete_after` has passed rather than issuing a URL for a record
  scheduled for deletion.

### 4.5 Resend the email verification link

- **Route:** `POST /api/auth/resend-verification`
- **Request:** `{}` — the address comes from the session, never the browser.
- **Success:** `{ accepted: true }`
- **Failure:** `AUTH_RATE_LIMITED`, `AUTH_UNAVAILABLE`.

`src/components/email-verification.tsx` renders a "Resend the link" button that is wired
to nothing, and `SignInForm` sends users to `/verify-email` on `EMAIL_NOT_VERIFIED` with
copy that offers a resend. Nothing can fulfil it.

Follow the `POST /api/auth/recovery` precedent and return success regardless of whether a
resend was actually needed, so the response does not disclose account state. Rate-limit
it: it sends mail.

### 4.6 Route the verification outcome to `/verify-email`

`src/app/verify-email/page.tsx` reads `status` from the query string
(`pending | verified | expired | invalid`) because the real flow arrives from an emailed
link. `src/app/auth/callback/route.ts` never sends anyone there — it redirects to `next`
(default `/profile`) on success and `/sign-in?error=verification_failed` on any failure,
which collapses "link expired", "link already used", and "malformed link" into one
message on the wrong screen.

Proposal: for the email-confirmation OTP types, redirect to
`/verify-email?status=verified` on success and `/verify-email?status=expired` or
`?status=invalid` on failure, distinguishing expiry from an invalid token. Keep the
`recovery` type going to the password screen. The route handler is Codex-owned; the page
already accepts these values, so no frontend change is needed.

## 5. Reconciliation notes

Two existing behaviours sit awkwardly against the coordination plan. Neither is a
vulnerability today, and both are Codex's call.

1. **Object keys reach the browser.** §3 says view models never expose object keys, but
   `POST /api/identity/verification-evidence/upload-url` returns `objectPath` and the
   browser passes it back as `evidenceObjectPath`. It is guarded —
   `requestManualVerification` refuses when the path's first segment is not the caller's
   `userId`, and the insert policy repeats that check in SQL — so a caller can only
   reference its own prefix. Worth reconciling as either a documented exception for the
   signed-upload handshake, or a server-held draft token that never exposes the key.
2. **`institutionId` on review is client-supplied.** `reviewSchema` takes it from the
   browser and uses it for the authorisation check, while the
   `review_institution_verification_request` RPC takes only `target_request_id`,
   `decision`, and `reason_code`. The RPC must remain the authority and re-derive the
   institution from the request row, so that a mismatched `institutionId` cannot widen a
   reviewer's scope.

## 6. Explicitly not proposed

These stay open questions in `context/progress-tracker.md` and must not be guessed while
implementing the above:

- The official UiTM email domains. `institution_email_domains` and
  `APPROVED_INSTITUTION_DOMAINS` stay empty, and `verify-domain` keeps refusing, until
  that list is approved.
- The moderation reason-code catalogue. `reasonCode` stays a validated free string until
  the catalogue is defined.
- Any change to who may grant institution verification. It remains a recorded human
  Sheriff decision.

## 7. What the frontend lane does once this is published

No frontend work happens before then. After Codex publishes and Claude merges the
contract commit:

| Screen | Work |
| --- | --- |
| `/profile` | read `AccountViewModel` in the Server Component; delete the `EMAIL_VERIFIED_ONLY` fixture and `FixtureNotice` |
| `/profile/institution-verification` | render real status; add the institution select from 4.2; wire `verify-domain`, then `upload-url` → signed `PUT` → `verification-requests`; delete the fixture and `FixtureNotice` |
| `/verify-email` | wire the resend button to 4.5; keep reading `status` from the query string; delete `PENDING_VERIFICATION_ADDRESS` and `FixtureNotice` |
| `/console` | render the queue from 4.3; wire review and the evidence viewer from 4.4; delete the `VIEWER` fixture and `FixtureNotice` |

`callOperation` in `src/features/presentation/call-operation.ts` is `POST`-only. Extending
it to `GET` for client-side re-reads is Claude-owned work and needs no contract change.

Each of those is a separate slice with its own acceptance criteria, per
`context/ai-workflow-rules.md`.
