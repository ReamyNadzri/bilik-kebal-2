# VAULTIX

VAULTIX is an academic resource bounty marketplace for legitimate, authorised learning materials. Students publish a structured request, contribute to a shared bounty, and reward the Hunter whose resource is selected after technical screening and human review.

The first release is English-first and focused on UiTM. The architecture is designed to support additional Malaysian higher education institutions later.

> **Project status:** Pre-implementation specification and context review. The application has not been scaffolded or deployed yet.

## How VAULTIX Works

1. A user registers with any email address and verifies it.
2. UiTM affiliation is verified through an approved institutional email domain or manual Sheriff review.
3. A Commissioner creates a Wanted request, selects a 7-, 14-, or 30-day duration, and contributes RM1-RM50.
4. Other verified Backers may add RM1-RM50 each to the bounty.
5. A Hunter submits an eligible academic resource and declares the right to share it.
6. The file remains private while automated checks produce evidence for a human Sheriff.
7. The Sheriff selects the best valid claim. Submission time is used only as a tie-breaker.
8. Successful contributors receive access, and the Owner processes the Hunter payout manually.
9. Contributor-only access is the default. A resource may become free 48 hours after approval when the Hunter permits it and the Sheriff confirms the sharing rights.
10. If a bounty expires without an approved claim, full-refund tasks are created for its successful contributions.

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
| Transactional email | Resend |
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
|   |-- app/                 # routes, layouts, route handlers
|   |-- components/          # product components
|   |-- contracts/           # shared operation result contract
|   |-- features/            # presentation-only modules
|   `-- lib/config/          # validated server and public environment
|-- BILIK KEBAL 2 by afes.pdf
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

See [`ai-workflow-rules.md`](context/ai-workflow-rules.md) for the complete workflow.

## Licence

No open-source licence has been selected. Unless a licence is added, the repository should be treated as proprietary and all rights reserved.
