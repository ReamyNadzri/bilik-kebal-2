# Architecture Context

## Architecture Style

VAULTIX is a Supabase-centric modular monolith. The web application is deployed as one Next.js application, but business domains are isolated behind server-side services and explicit data contracts. Supabase provides the primary managed platform. File scanning remains a separately deployable worker because untrusted 50 MB files must not be processed inside a browser, request handler, Vercel function, or short-lived Edge Function.

## Stack

| Layer | Technology | Role |
| --- | --- | --- |
| Web framework | Next.js App Router + TypeScript | Responsive student app, Sheriff Console, server-rendered pages, and server-side commands |
| UI foundation | Tailwind CSS + accessible headless primitives | Token-driven implementation of the separately supplied visual design |
| Hosting | Vercel | Preview and web deployment; Hobby is development-only and must not host a public commercial launch |
| Auth | Supabase Auth | Email/password registration, email verification, recovery, and sessions |
| Database | Supabase PostgreSQL | Source of truth for identity profile, taxonomy, bounties, claims, ledger, entitlements, moderation, and audit metadata |
| Database access | Supabase clients, SQL migrations, and typed server repositories | RLS-aware reads and transaction-safe server mutations |
| File storage | Supabase Storage, private buckets | Quarantine, approved resources, and temporary institution-verification evidence |
| Lightweight backend | Supabase Edge Functions | ToyyibPay callbacks, provider orchestration, and short idempotent tasks |
| Queue | Supabase Queues (`pgmq`) | Durable asynchronous work and retry coordination |
| Email | Brevo transactional API + custom SMTP | App notifications use the API; Supabase Auth uses separate SMTP credentials |
| Payments | ToyyibPay | Sandbox and live contribution collection |
| File screening | Isolated container worker, provider selected before public upload | Malware scan, safe conversion, text extraction, and fingerprint generation |
| Validation | Zod at TypeScript boundaries + PostgreSQL constraints | Reject malformed external input and enforce data invariants |
| Testing | Vitest + React Testing Library + Playwright + SQL/RLS tests | Unit, integration, access-control, and end-to-end verification |
| Monitoring | Structured logs, Supabase/Vercel telemetry, and error tracking | Trace requests, provider callbacks, queue health, failures, and security events |

Use current stable versions verified at implementation time and pin exact versions in the lockfile. Do not select prerelease dependencies for core financial or security paths.

## Domain Boundaries

- `identity` - account profile, verification state, institution membership, role assignments, and account restrictions.
- `taxonomy` - institutions, campuses, faculties, programmes, courses, sessions, semesters, resource types, languages, and tags.
- `wanted` - request creation, duplicate suggestions, duration, lifecycle, discovery, and bounty snapshot configuration.
- `ledger` - ToyyibPay bills/callbacks, contributions, provider charges, platform fee snapshots, refunds, chargebacks, and reconciliation.
- `claims` - upload sessions, claim metadata, file evidence, duplicate matches, and claim lifecycle.
- `moderation` - Sheriff queues, decisions, reason codes, reports, appeals, restrictions, and sanctions.
- `entitlements` - contributor access, signed downloads, free-release scheduling, and revocation.
- `payouts` - manual payout task, Owner release record, evidence, and future provider adapter.
- `notifications` - in-app events, email delivery, retries, and user preferences where allowed.
- `audit` - append-only security, finance, access, configuration, and moderation events.

### Notification inbox foundation (2026-09-23)

The backend notification slice defines recipient-only inbox storage with RLS,
authenticated cursor-paginated reads and idempotent mark-read operations. Trusted
event consumers enqueue by stable event ID and recipient; conflicting replays
fail. Payloads contain event kinds and opaque identifiers, with fixed English
copy supplied by the notification contract. Staff have no inbox visibility bypass.
New inbox endpoints emit allowlisted operational logs and generated correlation IDs.
An unapplied follow-up migration adds domain-owned publishers for recorded claim
reviews and new account restrictions. They call the enqueue contract in the same
transaction, using recorded review/restriction UUIDs and server-derived recipients.
No historical backfill or settlement side effect is introduced. A further
unapplied migration creates one transactional email-outbox job per new inbox
notification. The server-only dispatcher uses the Brevo API, fixed contract copy,
recipient verification, leases, bounded retries, stable idempotency keys and manual
review after the provider's 15-minute deduplication window. Supabase Auth messages
(confirmation, recovery and verification) use Brevo SMTP configured in Supabase
Auth settings; this requires a separate Brevo SMTP key, not the API key used by
the app dispatcher. Outbox email,
recipient addresses, provider messages and service credentials are never exposed
through the inbox API or logs. The dispatcher endpoint exists but has not been
scheduled or deployed. A frontend inbox exists in an isolated worktree but has
not yet been integrated; lifecycle schedules remain unconnected.
Supabase Cloud is the active environment;
validate the migration and access-control tests in a designated cloud test
environment before rollout. No cloud database changes have been performed by this slice.

