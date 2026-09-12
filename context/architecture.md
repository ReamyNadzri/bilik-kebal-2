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
| Scheduler | Supabase Cron (`pg_cron`) | Expiry, 48-hour release, retention cleanup, and reconciliation schedules |
| Email | Resend custom SMTP/API | Authentication and transactional email |
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
