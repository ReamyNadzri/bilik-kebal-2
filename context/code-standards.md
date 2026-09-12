# Code Standards

## General

- Keep modules small, cohesive, and owned by one domain boundary.
- Fix root causes; do not hide inconsistent state with UI workarounds.
- Prefer explicit state machines and policy functions over scattered booleans.
- Separate pure business rules from framework, provider, and storage code.
- Make every external integration replaceable through a narrow typed adapter.
- Optimise for correctness and traceability before convenience in money, access, moderation, and file paths.
- Never log secrets, raw private documents, verification evidence, bank information, or unnecessary personal data.

## TypeScript

- Enable strict mode and all practical strictness flags.
- Do not use `any`. Use `unknown` at untrusted boundaries and narrow it through validation.
- Validate browser input, provider payloads, environment variables, queue messages, and database results where trust changes.
- Use discriminated unions for lifecycle states and exhaustive `never` checks.
- Represent money as branded integer-sen values; format currency only at the presentation edge.
- Represent timestamps as UTC instants in storage and convert only for display.
- Avoid non-null assertions except after a locally demonstrated invariant.

## Next.js

- Default to Server Components. Add `use client` only for browser interaction.
- Pages and route handlers remain thin; business rules live in domain services.
- Server Actions and route handlers must authenticate, authorise, validate, execute one command, and return a typed result.
- Never call a privileged Supabase client from browser code.
- Do not process or proxy large file bodies through Next.js; use signed direct uploads.
- Explicitly choose caching behaviour for every data read. User-specific and financial data must not enter shared caches.
- Error boundaries must not expose provider responses, stack traces, secrets, or private metadata.

## Supabase and PostgreSQL

- Every schema change is an ordered migration committed to `supabase/migrations/`.
- Never edit an applied migration; add a corrective migration.
- Enable RLS on every user-facing table and private storage bucket.
- Test RLS for anonymous, email-verified, institution-verified, institution Sheriff, Platform Sheriff, and Owner access.
- Use database constraints for amounts, allowed transitions, uniqueness, foreign keys, and exactly-one relationships.
- Use transactions for multi-record money, approval, entitlement, outbox, and reconciliation changes.
- Do not expose internal queue schemas or privileged database functions to browser roles.
- Use security-definer functions only when necessary, set a safe `search_path`, revoke default access, and test authorisation inside the function.

## State and Events

- Define permitted transitions centrally for bounty, claim, report, appeal, payout, refund, contribution, verification, and entitlement states.
- Record actor, timestamp, previous state, new state, reason code, correlation ID, and relevant policy/configuration version.
- Use transactional outbox records when a committed database change must trigger asynchronous work.
- Queue payloads contain stable identifiers and versioned schemas, not full domain objects.
- Consumers acknowledge a message only after durable success.
- Retries use bounded exponential backoff and route exhausted work to an operator-visible failure state.

## Payments and Ledger

- Treat redirects as user experience only; only a verified callback/status lookup may confirm payment.
- Verify provider signatures/hashes, expected amount, internal reference, environment, and provider transaction identity.
- Store raw provider payloads only after redacting secrets and personal data, with restricted access and retention.
- Enforce unique provider event and transaction identifiers.
- Ledger entries are immutable and balanced. Never update a paid amount in place.
- Platform fee rate and applicable policy are snapshotted when the Wanted request is published.
- Payout/refund completion requires external reference, actor, timestamp, amount, and audit event.
- Never infer a successful payout or refund from a button click alone.

## Files and Storage

- Allow only PDF, DOCX, PPTX, XLSX, JPG, PNG, and WEBP, with a server-enforced 50 MB maximum.
- Validate extension, declared MIME, detected signature, readability, encryption, and macro status.
- Generate object keys server-side; never trust user filenames as storage paths.
- Keep original filenames as sanitised display metadata only.
- Use private buckets and short-lived signed URLs.
- Verify checksum before changing storage provider or lifecycle location.
- Untrusted-file parsing, rendering, and malware scanning run only in the isolated scanner worker.
- Automated risk or similarity results are evidence, never final moderation decisions.

## Styling and Accessibility

- Use semantic CSS variables defined by the approved `ui-context.md`; no final hardcoded colours.
- Do not imitate protected Red Dead Redemption assets or trade dress.
- Preserve semantic HTML before adding ARIA.
- Every interactive element supports keyboard operation and visible focus.
- Do not encode meaning using colour, pixel art, or icons alone.
- Test 360 px layouts and reduced-motion behaviour.

## API and Result Shapes

- Use a consistent success/error envelope with stable machine codes and safe human messages.
- Do not expose internal IDs where an opaque public identifier is appropriate.
- Use cursor pagination for growing boards, queues, audit histories, and notifications.
- Rate-limit authentication, Wanted creation, contributions, upload sessions, reports, and sensitive Owner actions.
- Use correlation IDs across web requests, Edge Functions, provider callbacks, queue jobs, and audit events.

## Testing

- Write unit tests for money, lifecycle, access, fee, expiry, selection, retention, and policy rules.
- Write integration tests for SQL constraints, transactions, RLS, queues, cron functions, and provider adapters.
- Use recorded/synthetic ToyyibPay contract fixtures; never call live payment endpoints in ordinary automated tests.
- Write end-to-end tests for registration, verification, create/fund, claim/review, entitlement, payout/refund recording, report, appeal, and takedown.
- Test duplicate callbacks, reordered events, worker crashes, timeouts, partial failures, and retries.
- Security tests must cover cross-user, cross-institution, signed-URL expiry, service-key exposure, malicious filenames, and unsupported files.

## File Organisation

- `src/app/` - delivery layer only.
- `src/modules/<domain>/` - domain types, policies, services, repositories, adapters, and tests.
- `src/components/` - product components and layouts.
- `src/components/ui/` - generated/accessibility primitives; do not hand-edit generated files unless explicitly required.
- `src/lib/` - small cross-cutting infrastructure utilities.
- `supabase/migrations/` - append-only migrations and RLS policies.
- `supabase/functions/` - lightweight Edge Functions.
- `workers/scanner/` - isolated scanning pipeline.
- `tests/e2e/` - browser-level workflows.

## Naming and Documentation

- Code identifiers use formal domain names where clarity matters; UI copy may use VAULTIX terminology.
- Public functions, provider adapters, state transitions, and non-obvious security decisions require concise documentation.
- Comments explain why an invariant exists, not what obvious code does.
- Keep context files and the progress tracker synchronised with accepted product or architecture changes.