### Branded auth and notification emails (2026-09-25)

- Auth mail stays with Supabase Auth over Brevo SMTP. Its confirmation and recovery templates are
  generated from `src/modules/notifications/email/auth-email-templates.ts` into
  `supabase/templates/*.html` (a test fails if they drift) and pasted into the hosted project.
- Emailed links open `/auth/confirm`, which only renders a button. The one-time token is spent by
  `POST /api/auth/confirm` (`verifyOtp` with `token_hash`), so link scanners such as Microsoft
  Defender Safe Links cannot use it up. Accepted types are `email` and `recovery`; recovery sets the
  existing password-recovery grant cookie. A provider outage returns to the page with the token
  unspent. `/auth/callback` keeps handling PKCE codes and older links.
- Notification mail keeps the outbox and Brevo API path, now sending HTML and plain text rendered
  by `react-dom/server` from one content model (`src/modules/notifications/email/`). Colours are
  literals mirrored from the provisional tokens and checked against `globals.css` by a test.
- `private.notification_email_context` supplies allow-listed per-kind values through
  `claim_notification_email_batch`: requester display name and institution name for
  `institution_verification_submitted`, and the live `WELCOME` credit count for `welcome` (omitted
  once the code is inactive, expired or used up). The repository strips any other key.
- `institution_verification_submitted` goes to every platform Sheriff and the institution's
  Sheriffs, never the requester. `welcome` is enqueued once per user when the email is first
  confirmed; the trigger on `auth.users` swallows its own errors so it can never block sign-up.

Modules may share identifiers and published domain events, but they must not reach into one another's internal tables or bypass the owning service's invariants.

## Expected Project Boundaries

- `src/app/` - Next.js routes, layouts, server-rendered pages, and thin route handlers.
- `src/modules/` - domain modules listed above; each contains schemas, service logic, repositories, policies, and tests.
- `src/components/` - product-level reusable components; visual values come from UI tokens.
- `src/components/ui/` - generated or primitive UI components; wrappers belong outside this folder.
- `src/lib/` - narrowly scoped infrastructure clients, configuration, logging, money/time utilities, and shared types.
- `supabase/migrations/` - append-only ordered schema, function, trigger, RLS, queue, and cron migrations.
- `supabase/functions/` - thin Edge Functions for callbacks and lightweight orchestration.
- `workers/scanner/` - isolated file-screening consumer; never imported into the web runtime.
- `tests/e2e/` - cross-module browser and provider-contract tests.

These folders are the intended structure and will be created only after the implementation plan is approved.

## Storage Model

- **PostgreSQL**: structured records, ownership, configuration snapshots, lifecycle states, financial ledger, provider references, moderation decisions, entitlements, notification state, and audit events.
- **Supabase Storage `quarantine`**: private unapproved uploads. Users never receive a direct storage URL.
- **Supabase Storage `approved`**: private approved originals and safe derivatives. Access requires an entitlement or public-release rule and a short-lived signed URL.
- **Supabase Storage `verification-evidence`**: private evidence for manual institution verification, with restricted Sheriff access and automatic retention cleanup.
- **Supabase Storage `avatars`**: the only public bucket. Holds 512 px WebP profile pictures re-encoded in the browser (camera metadata dropped), at most 512 KB, one folder per member's `public_id`, written only by the owner through RLS.
- **`wanted_replies`**: text replies on missing-item and discussion requests; readable wherever the request is readable, written only by institution-verified members through `post_wanted_reply`. Reply notifications are in-app only and never emailed.
- **`reward_codes` / `reward_code_redemptions`**: Owner-created codes that add free requests; redemptions are unique per code and member, and failed attempts are rate limited (10 per hour).
- **`taxonomy_requests`**: member requests for new taxonomy entries; a Sheriff approval inserts the entry and notifies the member (in-app and email).
- **`community_payout_requests`**: the poster of a paid missing item or discussion names the finder; a Sheriff (never a party to it) approves, which creates a `payout_tasks` row with no claim. `payout_tasks` now references exactly one of a claim or a community payout request.
- **Queue tables**: durable operational messages; payloads contain identifiers, never raw file bodies, secrets, or unnecessary personal data.

