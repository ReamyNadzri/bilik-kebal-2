# VAULTIX

## Overview

VAULTIX is an English-first, production-oriented academic resource bounty marketplace. It begins with UiTM and is designed to expand to other Malaysian higher education institutions later. Any email address may create an account after email verification, but only institution-verified users may create or fund a bounty, submit a claim, or access an approved resource. VAULTIX is limited to legitimate academic resources that the uploader is authorised to share; confidential, leaked, unlawfully obtained, institution-restricted, malicious, deceptive, or privacy-invasive material is prohibited.

## Goals

1. Let an institution-verified student publish a structured request and fund it with a contribution of RM1 to RM50.
2. Let other verified students join the request so that demand and the gross bounty are visible and auditable.
3. Release access and a reward only after technical screening and a human Sheriff decision.
4. Maintain consistent, reconcilable contribution, fee, payout, refund, entitlement, and moderation records.
5. Start with controlled UiTM testers and a Supabase-centric free-tier setup while preserving clear upgrade paths for public production use.

## Core User Flow

1. A user registers with any email address and verifies ownership of the email.
2. The user becomes institution verified automatically through an approved UiTM email domain or manually through Sheriff review. Institution-verified accounts receive a star emblem.
3. A Commissioner creates a Wanted request with UiTM academic metadata, chooses a 7-, 14-, or 30-day duration, accepts the content policy, and makes the first RM1-RM50 contribution.
4. ToyyibPay confirms payment through a verified callback. The internal ledger records the contribution once and activates or updates the bounty.
5. Other institution-verified Backers contribute RM1-RM50. Payment-provider charges are added to their checkout total; the contribution itself increases the bounty by the stated amount.
6. A Hunter submits an allowed file of at most 50 MB, supplies metadata, declares the right to share it, acknowledges the takedown and payout policy, and chooses whether it may become free after approval.
7. The file enters private quarantine. The system validates the file, scans it when a scanning worker is available, extracts metadata/text, calculates fingerprints, and attaches policy-risk evidence.
8. A Sheriff approves, rejects, quarantines, requests information, or marks a valid claim as not selected. No automation can approve a claim.
9. When several eligible claims exist, the Sheriff chooses the best valid resource; submission time is only the tie-breaker. One winning claim receives the entire bounty.
10. Approval atomically closes the bounty, grants access to all successful contributors, records the fee, and creates a manual payout task for the Owner.
11. The Owner transfers the net reward outside the system and records the payment reference and evidence. The Hunter is notified.
12. The resource remains contributor-only by default. It becomes free 48 hours after approval only when the Hunter opted in and the Sheriff confirmed the sharing rights.
13. An unfulfilled bounty expires automatically. Manual full-refund tasks are created for all successful contributions.

## Features

### Identity and Trust

- Email/password authentication with mandatory email verification and password recovery.
- Separate email-verification and institution-verification states.
- Automatic institution verification through a controlled domain allowlist and a manual evidence-review route.
- Star emblem for institution verification, with a tooltip explaining that it does not guarantee resource quality.
- Owner, Platform Sheriff, and institution-scoped Sheriff access with granular review and finance permissions.

### Wanted Board and Bounties

- Searchable and filterable UiTM Wanted Board.
- Configurable UiTM campus, faculty/college, programme, course, session, semester, resource type, language, and tag taxonomy.
- Required duplicate suggestions before a new Wanted request is published.
- Selectable 7-, 14-, or 30-day duration with no extension in the first release.
- Gross bounty, Backer count, age, status, and available action shown without previewing unverified content.

### Contributions, Fees, Payouts, and Refunds

- ToyyibPay payment collection with `Disabled`, `Sandbox`, and allowlisted `Live Limited` modes.
- RM1 minimum and RM50 maximum for each contribution, with no platform-wide daily collection cap.
- Gateway fee paid by the Commissioner or Backer on top of the contribution.
- Default 10% platform fee, snapshotted when a Wanted request is published and applied to the gross bounty.
- Integer-sen money calculations and an immutable financial ledger.
- Manual Owner payout and refund workflows with reference, timestamp, method, evidence, and audit records.
- Provider adapters for later automated payout, refund, or alternative payment integrations.

