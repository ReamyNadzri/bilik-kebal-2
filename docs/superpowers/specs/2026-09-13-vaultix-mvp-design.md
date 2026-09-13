# VAULTIX Phased MVP Design

**Date:** 2026-09-13  
**Status:** Approved for phased implementation
**Product scope:** Full UiTM-first VAULTIX MVP delivered in independently verifiable phases

## 1. Purpose

Build the complete VAULTIX MVP as a production-oriented academic-resource bounty marketplace while keeping all live-risk capabilities disabled until their launch gates pass. Delivery must produce useful, testable vertical slices rather than disconnected technical layers.

This design supplements, and does not replace, the repository source-of-truth documents:

- `context/project-overview.md`
- `context/architecture.md`
- `context/ui-context.md`
- `context/code-standards.md`
- `context/ai-workflow-rules.md`
- `context/progress-tracker.md`

If this design conflicts with those documents, the stricter security, money, access-control, privacy, or launch-gate requirement wins and the conflicting documents must be reconciled before implementation continues.

## 2. Delivery Strategy

Use a single Next.js App Router application managed with `pnpm`. Organise business logic as a modular monolith and deliver the MVP in six phases:

1. Foundation
2. Identity and institution trust
3. Wanted marketplace and money
4. Claims and moderation
5. Fulfilment and operations
6. Hardening and controlled launch

Every phase is split into small vertical feature units. A feature unit includes the schema, database policies, server-side operation, minimal accessible interface, and automated tests needed to prove its acceptance criteria. Provider integrations use adapters so tests and local development can use deterministic fakes or recorded fixtures without weakening production boundaries.

## 3. Architecture

### 3.1 Application boundary

VAULTIX is one Next.js App Router deployment. Server Components are the default. Client Components exist only where browser interaction is required. Pages, route handlers, and Server Actions authenticate, authorise, validate one command, call a domain service, and translate its typed result for the delivery layer.

Business modules live under `src/modules/<domain>/`. Modules expose explicit TypeScript contracts and may communicate through stable identifiers and versioned domain events. A module must not read or mutate another module's internal tables directly.

### 3.2 Data and infrastructure

Supabase PostgreSQL is the source of truth. Supabase Auth owns credentials and sessions. Private Supabase Storage buckets hold verification evidence, quarantined uploads, approved resources, and safe derivatives. Supabase Queues and Cron handle durable asynchronous and scheduled work. Edge Functions receive provider callbacks and orchestrate short tasks. A separate containerised scanner handles all untrusted file parsing and conversion.

Every user-facing table and private bucket has RLS. Privileged operations are performed server-side with least-privilege credentials. Service-role credentials are never bundled for the browser.

### 3.3 Provider adapters

Define narrow adapters for:

- payment bill creation and transaction verification;
- transactional email delivery;
- object storage and signed access;
- file-screening requests and results;
- clock and identifier generation where deterministic testing is required.

Production adapters are selected only by validated server configuration. Test adapters must preserve the same result and failure contracts. Sandbox and live credentials are separate configuration values. Provider mode defaults to `disabled`.

### 3.4 Command flow

The standard mutation flow is:

`user action -> input validation -> authentication -> authorisation/RLS -> domain service -> PostgreSQL transaction -> outbox event -> queue/provider adapter -> audit and notification`

Provider callbacks, queue consumers, cron handlers, entitlement creation, payout/refund task creation, and notification delivery require idempotency keys and durable deduplication records.

### 3.5 Result and error contract

Domain operations return a discriminated success/error result with a stable machine-readable code. Browser-safe messages must not include stack traces, raw provider responses, internal object keys, private URLs, verification evidence, or sensitive personal information. Logs include correlation identifiers and structured metadata but exclude secrets and private document contents.

## 4. Project Structure

The implementation uses these primary boundaries:

