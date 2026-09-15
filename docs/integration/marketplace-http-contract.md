# VAULTIX Marketplace HTTP contract

Phase 3A publishes the authenticated Wanted-creation boundary. Every response is an
`OperationResult`: `{ ok: true, data }` or `{ ok: false, code, message, fieldErrors? }`, with
`Cache-Control: private, no-store`. Commissioner identity and institution always come from the
Supabase session/account read; caller-supplied identity fields are discarded.

## Taxonomy

### `GET /api/marketplace/taxonomy`

Returns `200 MarketplaceTaxonomy` for an email-verified account. Institution-owned campuses,
faculties, programmes, courses and academic sessions are scoped to the verified institution when
one exists. Resource types, languages and tags are shared reviewed configuration. An empty
catalogue is a successful empty state, not fixture permission.

Failures: `AUTH_REQUIRED` (401), `EMAIL_NOT_VERIFIED` (403), and
`MARKETPLACE_UNAVAILABLE` (503).

## Private drafts

The create and update bodies share this shape:

```json
{
  "campusId": "uuid",
  "facultyId": "uuid",
  "programmeId": "uuid",
  "courseId": "uuid",
  "academicSessionId": "uuid",
  "resourceTypeId": "uuid",
  "languageId": "uuid",
  "tagIds": ["uuid"],
  "title": "8–120 trimmed characters",
  "description": "20–2000 trimmed characters",
  "durationDays": 14,
  "policyAccepted": true
}
```

`durationDays` is exactly 7, 14 or 30. At most five distinct active tags are accepted. The server
verifies the full faculty → programme → course hierarchy and rejects inactive or
cross-institution selections.

### `POST /api/marketplace/wanted/drafts`

Returns `201 WantedDraftView`. Creation and tag attachment are one database transaction.

### `PUT /api/marketplace/wanted/drafts/:id`

Returns `200 WantedDraftView`. Only the owning Commissioner can update a `draft`; the route ID is
authoritative over any JSON field. Update and tag replacement are one database transaction.

Draft failures: `AUTH_REQUIRED` (401); `EMAIL_NOT_VERIFIED`,
`INSTITUTION_VERIFICATION_REQUIRED`, `ACCOUNT_RESTRICTED`, or `NOT_AUTHORIZED` (403);
`DRAFT_NOT_FOUND` (404); `DRAFT_NOT_EDITABLE` (409); `VALIDATION_ERROR` (422); and
`MARKETPLACE_UNAVAILABLE` (503). Missing and differently owned drafts share the same safe 404.

## Duplicate check

### `POST /api/marketplace/wanted/duplicate-suggestions`

Request: `{ "draftId": "uuid" }`.

Success is `200`:

```json
{
  "ok": true,
  "data": {
    "token": "opaque one-use token",
    "expiresAt": "ISO-8601 instant",
    "suggestions": []
  }
}
```

The token lasts 15 minutes and carries a server HMAC that prevents a browser from minting its own
check. Production requires `MARKETPLACE_TOKEN_SECRET` with at least 32 characters. Only the token's
SHA-256 hash and a hash of the current draft criteria are stored. Suggestions contain public Wanted summaries only; no private draft or Commissioner
identity is returned. The current rank favours same course, then resource type, session and
normalised title overlap. Issuing a token is not idempotent: a retry produces a new token.

## Publication intent

### `POST /api/marketplace/wanted/drafts/:id/publication`

Request:

```json
{
  "duplicateCheckToken": "opaque token from the duplicate check",
  "initialContributionSen": 1250
}
```

The route ID supplies `draftId`; browser JSON cannot override it. Money is integer sen and the
accepted range is 100–5,000. A trusted money transaction will consume the token once and freeze
the 10% fee (1,000 basis points), policy `2026-09-15.1`, requested duration and
`contributors_only` access basis while moving the draft to `awaiting_payment`.

Phase 3A deliberately installs no runtime adapter capable of that success. With the default
`PAYMENT_MODE=disabled`, the route returns `PAYMENT_DISABLED` (503) and leaves the draft editable.
Sandbox or live-limited configuration returns `PAYMENT_UNAVAILABLE` (503) until Phase 3B supplies
the verified ToyyibPay/ledger transaction. It never fabricates a bill.

Token failures are `DUPLICATE_CHECK_REQUIRED` or `DUPLICATE_CHECK_EXPIRED` (409). Reusing a
consumed token, changing the draft after the check, or using a token for another draft requires a
new duplicate check. Other draft/auth failures use the mapping above.

No Phase 3A response confirms payment, records a contribution, sets `publishedAt`, calculates
`closesAt`, or changes a Wanted to `open`. Only a verified Phase 3B provider callback may do that.

## Frontend handoff

Claude's provisional `/wanted/new` workspace can replace its fixture taxonomy and component-state
draft with the routes above. It must keep the payment refusal explicit, retain user input on all
failures, and remove each `FixtureNotice` only in the slice that removes the matching fixture
source. The development-only preview harness remains until a seeded verified identity can drive
the real route in browser tests.
