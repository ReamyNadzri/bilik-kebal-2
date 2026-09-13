# VAULTIX identity HTTP contract

These routes are the backend boundary for the provisional UI. All responses use
`{ ok: true, data }` or `{ ok: false, code, message, fieldErrors? }` and carry
`Cache-Control: private, no-store`. Browser-supplied identity fields are ignored
in favour of the authenticated Supabase session.

## Auth

| Method | Route | Request | Success |
| --- | --- | --- | --- |
| POST | `/api/auth/sign-up` | `{ displayName, email, password }` | `202 { next: "verify_email" }` |
| POST | `/api/auth/sign-in` | `{ email, password }` | `200 { next: "profile" }` |
| POST | `/api/auth/recovery` | `{ email }` | `200 { accepted: true }` |
| POST | `/api/auth/sign-out` | `{}` | `200 { signedOut: true }` |

`EMAIL_NOT_VERIFIED` is returned by sign-in until the confirmation link is
completed. Recovery deliberately returns success for unknown emails.

## Institution verification

| Method | Route | Request | Success |
| --- | --- | --- | --- |
| POST | `/api/identity/verify-domain` | `{}` (email comes from session) | `200 { institutionId, status: "verified" }` |
| POST | `/api/identity/verification-evidence/upload-url` | `{ fileName, mimeType }` | `201 { objectPath, signedUrl, token }` |
| POST | `/api/identity/verification-requests` | `{ institutionId, evidenceObjectPath }` | `201 { requestId, status: "pending", evidenceDeleteAfter }` |
| POST | `/api/identity/verification-requests/review` | `{ requestId, institutionId, decision, reasonCode }` | `200 { status: "approved" | "rejected" }` |

The automatic domain allowlist is intentionally empty until the official
institution domains are approved. The upload allowlist is PDF, JPEG, and PNG.
The server creates the object path as `<authenticated-user-id>/<uuid>.<ext>`;
the original filename is never used as a storage key. Evidence is private,
Sheriff-readable only, and retained for 30 days after the request decision.

## Account restriction

`POST /api/identity/restrictions` accepts `{ userId, reasonCode }` and returns
`{ status: "restricted" }`. Only a recently authenticated Platform Sheriff or
Owner can perform it. Institution Sheriff review is limited to its own
institution; all permission checks are server-side and repeated by RLS/RPC.

## UI integration notes

Map typed `code` values to the existing `UiStatus` states. Keep
`FixtureNotice` on a screen until that screen calls one of these routes in the
same slice; remove it at that point. A hidden navigation entry is not an access
control mechanism.
