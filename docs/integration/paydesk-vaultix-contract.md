# Paydesk ↔ VAULTIX integration contract (v1)

Status: **accepted for implementation, not implemented.** Design and reasons:
[`docs/superpowers/specs/2026-10-10-vaultix-paydesk-design.md`](../superpowers/specs/2026-10-10-vaultix-paydesk-design.md).

Two server-to-server channels. No browser ever calls these endpoints.

| Direction | Caller | Receiver | Purpose |
| --- | --- | --- | --- |
| A | VAULTIX server | Paydesk `/api/v1/…` | Create, read and cancel payment requests; mint pay links |
| B | Paydesk outbox | VAULTIX `/api/payments/paydesk/events` | Report decisions and proof receipt |

## 1. Conventions

- JSON, UTF-8, `Content-Type: application/json`. Paydesk refuses unknown fields in direction A
  request bodies (400). VAULTIX ignores unknown fields inside event `data` (direction B), so
  Paydesk can add optional event fields without breaking it.
- Money is integer sen in fields ending `Sen`. Currency is always `"MYR"`.
- Times are UTC ISO 8601 with `Z`.
- Identifiers are UUID strings unless stated.
- Every response body is the VAULTIX `OperationResult` envelope:

  ```json
  { "ok": true, "data": { } }
  ```

  ```json
  { "ok": false, "code": "VALIDATION_FAILED", "message": "Safe English sentence.", "fieldErrors": { "amountSen": ["Must be between 100 and 5000."] } }
  ```

  `fieldErrors` appears only on 400. `message` never contains secrets, stack traces or personal
  data.
- Responses carry `Cache-Control: no-store`.

## 2. Signing (both directions)

Each direction has its own secret per environment. Configure them as:

| Variable | Held by | Used for |
| --- | --- | --- |
| `PAYDESK_API_KEY_ID`, `PAYDESK_API_SECRET` | VAULTIX (signs) and Paydesk (verifies) | Direction A |
| `PAYDESK_EVENTS_KEY_ID`, `PAYDESK_EVENTS_SECRET` | Paydesk (signs) and VAULTIX (verifies) | Direction B |

Secrets are at least 32 random bytes, stored only in server environment variables, never logged.

Headers on every request:

| Header | Value |
| --- | --- |
| `X-Signature-Key-Id` | The key id |
| `X-Signature-Timestamp` | Unix time in seconds |
| `X-Signature-Nonce` | A fresh UUID v4, never reused, including on retries |
| `X-Signature` | `base64url(HMAC-SHA256(secret, canonical))` without padding |

`canonical` is these six lines joined with `\n` (no trailing newline):

```text
v1
<HTTP method, upper case>
<path and query exactly as sent, e.g. /api/v1/payment-requests>
<X-Signature-Timestamp>
<X-Signature-Nonce>
<lower-case hex SHA-256 of the raw body bytes>
```

