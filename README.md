# VAULTIX

VAULTIX is an academic resource bounty marketplace for legitimate, authorised learning materials. Students publish a structured request, contribute to a shared bounty, and reward the Hunter whose resource is selected after technical screening and human review.

The first release is English-first and focused on UiTM. The architecture is designed to support additional Malaysian higher education institutions later.

> **Project status:** MVP in active development (Phases 1–5 implemented, Phase 6 hardening pending). Payment stays `disabled` and public uploads stay off until their launch gates pass. See [`CHANGELOG.md`](CHANGELOG.md) for what the `production` branch adds over `main`.

## How VAULTIX Works

1. A user registers with any email address and verifies it.
2. UiTM affiliation is verified through an approved institutional email domain or manual Sheriff review.
3. A Commissioner creates a Wanted request (academic resource, missing item, or discussion), selects a duration of 3 to 30 days, and either contributes RM1-RM50 or posts it free (3 free requests per member for life, plus reward codes).
4. Other verified Backers may add RM1-RM50 each to the bounty.
5. A Hunter submits an eligible academic resource and declares the right to share it. Missing items and discussions take text replies instead; the poster names the member who helped and a Sheriff approves the release.
6. The file remains private while automated checks produce evidence for a human Sheriff.
7. The Sheriff selects the best valid claim. Submission time is used only as a tie-breaker.
8. Successful contributors receive access, and the Owner processes the Hunter payout manually.
9. Contributor-only access is the default. A resource may become free 48 hours after approval when the Hunter permits it and the Sheriff confirms the sharing rights.
10. If a bounty expires without an approved claim, full-refund tasks are created for its successful contributions.

## Current Features

- **Board and Wanted posters** — browse, search and back open requests; a shared poster renders the card and the detail ledger.
- **Post a Wanted** — academic, missing-item and discussion kinds; free or bounty; 3–30 day and RM1–RM50 sliders; versioned posting terms.
- **Explore Map** — live campus regions with totals; region lock allows new requests only at UiTM Shah Alam, Puncak Alam, Kuala Terengganu, Dungun and Bukit Besi.
- **Hunt and Claims** — open hunts, my claims, private quarantined upload with rights declaration, reports and 7-day appeals.
- **Sheriff Console** — dashboard, claim moderation, appeals, entry requests (new taxonomy) and community releases, operations queues.
- **Fulfilment** — evidence locker, contributor entitlements, Archive and *My library* with signed downloads, manual payout and refund queues.
- **Profiles** — editable profile, drawn avatars or cropped photo upload, public member pages at `/u/[publicId]`, reward codes.
- **Identity and notifications** — email and institution verification as separate trust states, OTP password recovery, in-app inbox with unread badge, and email for priority events.

## Core Principles

- Only legitimate resources that the uploader is authorised to share are allowed.
- Confidential, leaked, unlawfully obtained, institution-restricted, malicious, deceptive, and privacy-invasive material is prohibited.
- Automated screening never approves or finally rejects a claim without a human decision.
- Unreviewed files remain in private quarantine.
- Financial records are immutable, auditable, and idempotent.
- Email verification and institution verification are separate trust states.
- Only institution-verified users may transact, submit claims, or download entitled resources.
- Payment, policy, security, accessibility, and error messages use clear language even when the interface applies themed terminology.

## Initial Technology Direction

VAULTIX uses a Supabase-centric modular-monolith architecture:

| Area | Technology |
| --- | --- |
| Web application | Next.js App Router and TypeScript |
| UI foundation | Tailwind CSS and accessible headless primitives |
| Web hosting | Vercel |
| Authentication | Supabase Auth |
| Database | Supabase PostgreSQL |
| Private files | Supabase Storage |
| Lightweight backend | Supabase Edge Functions |
| Durable jobs | Supabase Queues |
| Scheduled jobs | Supabase Cron |
| Transactional email | Brevo (current adapter; Resend in the original plan) |
| Payment collection | ToyyibPay |
| File screening | Separately deployable isolated worker |

Cloudflare R2 is reserved as a future hybrid-storage option. Storage records use provider-independent object references so migration does not require rewriting the Claim or Entitlement domains.

## Payment Model

- Each contribution is between RM1 and RM50.
- The payer bears the payment-provider charge on top of the contribution.
- The default platform fee is 10% of the funded bounty.
- The fee rate is snapshotted when a Wanted request is published.
- ToyyibPay is used for collection in `Disabled`, `Sandbox`, or allowlisted `Live Limited` mode.
- Payouts and refunds are processed manually by the Owner in the first release and recorded with their external references.
- There is no general-purpose wallet or peer-to-peer balance transfer.

## Supported Uploads

