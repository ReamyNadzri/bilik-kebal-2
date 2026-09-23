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
| POST | `/api/auth/reset-password` | `{ password }` | `200 { updated: true }` |
| POST | `/api/auth/sign-out` | `{}` | `200 { signedOut: true }` |
| POST | `/api/auth/resend-verification` | `{}` | `202 { accepted: true }` |

`EMAIL_NOT_VERIFIED` is returned by sign-in until the confirmation link is
completed. Recovery deliberately returns success for unknown emails.
Sign-up and an unverified sign-in store the normalized address in a signed,
HTTP-only, one-hour pending-verification cookie. Resend reads only that cookie;
the browser cannot select a recipient in the resend request. Production must
set `IDENTITY_PENDING_COOKIE_SECRET` to at least 32 characters.

Email confirmation callbacks redirect to `/verify-email?status=verified`.
Expired OTP/PKCE flow state redirects to `status=expired`; malformed or invalid
links redirect to `status=invalid`. Recovery links exchange through
`/auth/callback` and redirect to `/reset-password`. A short-lived, signed,
HTTP-only recovery grant is bound to the authenticated user and required by the
password-update operation. Invalid or expired grants return
`RECOVERY_LINK_INVALID`; a successful update consumes the grant.

## Brevo Auth SMTP setup walkthrough

Supabase Auth sends confirmation, resend, recovery, and built-in security
notifications through SMTP. This is separate from the app's Brevo API sender.
The direct Brevo API smoke email does not verify this configuration.

1. In Brevo, open **Settings → SMTP & API → SMTP**. Create or copy the SMTP
   login and generate an SMTP key. Use the displayed SMTP login and SMTP key;
   do not use the Brevo API key as the SMTP password.
2. In Supabase Dashboard, open the project's **Authentication** email/SMTP
   settings and enable custom SMTP. Enter host `smtp-relay.brevo.com`, port
   `587`, the SMTP login shown by Brevo, the SMTP key, sender
   `noreply@bilikkebal.afes.my`, and sender name `VAULTIX`.
3. In Supabase Auth URL configuration, set the production Site URL to
   `https://bilikkebal.afes.my` and add the exact redirect
   `https://bilikkebal.afes.my/auth/callback`. Add
   `http://localhost:3000/auth/callback` only when local callback testing is
   needed. Do not use a broad wildcard redirect.
4. Keep the confirmation and recovery templates' Supabase confirmation URL
   token intact (`{{ .ConfirmationURL }}`). The application's recovery request
   supplies the callback URL and recovery intent. Configure the built-in
   password/email-change security notification templates if those events are
   enabled in the Auth settings.
5. Save the SMTP settings, then test with an account/email you control: request
   signup verification, resend verification, and password recovery. Confirm
   each email arrives and links back to the matching VAULTIX screen. Then set a
   new password and verify sign-in with it. Check Spam and Brevo's transactional
   logs if delivery is delayed.

SMTP credentials belong only in Supabase Auth settings, not in Vercel app
environment variables or browser code. Supabase redirect URLs must match the
configured allow-list. Automated tests use synthetic identities and never send
real email.

## Institution verification

| Method | Route | Request | Success |
| --- | --- | --- | --- |
| POST | `/api/identity/verify-domain` | `{}` (email comes from session) | `200 { institutionId, status: "verified" }` |
| POST | `/api/identity/verification-evidence/upload-url` | `{ fileName, mimeType }` | `201 { objectPath, signedUrl, token }` |
| POST | `/api/identity/verification-requests` | `{ institutionId, evidenceObjectPath }` | `201 { requestId, status: "pending", evidenceDeleteAfter }` |
| POST | `/api/identity/verification-requests/review` | `{ requestId, institutionId, decision, reasonCode }` | `200 { status: "approved" | "rejected" }` |
| GET | `/api/identity/account` | — | `200 AccountViewModel` |
| GET | `/api/identity/institutions` | — | `200 InstitutionOption[]` |
| GET | `/api/identity/verification-requests?state=pending` | — | `200 VerificationQueueItem[]` |
| POST | `/api/identity/verification-requests/evidence-url` | `{ requestId }` | `200 { signedUrl, expiresAt }` |

The automatic domain allowlist is intentionally empty until the official
institution domains are approved. The upload allowlist is PDF, JPEG, and PNG.
The server creates the object path as `<authenticated-user-id>/<uuid>.<ext>`;
the original filename is never used as a storage key. Evidence is private,
Sheriff-readable only, and retained for 30 days after the request decision.
Reviewer evidence URLs last five minutes. The RPC resolves the private object
path from `requestId`, enforces institution scope and recent authentication,
rejects expired evidence, and appends an audit event. Neither the queue nor the
evidence response exposes the object path.

`AccountViewModel.capabilities` is produced by the canonical identity access
policy and must be consumed as-is by presentation code. The account view also
contains the latest request, institution display data, and navigation-only
`console.hasAccess`. Server Components should prefer the exported
`loadAccountViewModel`, `loadSelectableInstitutions`, and
`loadVerificationReviewQueue` loaders for first paint.

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

The signed-upload handshake is the narrow exception to the general rule that
view models do not expose storage keys: it returns an owner-prefixed
`objectPath` so the browser can complete the direct upload and submit the same
path. The service and RLS independently enforce that prefix. Read models and
review operations never expose storage keys.