### Claims, Screening, and Moderation

- Allowed uploads: PDF, DOCX, PPTX, XLSX, JPG, PNG, and WEBP, up to 50 MB.
- Rejection of archives, executables, macro-enabled files, external-link submissions, corrupt files, and password-protected files.
- Private quarantine, MIME/signature validation, malware scanning, safe previews, metadata extraction, and policy-risk flags.
- Exact SHA-256 duplicate blocking, metadata comparison, extracted-text fingerprinting, and perceptual image hashing.
- Near-duplicate results are Sheriff evidence and cannot automatically reject a claim.
- One appeal within seven days, decided by a different authorised reviewer. Expiry and refunds pause while an appeal is active.
- Reports for restricted material, rights issues, wrong files, personal data, malware, and fraud.
- Immediate temporary restriction for high-risk reports, followed by a documented Sheriff decision.

### Access and Archive

- Entitlements created only from confirmed successful contributions after claim approval.
- Contributor-only access by default.
- Optional free release exactly 48 hours after approval when rights permit.
- Private, short-lived signed download URLs.
- Access revocation after takedown while ledger and audit evidence are preserved.

### Notifications and Operations

- In-app notifications and transactional email through Brevo.
- Initial email priority: account verification/resend, password recovery and
  security alerts, institution-verification decisions, claim decisions, and
  account restriction/appeal outcomes.
- Defer payment-related email (payment status/receipts, refunds, payouts, and
  reconciliation alerts) until the payment gateway is applied and its verified
  event flow is operational.
- Sheriff queues for claims, quarantine, reports, appeals, payout/refund tasks, and bounty exceptions.
- Owner controls for payment mode, payment kill switch, fee configuration, taxonomy, storage usage, and provider health.
- Durable queues, scheduled lifecycle jobs, retryable idempotent handlers, and operational audit logs.

## Scope

### In Scope

- Responsive web application and Sheriff/Owner console.
- UiTM-first taxonomy and institution-scoped operations.
- Controlled tester onboarding and small real-payment trials through ToyyibPay.
- Supabase PostgreSQL, Auth, Storage, Realtime where justified, Edge Functions, Queues, and Cron.
- Private academic-resource storage and manual human approval.
- Manual payout and refund execution with system-managed workflow and reconciliation.
- English interface and transactional communication.

### Out of Scope

- Public rollout to institutions other than UiTM.
- Native mobile applications.
- General-purpose wallet, stored-value transfers, cryptocurrency, or peer-to-peer balances.
- Automatic approval of academic resources.
- Automatic payout or refund in the first release.
- Paid Archive access, subscriptions, resale, reward splitting, and multiple winning Hunters.
- ZIP/RAR archives, executable files, macro-enabled Office files, or external-link-only claims.
- Malay localisation, social login, SMS, WhatsApp, and push notifications.
- Public uploads before a production isolated scanning worker is available.

## Success Criteria

1. An email-verified but institution-unverified user can browse metadata but cannot transact, claim, or download resources.
2. An institution-verified UiTM user can create and fund a valid Wanted request, and an idempotently verified ToyyibPay callback updates the ledger exactly once.
3. A supported file can move from signed upload through quarantine and human review without being exposed to unauthorised users.
4. Approving one winning claim grants exactly one entitlement per successful contributor and creates exactly one payout task.
5. Expiring an unfulfilled bounty creates one full-refund task per successful contribution without altering the original ledger entries.
6. Contributor-only and free-after-48-hours access follow the snapshotted rights decision and remain enforceable after retries.
7. A high-risk report can temporarily restrict a resource, preserve evidence, notify affected users, and produce an auditable final decision.
8. Owner payment controls can disable payment immediately and keep sandbox and live credentials isolated.
9. Primary user and Sheriff flows meet WCAG 2.1 AA and work from 360 px width upward once the external visual design is supplied.
