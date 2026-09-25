# Contributing to VAULTIX

VAULTIX handles money, private files and identity evidence. Contributions are welcome, but the
rules below are not optional. Read them before opening a merge request.

## Read first

The files in `context/` are the accepted specification:

| File | Owns |
| --- | --- |
| [`project-overview.md`](context/project-overview.md) | Product behaviour, scope and success criteria |
| [`architecture.md`](context/architecture.md) | Stack, domain boundaries, storage, auth, money flow and **invariants** |
| [`code-standards.md`](context/code-standards.md) | TypeScript, Next.js and Supabase conventions, and testing |
| [`ai-workflow-rules.md`](context/ai-workflow-rules.md) | Scoping, delivery order, protected areas and launch gates |
| [`ui-context.md`](context/ui-context.md) | UI constraints and design tokens |
| [`progress-tracker.md`](context/progress-tracker.md) | Current phase, decisions and open questions |

If your change alters accepted behaviour, update the relevant context file **in the same merge
request** and append an entry to `progress-tracker.md`. Code that contradicts a context file is a
bug in one of the two.

## Setup

Requires Node.js 24 LTS and pnpm 11.3.0 (pinned through `packageManager`).

```bash
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env.local   # fill in local or sandbox values only
pnpm dev
```

Never commit `.env*` files except `.env.example`. Never put secrets, service-role keys, bank
details, verification evidence or private file URLs in code, tests, logs or screenshots.

## Branches and merge requests

| Branch | Purpose |
| --- | --- |
| `main` | Integrated development line |
| `production` | Release candidate for deployment. It is reached only through a reviewed merge request |
| `codex/*` | Backend lane (Codex) |
| `claude/*` | Frontend lane (Claude Code) |
| `feat/*`, `fix/*`, `docs/*` | Human contributors |

- Branch from `main` and open the merge request against `main`, unless you are promoting a release.
- Keep one independently verifiable vertical slice per merge request: schema, policy, server
  action, minimal UI and tests, with the acceptance criteria written in the description.
- Do not edit another lane's files in the same branch. For lane ownership, see
  [`docs/superpowers/plans/2026-09-13-vaultix-mvp-coordination.md`](docs/superpowers/plans/2026-09-13-vaultix-mvp-coordination.md).
- Rebase or merge `main` before requesting review, and resolve conflicts yourself.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```text
feat(profile): avatar upload with crop and rotate
fix(ui): claim file input reachable by keyboard
docs: record region lock decision
```

Types: `feat`, `fix`, `refactor`, `style`, `test`, `docs`, `chore`. Explain *why* in the body when
it is not obvious. Note any migration that must be applied.

## Before you open a merge request

All of these must pass locally:

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
```

Run `pnpm test:e2e` for user-facing flows, and `pnpm test:db` when you touch SQL.

A unit is done only when:

- its acceptance criteria pass;
- new RLS policies and privileged functions have explicit access-control tests;
- retry and idempotency paths are tested;
- nothing sensitive reaches logs or client bundles;
- the context files match reality;
- UI works by keyboard from 360 px up, uses the design tokens, and covers the success, empty,
  loading, validation, failure, restricted, expired and offline states.

## Invariants you must not break

- Money is integer **sen**, branded at the type level. Never use floating point for money.
- The ledger is append-only and balanced. Corrections, refunds, fees and chargebacks are
  compensating entries inside one transaction.
- A bounty changes only after a verified provider event, processed exactly once. A redirect is not
  proof of payment.
- No entitlement or payout exists without a recorded human Sheriff approval.
- Exactly one winning claim per bounty, and at most one entitlement per contributor.
- Callbacks, queue jobs, cron jobs, entitlements, payouts and notifications are idempotent.
- Unreviewed files stay private and quarantined, and never appear in logs, analytics, email or
  notifications.
- Authorisation is enforced server-side **and** through RLS. Hiding a button is not access control.
- The fee rate and policy version are snapshotted when a Wanted request is published.
- Public uploads and live payment stay disabled until their launch gates pass. Never flip them as a
  side effect of a change.

## Protected areas

Do not change these unless the task explicitly requires it:

- Applied migrations in `supabase/migrations/`. Add a new, timestamped migration instead.
- Generated components in `src/components/ui/`. Wrap them instead.
- Lockfiles (except through `pnpm`), generated Supabase types, provider settings, payment mode, the
  public-upload flag, and any RLS bypass.
- `BILIK KEBAL 2 by afes.pdf`.

## Database changes

- Migrations are append-only and forward-only. Name them `YYYYMMDDNNNN_short_description.sql`.
- Every new user-facing table and bucket needs RLS and tests that prove who can and cannot read or
  write.
- State in the merge request description that the migration must be applied to Supabase Cloud, and
  record it in `progress-tracker.md` and `CHANGELOG.md`.

## UI

- Use the semantic CSS custom properties (`--bg-base`, `--text-primary`, `--accent-primary`,
  `--focus-ring`, …). Components never hardcode colours, fonts, radii or spacing.
- Payment, policy, security, status and error information must read as clear English, even inside
  the themed frontier layer.
- The frontier theme must be original: no Red Dead Redemption logos, artwork, typography or trade
  dress.
- Target WCAG 2.1 AA and full keyboard operation.

## Testing

- Unit and component tests sit beside the code they test (`*.test.ts` / `*.test.tsx`).
- Shared builders live in `test-support/` modules that production code never imports.
- Tests never send real email, take real payment, release a payout or refund, or delete retained
  evidence. Use sandbox providers and recorded ToyyibPay fixtures.

## When to stop and ask

Stop and ask the maintainers before you change anything that affects money, legal responsibility,
ownership, privacy, public exposure, core product behaviour, an irreversible migration, recurring
cost, final brand assets, or a launch gate. Add unresolved questions to the *Open questions*
section of `progress-tracker.md` instead of guessing.

## Changelog

Add a line under the top section of [`CHANGELOG.md`](CHANGELOG.md) for every user-visible change,
migration or fix.

## Licence

No open-source licence has been selected. By contributing, you agree that your contribution is
proprietary to the project owners unless a licence is added.