```text
src/
|-- app/                    # routes, layouts, route handlers, server actions
|-- components/             # product components and layouts
|   `-- ui/                 # generated or approved accessible primitives
|-- lib/                    # config, clients, logging, money/time and shared contracts
`-- modules/
    |-- identity/
    |-- taxonomy/
    |-- wanted/
    |-- ledger/
    |-- claims/
    |-- moderation/
    |-- entitlements/
    |-- payouts/
    |-- notifications/
    `-- audit/
supabase/
|-- migrations/             # append-only SQL migrations and RLS
`-- functions/              # thin callbacks and lightweight orchestration
workers/
`-- scanner/                # separately deployable untrusted-file worker
tests/
`-- e2e/                    # cross-module browser workflows
```

Tests that exercise a single domain live beside that domain. Shared test builders live in explicitly named test-support modules and are not imported by production code.

## 5. Phase Design

### Phase 1: Foundation

Create the reproducible application baseline: pinned Node and `pnpm` requirements, Next.js App Router, strict TypeScript, Tailwind, ESLint, formatting, Vitest, React Testing Library, Playwright, environment validation, semantic CSS variables, a minimal accessible shell, and continuous-integration commands.

The shell uses provisional semantic token values only. Claude Code owns a complete provisional frontend across the MVP while Codex owns backend and infrastructure implementation. The provisional UI must cover real flows and states without treating temporary visual choices as final brand approval. Add server-only configuration boundaries that prevent secrets from being imported into Client Components.

Phase acceptance:

- a clean checkout installs using the committed lockfile;
- development and production builds start without secrets when integrations are disabled;
- lint, format check, typecheck, unit tests, and production build pass;
- the app renders an accessible VAULTIX shell at 360 px and desktop widths;
- invalid or incomplete enabled-provider configuration fails fast with a safe diagnostic;
- no application secret is present in the browser bundle.

### Phase 2: Identity and institution trust

Add Supabase local configuration, ordered migrations, generated database types, RLS test tooling, email/password authentication, email verification, password recovery, user profiles, institution membership, manual verification requests, domain-based verification, account restriction states, and granular Owner/Sheriff roles.

Email verification and institution verification remain separate states. Email-verified users may browse public Wanted metadata. Only institution-verified users may transact, submit claims, or access entitled files. Institution Sheriff authority is limited to assigned institutions.

Phase acceptance:

- authentication, recovery, and session handling work against the configured Supabase environment;
- RLS tests cover anonymous, email-verified, institution-verified, Institution Sheriff, Platform Sheriff, and Owner actors;
- no client-side control is treated as authorisation;
- verification evidence stays private and receives a retention timestamp;
- sensitive Sheriff and Owner commands require recent authentication hooks;
- audit records capture verification and role changes.

### Phase 3: Wanted marketplace and money

Add configurable UiTM taxonomy, Wanted drafts and publication, duplicate suggestions, 7/14/30-day duration snapshots, Board discovery, bounty status, ToyyibPay sandbox bill creation, callback intake, status reconciliation, immutable balanced ledger entries, and successful contributions.

Money is represented as branded integer sen. Each contribution is RM1-RM50. The payer-borne provider fee is separate from the contribution. Publishing snapshots the configured platform fee, duration, policy version, and access basis. Redirects never confirm payment; only verified callbacks or provider status lookups can do so.

Phase acceptance:

- an institution-verified user can create, publish, find, and fund a Wanted request in sandbox mode;
- duplicate callback deliveries and reordered provider events affect the ledger exactly once;
- database constraints reject invalid amounts and duplicate provider identities;
- every committed financial operation produces balanced immutable entries and an audit trail;
- the payment kill switch blocks new bills without corrupting callbacks already in flight;
- disabled mode works without payment credentials and live-limited mode cannot be enabled accidentally.

### Phase 4: Claims and moderation

Add claim eligibility, signed direct upload to private quarantine, completion records, checksums, screening queue messages, scanner contracts, supported-file validation, duplicate evidence, Sheriff queues, decisions, reports, temporary restrictions, and one seven-day appeal reviewed by a different Sheriff.

