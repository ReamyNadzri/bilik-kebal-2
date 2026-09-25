# Branded auth and notification emails — design

Date: 2026-09-25 · Status: approved in conversation, awaiting written-spec review · Branch: `production`

Supplements the six context files. Where this spec conflicts with them, the stricter security,
privacy, or launch-gate requirement wins.

## Goal

1. Email verification, verification resend, and password recovery arrive as branded emails with a
   clickable link that survives link-scanning (Microsoft Defender Safe Links) and marks the email
   verified / starts the reset only on a human action.
2. Sheriffs are emailed when a student submits an institution verification request.
3. Every newly verified member is emailed a welcome message pointing at reward code `WELCOME`.
4. Every screen that causes an email tells the user to check Spam/Junk and mark it Not spam.
5. All emails (auth and notification) are HTML using the site's provisional design and logo, with
   a plain-text alternative.

## Non-goals

- No change to who sends auth mail: Supabase Auth keeps issuing, expiring, and sending auth tokens
  through the already-configured Brevo custom SMTP.
- No custom token table, no Supabase Send Email hook.
- No payment, payout, refund, or appeal emails (still withheld).
- No auto-redemption of `WELCOME`; the member redeems it through the existing flow.
- No student-written message in the Sheriff alert, and no evidence content in any email.
- No final brand assets; the theme and logo remain provisional.

## Decisions (recorded from conversation)

| Topic | Decision |
|---|---|
| Auth email transport | Approach A: Supabase Auth + Brevo SMTP, repo-owned HTML templates pasted into the Supabase dashboard |
| One-time link | Link opens `/auth/confirm`; token is consumed only by a POST after a button press |
| Recovery | Link plus the existing 6-digit code as fallback |
| Institution email | Alert to Sheriffs on submission, fixed system message (display name + institution + review link) |
| WELCOME | Code shown in welcome email; member redeems it; 3 free requests; "no cap" = 100,000 (schema maximum) |
| Email look | React Email renderer, shared layout, inline token values mirrored from `globals.css`, PNG logo |

## 1. Scanner-safe auth links

### Flow

```
Supabase Auth email ──link──▶ GET /auth/confirm?token_hash=…&type=signup|recovery[&next=…]
                                  │ renders page only; no token use
                                  ▼
                        [Confirm my email] / [Reset my password]   (button)
                                  │ POST /api/auth/confirm {token_hash, type, next}
                                  ▼
                 verifyOtp({ token_hash, type })  ── server-side, once
                    ├─ signup   ok → redirect /sign-in?verified=1 (or /profile if a session exists)
                    ├─ recovery ok → issue existing password-recovery grant → /reset-password
                    └─ error       → expired/used state with Resend (signup) or Request new link (recovery)
```

### Rules

- `GET /auth/confirm` never calls Supabase. It validates only that `type ∈ {signup, recovery}` and
  that `token_hash` is present and shaped plausibly (1–512 URL-safe chars); otherwise it shows the
  invalid-link state.
- `POST /api/auth/confirm` (Codex lane: `src/app/api/**`) validates input with zod, calls a new
  `AuthService.confirmEmailLink` → `SupabaseAuthGateway.verifyEmailLink`, and returns an
  `OperationResult`. `next` goes through the existing `safeNextPath`.
- Recovery success reuses `createPasswordRecoveryGrant` exactly as `/auth/callback` does today.
- `/auth/callback` keeps handling PKCE `code` exchanges. Its GET `token_hash` branch stays for
  links already in inboxes, but the new templates never target it.
- The confirm page is a normal form POST so it works without JavaScript and by keyboard.
- Logged: operation name, outcome code, correlation id. Never the token, email, or link.
- Rate limit: the confirm POST is bounded by Supabase's own verify limits; resend and recovery keep
  their current cooldowns (recovery form 2 minutes).

### Page states (`/auth/confirm`)

ready (button), submitting, success-signup, success-recovery (redirects), expired/used, invalid
link, offline, provider unavailable. All states show plain English beside any themed wording.

## 2. Sheriff alert on institution verification submission

- New notification kind `institution_verification_submitted`, added to the `notifications_kind_check`
  constraint, the `NotificationKind` contract, `notificationMessages`, and email subjects.
