# VAULTIX money HTTP contract (Phase 3B draft)

Money responses use `{ ok: true, data }` or `{ ok: false, code, message, fieldErrors? }` and
`Cache-Control: private, no-store`. All amount values are integer sen.

## Create a contribution bill

`POST /api/marketplace/wanted/drafts/:id/contribution`

```json
{
  "duplicateCheckToken": "opaque HMAC token from duplicate suggestions",
  "amountSen": 1250
}
```

The URL draft ID is authoritative. The server requires the authenticated Commissioner to be
institution-verified and unrestricted, verifies the duplicate token, confirms the draft is still
current, then asks the configured ToyyibPay adapter for a bill. Success is `200 BillView` with only
the safe payment URL, amount, status and expiry. A disabled kill switch returns `PAYMENT_DISABLED`
(503); missing provider configuration returns `PAYMENT_UNAVAILABLE` (503).

## ToyyibPay callback

`POST /api/payments/toyyibpay/callback`

The provider sends an `application/x-www-form-urlencoded` POST. Its payload is parsed and its
official `MD5(userSecretKey + status + order_id + refno + "ok")` hash is compared in constant time
before the trusted service-role database function is called. Invalid hashes or amounts are
`400 PAYMENT_CALLBACK_INVALID`.
Accepted and duplicate events return `200 { accepted: true, duplicate }`; rejected provider events
are acknowledged with `200 PAYMENT_PROVIDER_REJECTED` so the provider does not retry a permanently
invalid payment. An event that races ahead of its bill is retained as unresolved and returns
`503 MONEY_UNAVAILABLE`, prompting a safe retry; other temporary database failures use the same
retryable response.

The database transaction deduplicates the provider transaction ID, locks the bill, records pending
events without failing the intent, rejects amount or bill mismatches, inserts a successful
contribution and two balanced append-only ledger entries,
and marks the contribution intent paid. If this is the first confirmed contribution it changes the
Wanted from `awaiting_payment` to `open` and derives `closesAt` from the snapshotted duration. No
redirect, browser payload or callback acknowledgement can open a Wanted by itself.

`SUPABASE_SERVICE_ROLE_KEY` is required only by the server callback worker; it is never exposed to
the browser. Provider secrets, raw callback payloads and ledger account IDs are not part of public
view models or error messages.

The service-role-only `list_unresolved_provider_events` projection supports bounded, read-only
operator reconciliation. It exposes identifiers, receipt time and a reason category, never the raw
payload or a mutation shortcut; corrections remain compensating transactions.