During controlled development, the scanner adapter accepts only synthetic fixtures and explicitly marked controlled test files. Public upload remains disabled until the isolated production scanner and safe-preview pipeline pass readiness checks. Automated screening produces evidence only and can neither approve nor finally reject a claim.

Phase acceptance:

- supported controlled files move from signed upload to private quarantine and reviewer evidence;
- unsupported, oversized, encrypted, macro-enabled, corrupt, or malicious fixtures fail safely;
- users cannot access another user's upload or any unreviewed file;
- exact duplicates and near matches follow their distinct policy rules;
- Sheriff decisions enforce institution scope and segregation of appeal reviewer;
- raw private file data does not enter logs, analytics, email, or queue payloads.

### Phase 5: Fulfilment and operations

Add atomic winning-claim approval, bounty closure, contributor entitlements, optional free release after exactly 48 hours, private signed downloads, manual payout tasks, expiry, manual full-refund tasks, reconciliation, in-app notifications, transactional email, retention jobs, takedown, and access revocation.

One approval transaction records the human decision, selects exactly one winning claim, closes the bounty, creates at most one entitlement per successful contributor, snapshots the rights decision, creates exactly one payout task, and publishes outbox events. Payout and refund completion require an Owner, timestamp, external reference, amount, method, evidence reference, ledger entries, and audit record.

Phase acceptance:

- approval is atomic and safe under retries and competing requests;
- contributor-only access and free-after-48-hours access follow the snapshotted rights decision;
- expired unfulfilled bounties create one full-refund task per successful contribution;
- payout/refund button clicks alone never imply external completion;
- signed URLs are private, short-lived, scope-checked, and revocable through entitlement rules;
- notification and retention workers are idempotent and expose exhausted failures to operators.

### Phase 6: Hardening and controlled launch

Complete cross-domain E2E tests, accessibility verification, structured observability, reconciliation dashboards, provider health checks, backup/recovery documentation and drills, incident response, rate limits, security review, production configuration validation, and controlled live-limited payment readiness.

Claude Code completes all MVP routes, responsive layouts, interaction states, and accessibility behaviour using provisional semantic tokens. Final visual tokens and assets are incorporated only from the approved external handoff. The original frontier theme must not imitate protected Red Dead Redemption assets or trade dress, and thematic presentation must not obscure money, policy, security, status, accessibility, or error information.

Phase acceptance:

- primary student, Sheriff, and Owner E2E journeys pass in supported browsers;
- WCAG 2.1 AA checks, keyboard navigation, visible focus, reduced motion, and 360 px layouts pass;
- monitoring detects callback, queue, cron, reconciliation, storage, and scanner failures;
- recovery procedures preserve financial and audit integrity;
- all critical launch gates in `context/progress-tracker.md` are either satisfied or keep the affected public capability disabled;
- live-limited payment requires explicit recent Owner action, allowlisted testers, healthy callbacks, audit logging, and a tested kill switch.

## 6. Core Data Ownership

The implementation plan must define exact tables and migrations, but ownership is fixed here:

- `identity` owns profiles, verification states, institution memberships, restrictions, role assignments, and verification requests.
- `taxonomy` owns institution, campus, faculty/college, programme, course, session, semester, resource-type, language, and tag records.
- `wanted` owns Wanted requests, lifecycle, configuration snapshots, duplicate suggestions, and public Board projections.
- `ledger` owns bills, provider events, contributions, balanced ledger transactions and entries, chargebacks, and reconciliation state.
- `claims` owns upload sessions, storage references, claims, checksums, extracted evidence, and duplicate matches.
- `moderation` owns queues, decisions, reason codes, reports, appeals, restrictions, and sanctions.
- `entitlements` owns access grants, free-release state, download authorisation, and revocation state.
- `payouts` owns payout and refund work items plus externally performed operation records.
- `notifications` owns in-app notification state and delivery attempts.
- `audit` owns append-only security, finance, access, moderation, and configuration events.