For an empty body the digest is
`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.

The receiver refuses with **401 `AUTH_INVALID`** if the key id is unknown, the signature does
not match (compare in constant time), or the timestamp is more than 300 seconds from its clock.
It refuses with **409 `REPLAYED`** if it has seen the nonce in the last 15 minutes. It may accept
two key ids at once during a rotation.

Test vector (secret `test-secret-do-not-use`):

```text
method     POST
path       /api/v1/payment-requests
timestamp  1760083200
nonce      5f0c2a7e-2b1d-4c3e-9a8b-1d2e3f405060
body       {"vaultixIntentId":"00000000-0000-4000-8000-000000000001","purpose":"back","amountSen":1000}
digest     cb0203a66f06cdb664cde6cfee2d03642ab7b1b6b0f6c41709652ac0531fe2d3
signature  nwQGme2zeUsM5dFm8B38BV0MOu7y-QmFOsvRSXhcEOY
```

(The body in the vector is shortened to test signing only; it is not a valid create body.)

## 3. Direction A: VAULTIX → Paydesk

Base URL: `PAYDESK_BASE_URL` in VAULTIX's environment.

### 3.1 Create a payment request

`POST /api/v1/payment-requests`

```json
{
  "vaultixIntentId": "00000000-0000-4000-8000-000000000001",
  "purpose": "back",
  "amountSen": 1000,
  "currency": "MYR",
  "wanted": {
    "id": "00000000-0000-4000-8000-000000000009",
    "title": "Past year papers for MAT183",
    "url": "https://bilikkebal.site/wanted/00000000-0000-4000-8000-000000000009"
  },
  "payerRef": "pr_3b9f0c…",
  "policyVersion": "2026-10-10"
}
```

| Field | Rule |
| --- | --- |
| `vaultixIntentId` | VAULTIX's contribution intent id. **Idempotency key.** |
| `purpose` | `"publish"` (first funding of a private draft) or `"back"` (adding to an open Wanted). |
| `amountSen` | Integer 100–5000. The full amount the member types (no fee added). |
| `wanted.title` | 1–160 characters, shown to the member. |
| `wanted.url` | HTTPS URL on the VAULTIX origin. |
| `payerRef` | Opaque, stable per VAULTIX member, not reversible to a name or email (VAULTIX uses an HMAC of the user id). Used only for the self-approval rule. |
| `policyVersion` | The Wanted's snapshotted policy version. |

Responses:

- **201** first creation, **200** the same body again: `{"ok":true,"data":{"requestId":"…","status":"awaiting_payment","version":1}}`
- **409 `IDEMPOTENCY_CONFLICT`**: the same `vaultixIntentId` with a different body.
- **400 `VALIDATION_FAILED`**, **401**, **409 `REPLAYED`**, **429 `RATE_LIMITED`**, **503 `UNAVAILABLE`**.
- **503 `COLLECTION_DISABLED`**: Paydesk's kill switch is on.

VAULTIX retries 503 and timeouts with the same body; the idempotency key makes that safe.

### 3.2 Mint a pay link

`POST /api/v1/payment-requests/{requestId}/links` with an empty JSON object `{}`.

**201** `{"ok":true,"data":{"url":"https://<paydesk>/pay/<token>","expiresAt":"2026-10-11T08:00:00Z"}}`

The token is 32 random bytes, base64url. Links last 24 hours; each call mints a new one and
earlier unexpired links keep working. A link also works after the request is decided, to show
its status. **404 `REQUEST_NOT_FOUND`** for an unknown id. VAULTIX redirects the member to `url`
at once and never stores or logs it.

### 3.3 Read a request

`GET /api/v1/payment-requests/{requestId}`

**200**

```json
{
  "ok": true,
  "data": {
    "requestId": "…",
    "vaultixIntentId": "…",
    "status": "checking",
    "version": 3,
    "amountSen": 1000,
    "proofCount": 1,
    "confirmation": null,
    "updatedAt": "2026-10-10T07:42:00Z"
  }
}
```

`status` is one of `awaiting_payment`, `checking`, `needs_information`, `rejected`, `exception`,
`confirmed`, `cancelled`. When confirmed, `confirmation` is
`{"amountSen":1000,"providerReference":"…","confirmedAt":"…"}`. Used by VAULTIX for
reconciliation; events (§4) remain the trigger for money.

### 3.4 Cancel a request

`POST /api/v1/payment-requests/{requestId}/cancel` with `{"reason":"draft_changed"}`. Reasons:
`draft_changed`, `wanted_closed`, `member_cancelled`.

- **200** cancelled (or already cancelled).
- **409 `REQUEST_NOT_CANCELLABLE`** if any proof exists or it is decided. Money may exist; VAULTIX
  must keep the request and wait for its decision.

## 4. Direction B: Paydesk → VAULTIX events

`POST /api/payments/paydesk/events` on `VAULTIX_BASE_URL`, signed with the events secret.

```json
{
  "eventId": "6a1f…",
  "type": "payment.confirmed",
  "occurredAt": "2026-10-10T07:51:00Z",
  "requestId": "…",
  "vaultixIntentId": "…",
  "requestVersion": 4,
  "data": { }
}
```

| `type` | `data` | VAULTIX does |
| --- | --- | --- |
| `payment.proof_received` | `{"proofVersion":1}` | Shows "checking" to the member. No money change. |
| `payment.confirmed` | `{"amountSen":1000,"currency":"MYR","providerReference":"…","confirmedAt":"…","decisionId":"…"}` | Records the contribution exactly once (publishes a first-payment Wanted or raises the bounty), then a receipt notification and email. |
| `payment.needs_information` | `{"reasonCode":"unreadable","message":"…","nextStep":"…","decisionId":"…"}` | Notifies the member with the message and next step. No money change. |
| `payment.rejected` | same shape as above | Same. No money change. |
| `payment.exception` | `{"decisionId":"…"}` | Notifies: "Your payment needs resolving. You do not need to pay again." No money change. |

Rules for VAULTIX:

- Store each `eventId` once (unique). A repeat returns
  `{"ok":true,"data":{"processed":true,"duplicate":true}}` and does nothing else.
- `payment.confirmed` must match the intent: same `amountSen`, currency `MYR`, intent still
  pending. If it does not, record the event, do not post money, and alert the Owner (D3/D5 in the
  design). Never treat a mismatch as a failed payment.
- `providerReference` is private financial data: never shown on public pages, logged in full, or
  sent in member email.
- Events can arrive late or out of order. Use `requestVersion` to ignore an older status update;
  `payment.confirmed` always wins once processed.

Responses: **200** `{"ok":true,"data":{"processed":true,"duplicate":false}}`. 401 and 409
`REPLAYED` as in §2. 400 for an unknown type or bad body. 500 or 503 when VAULTIX cannot process
now.

Paydesk delivery: retry on timeout, 429 and 5xx with exponential backoff (30 s doubling, capped
at 1 hour) for 72 hours, same `eventId` and body, fresh nonce and signature each attempt. A 400 or
401, or 72 hours of failures, moves the event to a dead-letter list shown to Paydesk admins.
Events for one request are delivered in order.

## 5. Error codes

| Code | HTTP | Meaning |
| --- | --- | --- |
| `VALIDATION_FAILED` | 400 | Body or parameter invalid; see `fieldErrors`. |
| `AUTH_INVALID` | 401 | Unknown key, bad signature or stale timestamp. |
| `REQUEST_NOT_FOUND` | 404 | No such request. |
| `REPLAYED` | 409 | Nonce already seen. |
| `IDEMPOTENCY_CONFLICT` | 409 | Same idempotency key, different body. |
| `REQUEST_NOT_CANCELLABLE` | 409 | Proof exists or request decided. |
| `RATE_LIMITED` | 429 | Too many calls; retry later. |
| `COLLECTION_DISABLED` | 503 | Kill switch on. |
| `UNAVAILABLE` | 503 | Temporary failure; retry. |

## 6. Change control

This is v1. Compatible changes: a new optional field in event `data`, and a new event type
(VAULTIX answers an unknown type with 200 and `processed: false`). A new field in a direction A
body is compatible only after Paydesk has deployed support for it, because Paydesk refuses
unknown fields. Anything else is a v2 with a new path, agreed by both builders and recorded in
both apps' docs.