Database records store `storage_provider`, `bucket`, `object_key`, checksum, size, MIME type, and lifecycle state rather than public URLs. This permits a later hybrid migration to Cloudflare R2. New uploads can switch provider through configuration; migrations copy, verify the checksum, update the record transactionally, and only then delete the old object.

## Auth and Access Model

- Every account registers with email/password and must verify its email.
- Email verification proves control of an address; it does not grant a star emblem or transaction rights.
- Institution verification is automatic only for approved UiTM domains or manual after private evidence review.
- Email-verified users may browse public Wanted metadata.
- Institution-verified users may create/fund Wanted requests, submit claims, and receive entitled downloads.
- A single student account may act as Commissioner, Backer, and Hunter.
- The star emblem indicates verified institution affiliation only and includes explanatory text.
- `Owner` has global configuration, payment-mode, manual payout, and manual refund authority.
- `Platform Sheriff` has cross-institution moderation authority.
- `Institution Sheriff` is restricted to assigned institutions.
- Review and finance permissions are granular even when both appear in the Sheriff Console.
- Sensitive Owner/Sheriff operations require recent authentication. MFA is required before public production launch.
- RLS is enabled on every user-facing table and private storage bucket. Service-role credentials never reach the browser.

## Money and Provider Flow

1. The server creates a ToyyibPay bill with an unguessable internal reference and a snapshotted expected amount.
2. A signed/verified provider callback is treated as a delivery attempt, not as unquestioned truth.
3. The callback is stored, deduplicated by provider identifiers, validated against the expected bill, and reconciled through a provider status lookup where necessary.
4. A successful contribution creates balanced, immutable ledger entries in one database transaction and publishes an outbox event.
5. Original financial entries are never edited or deleted. Refunds, fees, chargebacks, and corrections use compensating entries.
6. Claim approval calculates the 10% fee from the bounty snapshot and creates one manual payout task.
7. The Owner records the external payout or refund reference and evidence. Marking a task paid/refunded creates ledger entries and notifications.

Payment mode is one of `disabled`, `sandbox`, or `live_limited`. Sandbox and live secrets are separate. Live mode requires configured callbacks, provider health checks, a tester allowlist, recent Owner authentication, and an audit event. A kill switch must disable new bills without corrupting pending callbacks.

## Claim and File Flow

1. The server validates claim eligibility and creates a short-lived signed upload session for an allowlisted MIME/type and size of at most 50 MB.
2. The client uploads directly to private quarantine storage.
3. Completion records the object checksum and sends an identifier-only message to the screening queue.
4. The isolated worker validates signature, scans for malware, rejects prohibited/encrypted/macro-enabled content, creates safe derivatives, extracts text/metadata, and calculates fingerprints.
5. Exact known duplicates may be blocked. Near matches and policy signals become reviewer evidence only.
6. A Sheriff decision publishes one idempotent event. Approval closes the bounty, grants entitlements, schedules optional release, and creates one payout task.
7. Raw unreviewed content must not enter application logs, analytics, email, or notification payloads.

## Retention

- Incomplete draft upload objects: 24 hours.
- Rejected claim files: 30 days after the final decision/appeal window.
- Quarantined files: 90 days or until the investigation is formally closed, whichever is later.
- Institution-verification evidence: 30 days after the final decision/appeal period.
- Approved resources: retained while an entitlement or valid release obligation exists; not deleted merely to remain within a free tier.
- Ledger, payout/refund, moderation, and audit metadata: retained according to the approved legal retention schedule and never deleted by file cleanup jobs.

## Invariants

1. No contribution changes the bounty until a provider event is verified and processed exactly once.
2. Money is represented as integer sen; floating-point arithmetic is forbidden for financial values.
3. Financial history is append-only. Corrections use compensating entries.
4. No claim can create an entitlement or payout without a recorded human Sheriff approval.
5. Exactly one winning claim may fulfil a bounty; submission time is only a tie-breaker for equally suitable claims.
6. Every successful contributor receives at most one entitlement for the fulfilled bounty.
7. Unverified file content remains private and quarantined.
8. Near-duplicate or automated policy signals cannot independently reject or approve content.
9. Public/free release requires Hunter opt-in and Sheriff-confirmed rights; otherwise access remains contributor-only.
10. Provider callbacks, queue jobs, scheduled jobs, entitlement creation, payout creation, and notification sends are idempotent.
11. Role and institution scope are checked server-side and through RLS; hiding a UI control is never access control.
12. Secrets, service-role keys, raw bank details, and private file URLs never reach client bundles or logs.
13. Public uploads remain disabled until a production isolated scanning worker passes readiness checks.
14. Vercel Hobby and other development-only free tiers are not used for a public commercial launch when their terms or reliability controls do not permit it.