- New append-only migration adds trigger `after insert on public.institution_verification_requests`
  calling `private.publish_institution_verification_submitted_notification()`, which calls
  `public.enqueue_notification(new.id, recipient, 'institution_verification_submitted', new.id)`
  for each distinct recipient:
  - every user in `platform_role_assignments` with role `platform_sheriff`, and
  - every user in `institution_role_assignments` with role `institution_sheriff` for
    `new.institution_id`,
  - excluding the requesting user.
- Idempotency: `enqueue_notification` already dedupes on `(event_id, recipient_user_id)`; the event
  id is the request id.
- In-app: the notification also appears in the Sheriff's inbox (default behaviour of the table).
- Email content (fixed system message):
  - Subject: "New institution verification request"
  - Body: "A new institution verification request from **<display name>** at **<institution
    name>** is waiting for review." Button: "Open review queue" → `/console` verification queue.
  - Display name and institution name are looked up at send time (see §5 dispatcher context); no
    evidence path, file name, or evidence URL is ever included.

## 3. WELCOME reward code and welcome email

- Migration seeds `reward_codes` idempotently:
  `code = 'WELCOME', credits_per_redemption = 3, max_redemptions = 100000, active = true,
  expires_at = null, created_by = null` — `on conflict (upper(code)) do nothing`.
  100,000 is the schema maximum; recorded as the meaning of "no cap" in `progress-tracker.md`.
- New notification kind `welcome`.
- Trigger `after update of email_confirmed_at on auth.users` (security definer, `search_path = ''`)
  enqueues `welcome` when `old.email_confirmed_at is null and new.email_confirmed_at is not null`,
  with `event_id = new.id` (the user id) so a user is welcomed at most once. Also covers users
  confirmed at insert time via an `after insert` branch when `email_confirmed_at is not null`.
  The trigger requires a matching `public.profiles` row; if absent, it does nothing rather than
  failing the auth transaction.
- Email content: "Welcome to VAULTIX." Explains email verified vs institution verified in one line,
  then: "Redeem code **WELCOME** on your profile for 3 free requests. Each member can use it once."
  Button: "Go to my profile" → `/profile`.
- Redemption uses the existing `redeem_reward_code` RPC unchanged.

## 4. Spam-folder guidance

Shared component `EmailDeliveryHint` (Claude lane, `src/components/`), shown:

- after successful sign-up,
- on `/verify-email` and after a resend,
- after a recovery request on `/recover`.

Copy: "Check your inbox and your Spam or Junk folder. If our email is there, mark it **Not spam**
so future updates reach your inbox." Rendered as a polite live-region note, not an error.
Every email footer carries the short version: "Found this in Spam? Mark it Not spam so our updates
reach you."

## 5. Branded HTML emails

### Renderer

- Dependency: `@react-email/components` + `@react-email/render` (added via pnpm; lockfile
  updated by the package manager only).
- Location: `src/modules/notifications/email/` (server-only; never imported by client components):
  - `email-theme.ts` — literal colour/spacing values mirroring the provisional tokens
    (`--bg-base`, `--bg-canvas`, `--bg-surface`, `--text-primary`, `--text-muted`,
    `--accent-primary`, `--accent-brass`, `--border-default`, `--text-on-dark`, …).
  - `layout.tsx` — `EmailLayout`: dark timber header with logo, parchment card, brass rule, primary
    button, visible fallback URL under every button, footer with spam hint and site link.
  - `templates/*.tsx` — one component per notification kind plus `auth-signup`, `auth-recovery`.
  - `render.ts` — `renderNotificationEmail(kind, context) → { subject, html, text }`.
- Fonts: `Rye, Georgia, serif` for headings; `Karla, Arial, sans-serif` for body. Web fonts are not
  embedded; brand lettering lives in the logo image.
- Logo: PNG exported once from `public/brand/logo-tile.webp` to `public/brand/email/logo.png`
  (and `@2x`), referenced by absolute URL `${NEXT_PUBLIC_APP_URL}/brand/email/logo.png`, with
  `alt="VAULTIX"` and explicit width/height.
- Accessibility: `lang="en"`, role="presentation" layout tables, text contrast ≥ 4.5:1 using the
  already-verified token pairs, status and money wording in plain English.

### Auth templates

- Script `pnpm email:auth-templates` renders `auth-signup` and `auth-recovery` with Supabase Go
  placeholders left verbatim (`{{ .SiteURL }}`, `{{ .TokenHash }}`, `{{ .Token }}`) into
  `supabase/templates/confirmation.html` and `supabase/templates/recovery.html`, and the
  resend-verification path uses the same confirmation template.
  - Signup link: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup`
  - Recovery link: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`
    plus the 6-digit `{{ .Token }}` fallback block.
