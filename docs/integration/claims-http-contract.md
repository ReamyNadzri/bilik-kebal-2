# VAULTIX Claims and Quarantine Upload HTTP Contract

Phase 4 publishes the authenticated Claim submission and private quarantine upload boundary. Every response is an `OperationResult`: `{ ok: true, data }` or `{ ok: false, code, message, fieldErrors? }`, with `Cache-Control: private, no-store`. Claimant identity and institution always come from the Supabase session/account read; caller-supplied identity fields are discarded.

## Requesting a Signed Upload Session

`POST /api/claims/upload-url`

Creates a claim record in `uploading` state and issues a short-lived pre-signed PUT URL targeting the private `quarantine` bucket.

### Request Body

```json
{
  "wantedId": "uuid",
  "fileName": "lecture-notes.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 1048576,
  "sha256": "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
  "rightsConfirmed": true,
  "freeReleaseOptIn": false
}
```

### Constraints and Invariants

- **Actor Eligibility**: The caller must be an institution-verified, unrestricted student (`capabilities.submitClaim === true`). Unverified accounts return `INSTITUTION_VERIFICATION_REQUIRED` (403).
- **Target Wanted Status**: The target Wanted request must be in `open` status. Bounties that are expired, drafting, or already under review return `WANTED_NOT_OPEN` (409) or `WANTED_NOT_FOUND` (404).
- **Maximum File Size**: 50 MB (`52,428,800` bytes). Exceeding sizes are rejected with `FILE_TOO_LARGE` (422).
- **Permitted MIME Types**:
  - `application/pdf`
  - `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (DOCX)
  - `application/vnd.openxmlformats-officedocument.presentationml.presentation` (PPTX)
  - `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (XLSX)
  - `image/jpeg`
  - `image/png`
  - `image/webp`
  Any other type returns `UNSUPPORTED_FILE_TYPE` (422).
- **Checksum Invariant**: `sha256` must be a valid 64-character lowercase hexadecimal SHA-256 digest computed client-side using the Web Crypto API. Duplicate checksums on the same Wanted request are rejected by the database unique index.
- **Launch Gate**: If `PUBLIC_UPLOADS_ENABLED=false`, the server refuses the request with `UPLOAD_UNAVAILABLE` (503).

### Success Response (201 Created)

```json
{
  "ok": true,
  "data": {
    "claimId": "uuid",
    "objectPath": "quarantine/uuid.pdf",
    "bucket": "quarantine",
    "signedUrl": "https://<supabase-storage>/storage/v1/object/upload/sign/quarantine/...",
    "token": "opaque-storage-token",
    "expiresAt": "2026-09-22T11:15:00.000Z",
    "maxBytes": 52428800,
    "mimeType": "application/pdf"
  }
}
```

## Direct Browser-to-Storage PUT Upload

Once the signed session is obtained, the browser uploads file bytes directly to `signedUrl` via an HTTP PUT request:

```http
PUT <signedUrl>
Content-Type: <mimeType>

<binary file payload>
```

### Storage Invariants
- Untrusted file bytes **never stream or buffer through Next.js route handlers, Vercel Serverless Functions, or Supabase Edge Functions**.
- The `quarantine` bucket has no public or authenticated browser read policy. Files are isolated until screened by the scanner worker and approved by a human Sheriff.
- Upload sessions expire after 15 minutes. Attempting to upload after `expiresAt` fails at the storage gateway level.

## Hunter Workspace Read Model

### Querying Own Claims
Authenticated Hunters query their own claims via `HunterClaimsReadService`:
- Query: `claims` joined with `wanted_requests` and `courses`, filtered by `hunter_user_id = auth.uid()`.
- Protected by RLS policy `claims_read_own`.
- Status mapping:
  - `uploading` → `quarantined`
  - `screening` → `screening`
  - `needs_information` → `needs-information`
  - `under_review` → `under-review`
  - `approved` → `approved`
  - `not_selected` → `not-selected`
  - `rejected` / `withdrawn` → `rejected`

## Error Codes Reference

| Code | Status | Reason |
| --- | --- | --- |
| `AUTH_REQUIRED` | 401 | No active Supabase session. |
| `EMAIL_NOT_VERIFIED` | 403 | User has not verified their email address. |
| `INSTITUTION_VERIFICATION_REQUIRED` | 403 | User is not institution-verified. |
| `ACCOUNT_RESTRICTED` | 403 | Account is temporarily restricted. |
| `WANTED_NOT_FOUND` | 404 | Target Wanted ID does not exist. |
| `WANTED_NOT_OPEN` | 409 | Wanted is expired, reviewing, or closed. |
| `FILE_TOO_LARGE` | 422 | File payload exceeds 50 MB limit. |
| `UNSUPPORTED_FILE_TYPE` | 422 | Disallowed MIME format. |
| `VALIDATION_ERROR` | 422 | Malformed input, path traversal in filename, or missing rights. |
| `UPLOAD_UNAVAILABLE` | 503 | Public uploads disabled by launch gate. |
| `CLAIMS_UNAVAILABLE` | 503 | Transient storage or database error. |
