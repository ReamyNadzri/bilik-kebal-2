# VAULTIX Phase 3 Wanted and Money Design

Status: approved direction, awaiting implementation-plan review.

## 1. Objective

Phase 3 turns the fixture-backed marketplace into a server-authoritative Wanted and contribution
system without weakening the existing Identity boundary. An email-verified account may browse
published metadata. Only an institution-verified, unrestricted account may create a draft, begin a
publication payment, or add a contribution.

The work is delivered as three independently reviewable slices:

1. **Wanted core:** published contracts, configurable taxonomy, private drafts, duplicate
   suggestions, publication validation and RLS.
2. **Money and publication:** bills, verified provider events, contributions, a balanced immutable
   ledger, activation of a funded Wanted, reconciliation and the payment kill switch.
3. **Frontend integration:** Claude Code connects the existing marketplace UI to the published
   operations and removes each `FixtureNotice` only with its fixture source.

Claims remain outside this phase. `/claims` stays explicitly fixture-backed until Phase 4 publishes
the claims contract.

## 2. Delivery boundary

Codex owns:

- `src/contracts/**` marketplace and money contracts;
- `src/modules/taxonomy/**`, `src/modules/wanted/**`, and `src/modules/ledger/**`;
- thin `src/app/api/**` delivery routes for the new operations;
- append-only Supabase migrations, generated database types, SQL/RLS tests, and provider adapters;
- backend integration documentation and tracker updates.

Claude Code owns:

- the `/wanted/new` form and its frontend-only validation/presentation;
- marketplace route integration after the relevant Codex commit is available;
- responsive, keyboard, screen-reader and browser-flow tests.

Neither lane edits the other's files. A backend contract commit lands before frontend integration.
No worker writes into the other worker's checkout.

## 3. Slice A — Wanted core

### 3.1 Taxonomy

The Identity-owned `public.institutions` table remains the root. Taxonomy adds institution-scoped
campuses, faculties, programmes, courses and academic sessions, plus global resource types,
languages and tags. Every record has an opaque UUID, a stable slug, a display label, an `active`
flag, a deterministic sort order and timestamps.

Hierarchy is enforced by composite foreign keys, not browser-selected labels:

```text
institution
├── campus
├── faculty
│   └── programme
│       └── course
└── academic session

resource type, language, tag  (global controlled vocabularies)
```

Migrations do not claim an authoritative UiTM catalogue. Production tables begin empty. A
development-only Supabase seed may contain clearly named synthetic UiTM-like options so local UI
flows remain testable; it is never represented as reviewed institutional data.

Taxonomy browse reads require an email-verified session. Taxonomy maintenance remains an Owner
operation for a later console slice; Phase 3 consumes active records but exposes no public mutation
route for them.

### 3.2 Wanted state

`public.wanted_requests` owns the request and its immutable publication snapshots. Its lifecycle in
this phase is:

```text
draft -> awaiting_payment -> open -> reviewing
                          \-> expired
```

`fulfilled` is reserved for Phase 5, when a winning claim can atomically close the bounty.
Cancellation is not introduced because no approved product rule currently defines who may cancel
or what happens to money.

A draft stores the Commissioner, institution, taxonomy references, title, description, tags and
the requested duration. Publication preparation validates the draft, persists the following
snapshots, and then asks the ledger module to create the first contribution bill:

- duration: exactly 7, 14 or 30 days;
- platform fee rate in basis points;
- content policy version;
- access basis (`contributors_only` by default);
- gross contribution amount in integer sen, RM1–RM50.

`published_at` and `closes_at` remain null while payment is pending. A Wanted becomes `open` only
inside the transaction that records the first confirmed contribution. `closes_at` is derived from
the confirmed activation instant plus the snapshotted duration. A redirect or browser callback can
never make it open.

### 3.3 Duplicate suggestions

Before publication preparation, the server returns possible duplicates using controlled metadata:
same institution and course first, then matching resource type, session and normalised title terms.
The result carries public Wanted identifiers and safe Board metadata only. It is advisory and does
not block publication automatically. The publication request must include the server-issued
duplicate-check token; stale or absent checks fail with `DUPLICATE_CHECK_REQUIRED`.