- `supabase/config.toml` references these files for local Supabase.
- A test asserts the committed HTML equals a fresh render (drift guard).

### Notification dispatcher changes

- `NotificationEmailInput` gains `html: string`; the Brevo adapter sends `htmlContent` and
  `textContent` together.
- `claim_notification_email_batch` is replaced (new migration, `create or replace`) to also return
  `context jsonb`, built per kind with an allow-list:
  - `institution_verification_submitted`: `{ requesterDisplayName, institutionName }`
  - all other kinds: `{}`
  Values are length-capped (80 chars) and HTML-escaped by React rendering.
- `email-delivery-service.ts` replaces the fixed `subjects` + `notificationMessages` send with
  `renderNotificationEmail(job.kind, job.context)`. Existing kinds keep their current subject and
  message text inside the new layout.
- `welcome` and `institution_verification_submitted` are emailed; `wanted_reply` stays in-app only.

## Ownership (two-lane rule)

| Work | Lane |
|---|---|
| Migrations, RPC changes, triggers, seed, pgTAP | Codex (`supabase/**`) |
| Contracts (`NotificationKind`, confirm operation) | Codex (`src/contracts/**`) |
| Gateway/service/dispatcher/renderer/templates | Codex (`src/modules/**`) |
| `POST /api/auth/confirm` | Codex (`src/app/api/**`) |
| `/auth/confirm` page, `EmailDeliveryHint`, page wiring | Claude Code (`src/app/**`, `src/components/**`) |
| `public/brand/email/logo.png` | Claude Code (asset) — provisional |
| Context/progress updates | shared-by-review; named in the slice brief |

This spec names the lanes; the implementation plan assigns each task an `Owner:`.

## Manual steps for the user (protected production settings)

1. Apply the new migrations to Supabase Cloud.
2. Supabase → Auth → Email Templates: paste `confirmation.html` (Confirm signup) and
   `recovery.html` (Reset password); set subjects "Confirm your VAULTIX email" and
   "Reset your VAULTIX password".
3. Supabase → Auth → URL Configuration: ensure Site URL is the production origin and
   `/auth/confirm` is in the redirect allow-list.
4. Confirm `NEXT_PUBLIC_APP_URL` in Vercel Production is the public origin (logo URL depends on it).

## Testing and acceptance criteria

- **Confirm route/service**: signup success, recovery success (grant issued), expired, already used,
  wrong type, missing token, unsafe `next`; GET never calls Supabase (asserted with a spy).
- **Confirm page**: all states render; keyboard-only submit; works at 360 px; no-JS form POST.
- **Renderer**: snapshot per kind for HTML and text; every text part contains the action URL;
  HTML contains no `evidence`, `storage`, `object_key`, or bucket names; logo has alt text.
- **Theme drift**: test parses `src/app/globals.css` and asserts every `email-theme.ts` value equals
  its token.
- **Auth templates drift**: committed `supabase/templates/*.html` equal a fresh render and contain
  `{{ .TokenHash }}` and `/auth/confirm`.
- **Brevo adapter**: sends both `htmlContent` and `textContent`; existing retry classification
  unchanged.
- **pgTAP**:
  - submission fans out to platform Sheriffs and the matching institution's Sheriffs only, never
    the requester, never another institution's Sheriff; replay inserts nothing new;
  - welcome enqueued once on first confirmation, not on later updates, not for a user without a
    profile; outbox row created;
  - `WELCOME` seed exists with 3 credits and re-running the seed is a no-op;
  - `claim_notification_email_batch` returns only allow-listed context keys; `anon`/`authenticated`
    cannot execute it.
- **Spam hint**: component test for each of the four placements.
- **Gates**: typecheck, lint, format, unit tests, production build pass; no email, token, or
  private URL in logs.

## Risks

- Supabase dashboard templates can drift from the repo; mitigated by the drift test plus the
  manual step checklist.
- Trigger on `auth.users` runs inside Supabase Auth's transaction; it must never raise. It uses
  `enqueue_notification`'s `on conflict do nothing` and guards the profile lookup.
- Image blocking hides the logo; the layout stays readable with alt text and live-text headings.