The planned first release accepts files up to 50 MB in these formats:

- PDF
- DOCX
- PPTX
- XLSX
- JPG
- PNG
- WEBP

Archives, executables, macro-enabled Office files, password-protected files, and external-link-only submissions are not accepted.

Public uploads remain disabled until the isolated scanning worker and safe-preview pipeline pass production-readiness checks.

## Repository Contents

```text
.
|-- context/                 # source-of-truth specification
|   |-- ai-workflow-rules.md
|   |-- architecture.md
|   |-- code-standards.md
|   |-- progress-tracker.md
|   |-- project-overview.md
|   `-- ui-context.md
|-- docs/superpowers/        # MVP design, coordination and phase plans
|-- src/
|   |-- app/                 # routes, layouts; app/api holds route handlers
|   |-- components/          # product components
|   |-- contracts/           # shared domain contracts and result shapes
|   |-- features/            # presentation-only modules
|   |-- modules/             # domains: identity, wanted, claims, money, payouts, profiles, ...
|   `-- lib/                 # config, Supabase clients and generated types
|-- supabase/migrations/     # append-only SQL migrations
|-- workers/scanner/         # isolated file-screening worker
|-- tests/                   # e2e (Playwright) and SQL tests
|-- BILIK KEBAL 2 by afes.pdf
|-- CHANGELOG.md
|-- CONTRIBUTING.md
`-- README.md
```

The context files are the current source of truth:

- [`project-overview.md`](context/project-overview.md) defines product behaviour, scope, and success criteria.
- [`architecture.md`](context/architecture.md) defines system boundaries, providers, data flow, access control, and invariants.
- [`ui-context.md`](context/ui-context.md) records the approved UI constraints and external design handoff requirements.
- [`code-standards.md`](context/code-standards.md) defines implementation, security, database, testing, and organisation conventions.
- [`ai-workflow-rules.md`](context/ai-workflow-rules.md) defines the patch-by-patch development and verification workflow.
- [`progress-tracker.md`](context/progress-tracker.md) records completed decisions, next steps, and unresolved launch gates.

The original internal proposal is available as [`BILIK KEBAL 2 by afes.pdf`](BILIK%20KEBAL%202%20by%20afes.pdf). The current product name is VAULTIX; `Wanted` remains a marketplace feature term.

## Getting Started

Requires Node.js 24 LTS and pnpm 11.3.0 (pinned through `packageManager`; enable it with `corepack enable`).

```text
pnpm install --frozen-lockfile
pnpm dev
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
```

`pnpm test:watch` runs the unit suite in watch mode and `pnpm test:e2e` runs Playwright. CI runs the same lint, format, typecheck, test and build sequence on Node.js 24.

Apply the database migrations in `supabase/migrations/` in order before running against a Supabase project; `pnpm db:types` regenerates the typed client and `pnpm test:db` runs the SQL tests.

Providers default to disabled: the application builds and runs with no payment credentials, and public uploads stay off until their launch gate passes.

Before changing behaviour, read [`project-overview.md`](context/project-overview.md), [`architecture.md`](context/architecture.md), the current state in [`progress-tracker.md`](context/progress-tracker.md), and the phase plan under [`docs/superpowers/plans/`](docs/superpowers/plans/).

## Critical Launch Gates

Before public users or unrestricted live payments are enabled, the project must have:

- A named legal operator and ToyyibPay merchant-account owner.
- Approved Terms, Privacy Notice, content policy, takedown process, refund policy, and retention schedule.
- Confirmed ToyyibPay live callback, fee, settlement, and refund behaviour.
- Hosting terms and plans suitable for commercial use.
- Database backup and recovery appropriate for financial records.
- Custom SMTP with SPF, DKIM, and DMARC.
- Verified UiTM domains and a documented manual institution-verification process.
- An isolated production file scanner and safe-preview pipeline.
- MFA and recovery controls for Owner and Sheriff accounts.
- Monitoring, reconciliation, incident response, and a tested payment kill switch.
- An approved visual handoff and accessibility review.

## Development Workflow

- Work in small, independently verifiable patches.
- Keep context documents synchronised with accepted behaviour.
- Use sandbox providers by default.
- Require explicit Owner action to enable live payments.
- Add automated tests for every financial, access-control, lifecycle, and moderation invariant.
- Never place secrets, private files, verification evidence, or bank information in the repository or logs.

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for branches, commit style and merge-request checks, and [`ai-workflow-rules.md`](context/ai-workflow-rules.md) for the complete workflow. User-visible changes are recorded in [`CHANGELOG.md`](CHANGELOG.md).

## Licence

No open-source licence has been selected. Unless a licence is added, the repository should be treated as proprietary and all rights reserved.