No file, claim, storage path, uploader identity, email or unreviewed content participates in this
phase's duplicate search.

### 3.4 Contracts

`src/contracts/marketplace.ts` publishes presentation-safe DTOs and `OperationResult` aliases:

- `ListTaxonomyResult`
- `CreateWantedDraftInput` / `CreateWantedDraftResult`
- `UpdateWantedDraftInput` / `UpdateWantedDraftResult`
- `SuggestWantedDuplicatesInput` / `SuggestWantedDuplicatesResult`
- `PrepareWantedPublicationInput` / `PrepareWantedPublicationResult`
- `WantedSummary`, `WantedDetail`, `ListWantedQuery`
- `ListWantedResult` / `ReadWantedResult`
- `MarketplaceViewerCapabilities`

Money uses branded integer sen at the TypeScript boundary. Public DTOs may carry the numeric value
only after Zod has established that it is a non-negative safe integer. No DTO exposes database row
identifiers for users, provider secrets, raw callbacks, object keys or internal ledger account IDs.

The initial read contract is stable before its database implementation lands. The public Board read
returns only `open` and `reviewing` records; a Commissioner-only draft read is a separate operation.

### 3.5 Operations

Thin route handlers call services through these HTTP boundaries:

| Method | Route | Authority |
| --- | --- | --- |
| `GET` | `/api/marketplace/taxonomy` | Email verified |
| `GET` | `/api/marketplace/wanted` | Email verified |
| `GET` | `/api/marketplace/wanted/[id]` | Email verified |
| `POST` | `/api/marketplace/wanted/drafts` | Institution verified |
| `PATCH` | `/api/marketplace/wanted/drafts/[id]` | Owning Commissioner |
| `POST` | `/api/marketplace/wanted/duplicate-suggestions` | Institution verified |
| `POST` | `/api/marketplace/wanted/drafts/[id]/publication` | Owning Commissioner |

Phase 3A's publication operation validates and records a publication intent. It returns
`PAYMENT_UNAVAILABLE` while payment mode is disabled; it does not synthesize a successful payment.
Phase 3B supplies the bill result through the same contract.

## 4. Slice B — money and publication

### 4.1 Provider boundary

The ledger module depends on a narrow `ContributionPaymentProvider` interface that creates a bill
and verifies transaction state. The ordinary test adapter is deterministic and synthetic. The
application boots with `PAYMENT_MODE=disabled` and no credentials.

Sandbox and live-limited adapters use separate validated configuration. No real ToyyibPay request is
implemented from guessed parameters: its current official callback and status-verification contract
must be recorded in integration documentation before that adapter is enabled. Live-limited remains
blocked by the launch decisions in `context/progress-tracker.md`.

### 4.2 Financial records

The ledger owns:

- contribution intents and provider bills;
- append-only provider delivery attempts and deduplication identities;
- successful contributions;
- ledger transactions and balanced debit/credit entries;
- reconciliation state and append-only audit events.

All money is integer sen. A contribution is 100–5,000 sen. Provider charges are stored separately
and never increase the Wanted's gross bounty. Every committed financial transaction balances to
zero. Original entries cannot be updated or deleted; later refunds and corrections are compensating
transactions.

Database uniqueness, not in-memory checks, guarantees one effect per provider transaction identity
and one successful contribution per bill. Reordered callbacks are stored, then resolved against the
authoritative bill state. An unknown, malformed or mismatched callback cannot change a Wanted or the
ledger.

### 4.3 Activation and funding

The first confirmed contribution atomically:

1. records the provider event and successful contribution;
2. writes balanced ledger entries;
3. changes the Wanted from `awaiting_payment` to `open`;
4. sets `published_at` and calculates `closes_at` from the duration snapshot;
5. appends audit and outbox records.

Later confirmed contributions atomically update the public projection through source records; no
mutable cached bounty total is authoritative. Board reads derive gross bounty and Backer count from
successful, non-reversed contributions.

The payment kill switch blocks new bills but continues accepting, storing and reconciling callbacks
for bills already issued.

## 5. RLS and authorisation

RLS is enabled before grants on every new user-facing table.