Cross-domain database work that must be atomic is exposed through deliberately privileged PostgreSQL functions with a fixed safe `search_path`, revoked default access, explicit internal authorisation, and dedicated tests.

## 7. State and Time Rules

Lifecycle states use explicit enums or constrained values with central transition policies. Every material transition records actor, UTC timestamp, prior state, next state, reason code where applicable, correlation identifier, and the relevant configuration or policy version.

Scheduled behaviour uses stored UTC instants. Expiry, appeal pauses, 48-hour release, verification-evidence cleanup, rejected/quarantined file retention, and reconciliation are calculated from persisted timestamps rather than browser time. Tests use an injected clock.

## 8. Security and Privacy Gates

- Public uploads default to off and remain off until the production scanner readiness gate passes.
- Payment mode defaults to disabled; ordinary automated tests use synthetic ToyyibPay fixtures.
- Live and sandbox credentials are never interchangeable.
- All private files use provider-independent object references, never public URLs.
- Private file URLs, provider secrets, service-role keys, bank details, and raw evidence are excluded from logs and client bundles.
- Rate limits cover authentication, Wanted publication, bill creation, upload sessions, reports, and privileged operations.
- High-risk reports may temporarily restrict access while preserving evidence and requiring a documented human decision.
- Destructive migrations, production activation, irreversible data changes, and retention deletion require explicit approval and a recovery plan.

## 9. Testing Strategy

Use Vitest and React Testing Library for pure policies, services, adapters, and UI behaviour; SQL/RLS tests against Supabase for constraints and access control; Playwright for cross-module journeys; and recorded or synthetic fixtures for provider contracts.

Every behaviour change follows red-green-refactor. Financial, access, lifecycle, moderation, retention, callback, queue, cron, entitlement, payout, refund, and notification paths include retry and idempotency cases. Security tests explicitly cover cross-user access, cross-institution access, signed-URL expiry, client-bundle secret leakage, malicious filenames, unsupported file signatures, and RLS bypass attempts.

Each feature unit must pass its focused tests plus the repository lint, typecheck, unit/integration suite, and production build before completion. Phase boundaries additionally require the relevant E2E journey and documentation synchronisation.

## 10. External Dependencies and Safe Development Defaults

Development may proceed while legal, commercial, provider, taxonomy, scanner, and final-design questions remain open, provided the related public capability remains disabled or uses a controlled adapter.

Safe defaults are:

- payment mode `disabled`, with explicit sandbox enablement for local/test environments;
- public uploads disabled;
- synthetic scanner results restricted to automated tests and controlled fixtures;
- a complete provisional UI using neutral accessible semantic tokens pending final design handoff;
- no automatic payout or refund execution;
- UiTM taxonomy loaded from reviewed configuration rather than treated as authoritative until its maintainer and source are approved;
- no public commercial launch on development-only hosting plans.

## 11. Documentation and Review Discipline

Each implementation unit starts with written acceptance criteria and ends by updating `context/progress-tracker.md`. Behavioural decisions update the owning context document in the same patch. Applied migrations remain immutable; corrections use new migrations.

Claude Code and Codex must read this design and all six context documents before executing their assigned implementation plans. Claude Code owns provisional frontend routes, components, responsive behaviour, and frontend tests. Codex owns schemas, RLS, domain services, server operations, provider adapters, workers, audit, and backend tests. Codex publishes shared contracts before Claude integrates a flow. Both work in separate branches/worktrees, follow dependency order, use small commits, and stop when a critical money, legal, privacy, ownership, public-exposure, irreversible-migration, or recurring-cost decision is unresolved.

## 12. Completion Definition

The MVP is code-complete when phases 1-6 pass their acceptance criteria in controlled environments. It is not public-launch-ready merely because the code is complete. Public users, unrestricted real payments, and public uploads remain separately gated by the critical launch requirements recorded in `context/progress-tracker.md`.
