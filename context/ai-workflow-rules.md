# AI Workflow Rules

## Approach

Build VAULTIX incrementally through a spec-driven, patch-by-patch workflow. The context files define the accepted product behaviour, architecture, UI constraints, code conventions, and current state. Do not invent missing business behaviour. Resolve critical ambiguity in the relevant context file before implementation.

No application code may be started until the user has reviewed and approved the populated context set and an implementation plan has been written.

## Decision Authority

- The assistant may choose non-critical implementation details using the simplest secure and maintainable option consistent with these files.
- Ask the user about decisions that materially affect money, legal responsibility, ownership, privacy, public exposure, core product behaviour, irreversible migration, or recurring cost.
- Do not repeatedly ask about minor library, folder, naming, or internal implementation choices.
- Record material assumptions and their rationale in `progress-tracker.md`.
- Configuration is preferred for limits, taxonomy, policy versions, fee rates, provider modes, and lifecycle settings that may change in later patches.

## Scoping Rules

- Work on one independently verifiable feature unit at a time.
- Prefer vertical slices that include the required schema, policy, server action, minimal UI, and tests.
- Do not combine unrelated domains merely because they appear on one screen.
- Separate provider integration from domain behaviour through adapters.
- Keep production and sandbox credentials, data, callbacks, and test fixtures clearly separated.
- Never activate public upload or unrestricted live payment as a side effect of deploying code.

## Required Delivery Order

1. Repository/tooling baseline and automated quality checks.
2. Supabase local/cloud environments, migrations, typed configuration, and RLS test harness.
3. Authentication, email verification, profile, and institution-verification states.
4. Configurable UiTM taxonomy and institution-scoped roles.
5. Wanted creation, duplicate suggestion, Board discovery, duration, and lifecycle.
6. Financial ledger and ToyyibPay sandbox adapter before any live payment mode.
7. Contributions and idempotent callback/reconciliation flow.
8. Signed upload, private quarantine, claim state, and controlled test-file flow.
9. Screening evidence contracts and isolated worker integration.
10. Sheriff review, selection, reason codes, reports, and appeal.
11. Atomic approval, entitlement, contributor download, and scheduled free release.
12. Manual payout and refund operations with reconciliation.
13. Notifications, retention, observability, security hardening, and disaster recovery.
14. Controlled live-payment test, followed by public-launch readiness review.

Each unit requires its own written acceptance criteria before implementation begins.

## When to Split Work

Split an implementation step when it combines any of the following:

- A user-facing flow and an unrelated background-worker change.
- More than one provider integration.
- Multiple lifecycle state machines that cannot be verified independently.
- Schema/RLS work and broad visual redesign.
- Behaviour not already resolved in the context files.
- A unit too large to test end to end in one review cycle.

## Handling Missing Requirements

- Do not infer financial, legal, privacy, entitlement, or moderation behaviour.
- Add unresolved critical requirements to `progress-tracker.md` before continuing.
- Present a recommended option with consequences, not an open-ended technical questionnaire.
- If a safe reversible default exists for a non-critical choice, select it and document the decision.
- If the UI handoff is absent, build no branded visual treatment; restrict work to approved accessible structure.

## Protected Areas

Do not modify the following unless the current task explicitly requires it:

- Applied files in `supabase/migrations/`; add a new migration instead.
- Generated primitive files in `src/components/ui/`; wrap or regenerate them.
- Lockfiles except through the selected package manager.
- Third-party package internals, generated Supabase types, or vendored assets.
- Production provider settings, live secrets, payment mode, public-upload flag, retention jobs, or RLS bypasses.
- Original source proposal PDF.

## Security and External Actions

- Never place live secrets in source files, examples, logs, screenshots, fixtures, or chat output.
- Use sandbox providers by default. Live mode requires an explicit, auditable Owner action.
- Do not send real email, take real payment, release a payout/refund, delete retained evidence, or enable public uploads as part of an automated test.
- Destructive migrations, irreversible data operations, and production configuration changes require explicit user approval and a rollback/recovery plan.
- Use least-privilege credentials for local development, CI, preview, and production.

## Keeping Documentation in Sync

Update the relevant context file in the same patch whenever accepted implementation changes:

- Product behaviour, feature scope, user roles, lifecycle, or success criteria.
- Architecture boundaries, providers, storage, queues, auth, or invariants.
- Visual tokens, components, layouts, accessibility, or design ownership.
- Code conventions, testing standards, or folder ownership.
- Open questions, completed units, decisions, and session-resumption notes.

## Verification Gates

Before completing a feature unit:

1. Acceptance criteria pass through automated or documented manual verification.
2. Type checking, linting, unit/integration tests, and production build pass.
3. New RLS or privileged functions have explicit access-control tests.
4. Retry/idempotency behaviour is tested for provider, queue, cron, ledger, and entitlement work.
5. No architecture invariant is violated.
6. No secret, private file, or sensitive personal data appears in logs or client bundles.
7. `progress-tracker.md` and affected context files reflect reality.

## Launch Gates

The following must be resolved before accepting public users or unrestricted real transactions:

- Named legal operator/merchant and approved Terms, Privacy Notice, content policy, takedown process, refund policy, and retention schedule.
- Confirmed ToyyibPay merchant account, callback contract, live limits, refund capabilities, fees, and payout/disbursement position.
- Vercel plan or alternative hosting that permits commercial use.
- Supabase plan/backup/recovery arrangement appropriate to live financial records.
- Custom SMTP domain with SPF, DKIM, and DMARC.
- Production isolated file-screening worker and safe-preview pipeline.
- Verified UiTM domain allowlist and documented manual institution-verification procedure.
- MFA and recovery protection for Owner and Sheriff accounts.
- Monitoring, alerting, reconciliation, incident response, and tested payment kill switch.
- External visual handoff implemented and accessibility acceptance completed.
