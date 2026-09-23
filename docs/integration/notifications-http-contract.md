# Notification inbox API

Owner: Codex backend. Inbox, recorded-event publishers and email-outbox delivery
are implemented in this branch but migrations remain unapplied and the dispatcher
is not scheduled/deployed. Verify in an approved isolated test environment before
integration; do not use the shared Supabase Cloud for persistent test writes.

- `GET /api/notifications?limit=20&cursor=<opaque>` lists the signed-in recipient's
  inbox. Limit is 1–50. Omit cursor for the first page; use `data.nextCursor` for
  subsequent pages until null. Do not construct or parse cursor values in the UI.
- `PATCH /api/notifications` with `{ "id": "<notification UUID>" } marks a
  notification read. Repeating this preserves the initial read timestamp.
- No browser operation creates notifications, chooses recipients, or sends email.
- `POST /api/internal/notifications/email` drains up to 20 due outbox jobs and
  returns safe counts only. It requires the service-role key as a Bearer token,
  has no request body, and is for a trusted scheduler/operations caller only.
  Never call this endpoint from browser code or expose the service-role key. It
  has not been scheduled or deployed. The response never includes recipients or
  provider error details. Counts are `claimed`, `sent`, `retried`, `manualReview`
  and `failed`.

Both operations return the `OperationResult` envelope. List data is `{ items,
nextCursor }`; mark-read data is `{ read: true }`. Item types and English copy are
published in `src/contracts/notifications.ts`.

Errors: 401 `AUTH_REQUIRED`, 400 `VALIDATION_ERROR`, 404 `REQUEST_NOT_FOUND` for
missing/inaccessible mark-read targets, 503 `NOTIFICATIONS_UNAVAILABLE`.
Every response is `private, no-store` and carries a server-generated
`X-Correlation-ID`. These IDs identify operations, never users or files.

Frontend follow-up: inbox list, read/unread state, pagination, loading, empty,
failure, expired-session and offline states, accessible keyboard controls at
360px. Do not advertise a download or completed settlement from claim approval.

Trusted owning-domain consumers call `enqueue_notification` only after a recorded
event. Supply a stable event UUID, server-derived recipient UUID, supported event
kind and opaque subject UUID. The same event/recipient is delivered to the inbox
once; conflicting data is rejected. No titles, review notes, addresses, file
content, bank information or signed URLs belong in the payload.

New inbox rows create one email-outbox row transactionally. The private outbox
uses a two-minute lease, bounded exponential retry, and the notification UUID as
the stable Brevo idempotency key. Brevo retains transactional API idempotency keys
for 15 minutes; this system stops automatic retries at 14 minutes and moves
unresolved jobs to manual review. The worker fetches only verified recipient email at send
time. Failure states are persisted, but no operator read UI exists yet.

The app dispatcher uses a server-only `BREVO_API_KEY`. Supabase Auth handles
signup confirmation and password recovery separately; configure its custom SMTP
settings with Brevo host `smtp-relay.brevo.com`, port `587`, the Brevo SMTP login,
and an SMTP key (not the API key). Configure an authenticated sender in Brevo
first. These external settings have not yet been changed; until then, Auth email
delivery continues to depend on the current Supabase project configuration.