- email-verified users may read active taxonomy and public Wanted projections;
- institution-verified, unrestricted users may create drafts;
- only the owning Commissioner may read or mutate a draft;
- browser roles cannot insert provider events, contributions, ledger entries, audit events or
  outbox records;
- financial transitions are security-definer PostgreSQL functions with `search_path = ''`, revoked
  public execution, explicit caller checks and idempotency tests;
- an institution identifier supplied by the browser never grants authority; the service re-derives
  membership and scope from stored rows.

UI hiding is never an access control. The viewer-capability result is explanatory presentation data;
services and RLS independently enforce every command.

## 6. Read models

Board and detail reads compose domain records into frontend view models. They never expose internal
row shapes. The summary includes public ID, title, course, campus, resource type, academic session,
gross bounty, Backer count, safe status, publication instant and closing instant. Detail adds the
description, faculty, programme, language, tags, Commissioner trust presentation, snapshot policy
metadata and public activity.

The Commissioner presentation contains display name plus email/institution verification booleans;
it excludes email address, membership evidence and role assignments. Activity entries are explicit
public events, not a filtered dump of audit records.

Reads distinguish `not found`, `unavailable` and an empty list. They never substitute fixtures on a
backend failure.

## 7. Failure contract

Stable browser-safe codes include:

- authentication and trust: `AUTH_REQUIRED`, `EMAIL_NOT_VERIFIED`,
  `INSTITUTION_VERIFICATION_REQUIRED`, `ACCOUNT_RESTRICTED`, `NOT_AUTHORIZED`;
- validation and state: `VALIDATION_ERROR`, `WANTED_NOT_FOUND`, `DRAFT_NOT_FOUND`,
  `DRAFT_NOT_EDITABLE`, `DUPLICATE_CHECK_REQUIRED`, `DUPLICATE_CHECK_EXPIRED`;
- payments: `PAYMENT_DISABLED`, `PAYMENT_UNAVAILABLE`, `AMOUNT_OUT_OF_RANGE`,
  `PROVIDER_EVENT_INVALID`, `PROVIDER_AMOUNT_MISMATCH`;
- infrastructure: `MARKETPLACE_UNAVAILABLE`.

Messages include no provider response bodies, secrets, SQL details or personal data. Expected
domain failures return `OperationResult`; unexpected faults are logged with a correlation ID and
mapped to `MARKETPLACE_UNAVAILABLE`.

## 8. Testing

Every behavior follows red-green-refactor.

- Vitest covers Zod boundaries, state transitions, duplicate ranking, capability mapping, fee and
  duration snapshots, provider-result mapping and idempotent service orchestration.
- SQL tests cover constraints, cross-user draft isolation, email-only browsing, institution trust,
  financial table denial, immutable entries, balanced transactions, duplicate deliveries,
  reordered events and kill-switch behavior.
- Route tests cover parsing, status mapping and safe failure bodies.
- Provider contract tests use recorded synthetic fixtures until an official sandbox contract is
  approved.
- Phase gates run formatting, lint, typecheck, all unit tests, SQL tests and production build.

No frontend integration removes `FixtureNotice` until its real operation passes both backend and
browser tests.

## 9. Explicit non-goals

- Claims, uploads, screening and Sheriff claim decisions (Phase 4).
- Entitlements, payouts, refunds and bounty expiry jobs (Phase 5).
- Real live ToyyibPay activation or unrestricted public payments.
- Cancellation or extension of a published Wanted.
- Inventing authoritative UiTM taxonomy or an approved email-domain list.
- Automatic acceptance of duplicate or near-duplicate content.

## 10. Acceptance

Phase 3 is complete in a controlled environment when:

1. an institution-verified, unrestricted account can create a valid draft and complete the required
   duplicate check;
2. a verified synthetic or approved sandbox callback opens the first-funded Wanted exactly once;
3. email-verified accounts can list and read public Wanted metadata but cannot transact;
4. repeated or reordered provider events produce no duplicate contribution or ledger effect;
5. every financial transaction is balanced and immutable;
6. the kill switch rejects new bills while existing bill callbacks remain safe;
7. `/`, `/board` and `/wanted/[id]` consume real view models with their fixture markers removed;
8. `/claims` remains honestly fixture-backed until Phase 4.
