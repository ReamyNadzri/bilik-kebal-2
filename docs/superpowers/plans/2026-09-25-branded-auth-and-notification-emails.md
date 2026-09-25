# Branded Auth and Notification Emails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scanner-safe clickable verification and recovery links, a Sheriff alert on institution
verification submissions, a welcome email pointing at reward code `WELCOME`, spam-folder guidance,
and branded HTML for every email.

**Architecture:** Supabase Auth keeps issuing and sending auth tokens through the existing Brevo
SMTP. Its templates are rendered from repo React Email components and point at a new
`/auth/confirm` page whose button POSTs to `/api/auth/confirm`, so a token is spent only by a
human. Notification emails keep the existing outbox → Brevo API path; two new kinds are enqueued by
database triggers, and the dispatcher renders HTML + text through the same React Email layout.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, zod 4, Supabase (Postgres, Auth,
pgTAP), Brevo transactional API, `@react-email/components`, Vitest + RTL.

**Spec:** `docs/superpowers/specs/2026-09-25-branded-auth-and-notification-emails-design.md`

## Global Constraints

- Migrations are append-only. New file: `supabase/migrations/202610010001_welcome_and_sheriff_alert_emails.sql`.
- New notification kinds, exact strings: `welcome`, `institution_verification_submitted`.
- `WELCOME` seed: `credits_per_redemption = 3`, `max_redemptions = 100000`, `active = true`, `expires_at = null`.
- Confirm link types accepted: `email` (signup/resend confirmation) and `recovery`. Nothing else.
- A GET to `/auth/confirm` must never call Supabase. Only `POST /api/auth/confirm` calls `verifyOtp`.
- No email body, subject, log line, or notification row may contain evidence paths, file names,
  object keys, bucket names, tokens, or private URLs.
- Email context values are length-capped at 80 characters and rendered through React (escaped).
- Spam copy (exact): "Check your inbox and your Spam or Junk folder. If our email is there, mark it Not spam so future updates reach your inbox."
- Email footer copy (exact): "Found this in Spam? Mark it Not spam so our updates reach you."
- Email colours are literal values mirroring `src/app/globals.css` tokens; a test enforces equality.
- Logo URL: `${NEXT_PUBLIC_APP_URL}/brand/email/logo.png`, `alt="VAULTIX"`, width 96, height 96.
- Provisional brand only: no new colours or typefaces beyond existing tokens.
- Server-only code under `src/modules/**` is never imported by a client component.
- Lanes: tasks carry `Owner:`. Codex owns `supabase/**`, `src/contracts/**`, `src/modules/**`,
  `src/app/api/**`; Claude Code owns `src/app/**` (not `api/`), `src/components/**`, `public/**`.
  `context/**` and `docs/**` are shared-by-review; Task 11 names Claude Code for them.
- Every task ends with `pnpm typecheck && pnpm lint && pnpm test` green before its commit.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

## File map

| File | Responsibility |
|---|---|
| `src/contracts/notifications.ts` | Add the two kinds and their in-app messages |
| `supabase/migrations/202610010001_welcome_and_sheriff_alert_emails.sql` | Kind constraint, WELCOME seed, two publisher triggers, `claim_notification_email_batch` with `context` |
| `tests/sql/welcome_and_sheriff_alert_emails.sql` | pgTAP for the migration |
| `src/modules/notifications/email/email-theme.ts` | Literal email colours/fonts |
| `src/modules/notifications/email/email-theme.test.ts` | Drift test against `globals.css` |
| `src/modules/notifications/email/email-layout.tsx` | Shared branded layout |
| `src/modules/notifications/email/notification-email-content.ts` | Per-kind subject/heading/body/action |
| `src/modules/notifications/email/render-notification-email.tsx` | `renderNotificationEmail(kind, context, appUrl)` |
| `src/modules/notifications/email/render-notification-email.test.tsx` | Render tests |
| `src/modules/notifications/email/auth-email-templates.tsx` | Signup + recovery templates with Supabase placeholders |
| `src/modules/notifications/email/auth-email-templates.test.tsx` | File-snapshot drift guard → `supabase/templates/*.html` |
| `supabase/templates/confirmation.html`, `supabase/templates/recovery.html` | Generated auth templates |
| `supabase/config.toml` | Point local Auth at the templates, enable confirmations |
| `src/modules/notifications/adapters/brevo-email-provider.ts` | Send `htmlContent` + `textContent` |
| `src/modules/notifications/repositories/supabase-notification-email-outbox-repository.ts` | Parse `context` |
| `src/modules/notifications/services/email-delivery-service.ts` | Use the renderer |
| `src/modules/notifications/services/create-email-delivery-service.ts` | Pass `appUrl` |
| `public/brand/email/logo.png` | PNG logo for email clients |
| `src/modules/identity/delivery/email-link-confirmation.ts` | Validate input, verify, choose redirect |
| `src/modules/identity/delivery/recovery-grant-cookie.ts` | Shared recovery-grant cookie setter |
| `src/app/api/auth/confirm/route.ts` | POST handler |
| `src/app/auth/callback/route.ts` | Reuse cookie helper (no behaviour change) |
| `src/components/email-link-confirm.tsx` | Confirm page UI |
| `src/app/auth/confirm/page.tsx` | Route shell |
| `src/components/email-delivery-hint.tsx` | Spam guidance |
| `src/components/email-verification.tsx`, `recover-form.tsx`, `sign-up-form.tsx` | Place hint; sign-up goes to `/verify-email` |
| `context/*.md`, spec | Reflect reality |

---

### Task 1: Notification contract kinds

**Owner:** Codex

**Files:**
- Modify: `src/contracts/notifications.ts`
- Modify: `src/modules/notifications/services/email-delivery-service.ts:34-52` (subjects map must stay exhaustive)
- Test: `src/contracts/notifications.test.ts` (create)

**Interfaces:**
- Produces: `NotificationKind` includes `"welcome"` and `"institution_verification_submitted"`;
  `notificationMessages` has entries for both.

- [ ] **Step 1: Write the failing test**

```ts
// src/contracts/notifications.test.ts
import { expect, test } from "vitest";
import { notificationKinds, notificationMessages } from "./notifications";

test("includes the welcome and Sheriff alert kinds", () => {
  expect(notificationKinds).toContain("welcome");
  expect(notificationKinds).toContain("institution_verification_submitted");
});

test("every kind has a generic in-app message", () => {
  for (const kind of notificationKinds) {
    expect(notificationMessages[kind].length).toBeGreaterThan(10);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/contracts/notifications.test.ts`
Expected: FAIL — `expected [...] to include 'welcome'`.

- [ ] **Step 3: Implement**

In `src/contracts/notifications.ts`, append to `notificationKinds` (after `"community_bounty_awarded"`):

```ts
  "institution_verification_submitted",
  "welcome",
```

Append to `notificationMessages`:

```ts
  institution_verification_submitted:
    "A new institution verification request is waiting for review.",
  welcome:
    "Welcome to VAULTIX. Redeem code WELCOME on your profile for 3 free requests.",
```

In `email-delivery-service.ts`, append to `subjects` (this map is deleted in Task 5; keep it
compiling until then):

```ts
  institution_verification_submitted: "New institution verification request",
  welcome: "Welcome to VAULTIX",
```

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run src/contracts src/modules/notifications && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/contracts/notifications.ts src/contracts/notifications.test.ts src/modules/notifications/services/email-delivery-service.ts
git commit -m "feat(notifications): add welcome and Sheriff alert kinds"
```

---

### Task 2: Migration — seed, triggers, batch context

**Owner:** Codex

**Files:**
- Create: `supabase/migrations/202610010001_welcome_and_sheriff_alert_emails.sql`
- Create: `tests/sql/welcome_and_sheriff_alert_emails.sql`
- Regenerate: `src/lib/supabase/database.types.ts` via `pnpm db:types` (only if local Supabase runs)

**Interfaces:**
- Consumes: `public.enqueue_notification(uuid, uuid, text, uuid)`; tables `profiles`,
  `institutions`, `platform_role_assignments`, `institution_role_assignments`,
  `institution_verification_requests`, `reward_codes`.
- Produces: `public.claim_notification_email_batch(integer)` now also returns
  `notification_context jsonb`. For `institution_verification_submitted` it is
  `{"requesterDisplayName": text, "institutionName": text}`; otherwise `{}`.

- [ ] **Step 1: Write the failing pgTAP test**

```sql
-- tests/sql/welcome_and_sheriff_alert_emails.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

-- Synthetic rows only; the whole test is rolled back.
do $$
declare
  inst_a uuid := '97000000-0000-4000-8000-00000000000a';
  inst_b uuid := '97000000-0000-4000-8000-00000000000b';
  student uuid := '97000000-0000-4000-8000-000000000001';
  platform_sheriff uuid := '97000000-0000-4000-8000-000000000002';
  sheriff_a uuid := '97000000-0000-4000-8000-000000000003';
  sheriff_b uuid := '97000000-0000-4000-8000-000000000004';
begin
  insert into auth.users(id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values
    (student, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'welcome-student@example.test', now(), '{}', '{"display_name":"Aina"}', now(), now()),
    (platform_sheriff, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'welcome-ps@example.test', now(), '{}', '{"display_name":"PS"}', now(), now()),
    (sheriff_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'welcome-sa@example.test', now(), '{}', '{"display_name":"SA"}', now(), now()),
    (sheriff_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'welcome-sb@example.test', now(), '{}', '{"display_name":"SB"}', now(), now());
  insert into public.profiles(user_id, display_name) values
    (student, 'Aina'), (platform_sheriff, 'PS'), (sheriff_a, 'SA'), (sheriff_b, 'SB')
  on conflict (user_id) do update set display_name = excluded.display_name;
  insert into public.institutions(id, slug, name) values
    (inst_a, 'welcome-test-a', 'Welcome Test A'), (inst_b, 'welcome-test-b', 'Welcome Test B');
  insert into public.platform_role_assignments(user_id, role) values (platform_sheriff, 'platform_sheriff');
  insert into public.institution_role_assignments(user_id, institution_id, role) values
    (sheriff_a, inst_a, 'institution_sheriff'), (sheriff_b, inst_b, 'institution_sheriff');
end;
$$;

-- WELCOME seed
select is((select credits_per_redemption from public.reward_codes where upper(code) = 'WELCOME'), 3, 'WELCOME gives 3 free requests');
select is((select max_redemptions from public.reward_codes where upper(code) = 'WELCOME'), 100000, 'WELCOME uses the schema maximum');
select ok((select active and expires_at is null from public.reward_codes where upper(code) = 'WELCOME'), 'WELCOME is active with no expiry');

-- Sheriff alert fan-out
insert into public.institution_verification_requests(id, user_id, institution_id, evidence_object_path, evidence_delete_after)
values ('97000000-0000-4000-8000-0000000000e1', '97000000-0000-4000-8000-000000000001', '97000000-0000-4000-8000-00000000000a', 'welcome-test/evidence', now() + interval '30 days');

select is((select count(*) from public.notifications where event_id = '97000000-0000-4000-8000-0000000000e1' and kind = 'institution_verification_submitted'), 2::bigint, 'platform Sheriff and matching institution Sheriff are alerted');
select ok(exists(select 1 from public.notifications where event_id = '97000000-0000-4000-8000-0000000000e1' and recipient_user_id = '97000000-0000-4000-8000-000000000003'), 'institution A Sheriff alerted');
select ok(not exists(select 1 from public.notifications where event_id = '97000000-0000-4000-8000-0000000000e1' and recipient_user_id = '97000000-0000-4000-8000-000000000004'), 'other institution Sheriff not alerted');
select ok(not exists(select 1 from public.notifications where event_id = '97000000-0000-4000-8000-0000000000e1' and recipient_user_id = '97000000-0000-4000-8000-000000000001'), 'requester is never alerted');
select is((select count(*) from private.notification_email_outbox o join public.notifications n on n.id = o.notification_id where n.event_id = '97000000-0000-4000-8000-0000000000e1'), 2::bigint, 'each alert is queued for email');

-- Welcome on first confirmation only. A fresh, unconfirmed user: the profile is
-- created by auth_user_created_create_profile, and nothing is welcomed yet.
insert into auth.users(id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('97000000-0000-4000-8000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'welcome-new@example.test', null, '{}', '{"display_name":"New"}', now(), now());
update auth.users set email_confirmed_at = now() where id = '97000000-0000-4000-8000-000000000005';
select is((select count(*) from public.notifications where kind = 'welcome' and recipient_user_id = '97000000-0000-4000-8000-000000000005'), 1::bigint, 'welcome enqueued on first confirmation');
update auth.users set email_confirmed_at = now() + interval '1 second', updated_at = now() where id = '97000000-0000-4000-8000-000000000005';
select is((select count(*) from public.notifications where kind = 'welcome' and recipient_user_id = '97000000-0000-4000-8000-000000000005'), 1::bigint, 'later updates do not re-welcome');

-- Batch context is allow-listed. Claim once into a temp table so every row is seen.
create temp table claimed on commit drop as select * from public.claim_notification_email_batch(50);
select is(
  (select notification_context from claimed where notification_kind = 'institution_verification_submitted' limit 1),
  '{"requesterDisplayName":"Aina","institutionName":"Welcome Test A"}'::jsonb,
  'alert context carries only display name and institution name');
select ok(
  not exists(select 1 from claimed where notification_context::text like '%evidence%'),
  'no evidence path in any context');

set local role authenticated;
select throws_ok($$select * from public.claim_notification_email_batch(1)$$, '42501', null, 'browsers cannot claim email jobs');
reset role;

select * from finish();
rollback;
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test:db` (requires `supabase start`)
Expected: FAIL — WELCOME row missing / constraint rejects kind.
If no local Supabase is available, record that in the task report and continue; the SQL is still
reviewed against this test.

- [ ] **Step 3: Write the migration**

```sql
-- supabase/migrations/202610010001_welcome_and_sheriff_alert_emails.sql
-- Welcome email + WELCOME reward code, Sheriff alert on institution verification
-- submission, and allow-listed per-kind context for the email dispatcher.

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'claim_approved', 'claim_rejected', 'claim_information_requested', 'claim_not_selected',
  'institution_verification_approved', 'institution_verification_rejected',
  'payout_recorded', 'refund_recorded', 'account_restricted', 'appeal_updated',
  'wanted_reply',
  'taxonomy_request_approved', 'taxonomy_request_rejected',
  'community_payout_approved', 'community_payout_rejected', 'community_bounty_awarded',
  'institution_verification_submitted', 'welcome'
));

-- 100000 is the schema maximum for max_redemptions; it stands for "no cap".
insert into public.reward_codes (code, credits_per_redemption, max_redemptions, active, expires_at, created_by)
values ('WELCOME', 3, 100000, true, null, null)
on conflict ((upper(code))) do nothing;

create function private.publish_institution_verification_submitted_notification()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare recipient uuid;
begin
  for recipient in
    select user_id from public.platform_role_assignments where role = 'platform_sheriff'
    union
    select user_id from public.institution_role_assignments
    where role = 'institution_sheriff' and institution_id = new.institution_id
  loop
    if recipient <> new.user_id then
      perform public.enqueue_notification(new.id, recipient, 'institution_verification_submitted', new.id);
    end if;
  end loop;
  return new;
end;
$$;
revoke all on function private.publish_institution_verification_submitted_notification() from public, anon, authenticated;
create trigger institution_verification_submitted_notification
after insert on public.institution_verification_requests
for each row execute function private.publish_institution_verification_submitted_notification();

-- Runs inside Supabase Auth's transaction: it must never raise. Same-event triggers fire
-- in name order, so auth_user_created_create_profile has made the profile before
-- welcome_notification_on_insert runs for users confirmed at creation.
create function private.publish_welcome_notification()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email_confirmed_at is not null
    and (tg_op = 'INSERT' or old.email_confirmed_at is null)
    and exists (select 1 from public.profiles where user_id = new.id)
  then
    begin
      perform public.enqueue_notification(new.id, new.id, 'welcome', new.id);
    exception when others then
      null; -- A missed welcome must not block sign-up or verification.
    end;
  end if;
  return new;
end;
$$;
revoke all on function private.publish_welcome_notification() from public, anon, authenticated;
create trigger welcome_notification_on_confirm
after update of email_confirmed_at on auth.users
for each row execute function private.publish_welcome_notification();
create trigger welcome_notification_on_insert
after insert on auth.users
for each row execute function private.publish_welcome_notification();

create function private.notification_email_context(target_kind text, target_subject_id uuid)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select case target_kind
    when 'institution_verification_submitted' then coalesce((
      select jsonb_build_object(
        'requesterDisplayName', left(p.display_name, 80),
        'institutionName', left(i.name, 80))
      from public.institution_verification_requests r
      join public.profiles p on p.user_id = r.user_id
      join public.institutions i on i.id = r.institution_id
      where r.id = target_subject_id), '{}'::jsonb)
    else '{}'::jsonb
  end;
$$;
revoke all on function private.notification_email_context(text, uuid) from public, anon, authenticated;

-- Return shape changes, so drop and recreate with the same grants.
drop function public.claim_notification_email_batch(integer);
create function public.claim_notification_email_batch(batch_size integer default 20)
returns table (
  notification_id uuid,
  lease_token uuid,
  recipient_email text,
  notification_kind text,
  attempt integer,
  idempotency_expires_at timestamptz,
  correlation_id uuid,
  notification_context jsonb
)
language plpgsql security definer set search_path = '' as $$
begin
  if batch_size is null or batch_size < 1 or batch_size > 50 then
    raise exception 'INVALID_BATCH_SIZE' using errcode = '22023';
  end if;

  update private.notification_email_outbox o
  set state = 'manual_review', lease_token = null, lease_expires_at = null,
      last_error_code = 'idempotency_window_elapsed', last_error_at = now()
  where o.state in ('queued', 'leased')
    and o.idempotency_expires_at <= now()
    and (o.state = 'queued' or o.lease_expires_at <= now());

  return query
  with candidates as (
    select o.notification_id
    from private.notification_email_outbox o
    where o.state in ('queued', 'leased')
      and o.available_at <= now()
      and o.idempotency_expires_at > now()
      and (o.state = 'queued' or o.lease_expires_at <= now())
    order by o.available_at, o.created_at, o.notification_id
    limit batch_size
    for update skip locked
  ), leased as (
    update private.notification_email_outbox o
    set state = 'leased', attempt_count = o.attempt_count + 1,
        lease_token = gen_random_uuid(), lease_expires_at = now() + interval '2 minutes'
    from candidates c
    where o.notification_id = c.notification_id
    returning o.notification_id, o.lease_token, o.attempt_count, o.idempotency_expires_at, o.correlation_id
  )
  select l.notification_id, l.lease_token,
         case when u.email_confirmed_at is not null then u.email else null end,
         n.kind, l.attempt_count, l.idempotency_expires_at, l.correlation_id,
         private.notification_email_context(n.kind, n.subject_id)
  from leased l
  join public.notifications n on n.id = l.notification_id
  join auth.users u on u.id = n.recipient_user_id;
end;
$$;
revoke all on function public.claim_notification_email_batch(integer) from public, anon, authenticated;
grant execute on function public.claim_notification_email_batch(integer) to service_role;
```

Note: `wanted_reply` stays excluded by the existing `private.enqueue_notification_email()` from
`202609290001`; this migration does not touch that function.

- [ ] **Step 4: Run the database tests**

Run: `supabase db reset --local && pnpm test:db`
Expected: all files PASS, including the 13 new assertions. If the column list of
`institution_verification_requests` insert fails a check constraint, read the constraint in
`202609140001_identity_foundation.sql:55-90` and supply the missing column in the test only.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/202610010001_welcome_and_sheriff_alert_emails.sql tests/sql/welcome_and_sheriff_alert_emails.sql src/lib/supabase/database.types.ts
git commit -m "feat(db): welcome code, Sheriff submission alert, email context"
```

---

### Task 3: Email theme with drift test

**Owner:** Codex

**Files:**
- Modify: `package.json` / `pnpm-lock.yaml` via `pnpm add @react-email/components`
- Create: `src/modules/notifications/email/email-theme.ts`
- Test: `src/modules/notifications/email/email-theme.test.ts`

**Interfaces:**
- Produces: `emailTheme` (below) and `EMAIL_TOKEN_SOURCES: Record<keyof typeof emailTheme.color, string>`.

- [ ] **Step 1: Install the renderer**

Run: `pnpm add @react-email/components`
Expected: `package.json` gains the dependency; lockfile updated by pnpm.

- [ ] **Step 2: Write the failing test**

```ts
// src/modules/notifications/email/email-theme.test.ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { EMAIL_TOKEN_SOURCES, emailTheme } from "./email-theme";

const css = readFileSync(
  fileURLToPath(new URL("../../../app/globals.css", import.meta.url)),
  "utf8",
);

function firstTokenValue(name: string): string | undefined {
  const match = new RegExp(`${name}:\\s*([^;]+);`).exec(css);
  return match?.[1].trim().toLowerCase();
}

test.each(Object.entries(EMAIL_TOKEN_SOURCES))("%s mirrors %s", (key, token) => {
  const value = emailTheme.color[key as keyof typeof emailTheme.color];
  expect(firstTokenValue(token)).toBe(value.toLowerCase());
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm vitest run src/modules/notifications/email/email-theme.test.ts`
Expected: FAIL — cannot resolve `./email-theme`.

- [ ] **Step 4: Implement**

```ts
// src/modules/notifications/email/email-theme.ts
/**
 * Email clients cannot read CSS custom properties, so the provisional tokens are
 * mirrored as literals. email-theme.test.ts fails when globals.css changes, which
 * is the signal to update this file (and nothing else) at design handoff.
 */
export const emailTheme = {
  color: {
    pageBackground: "#160d08",
    headerBackground: "#1b1109",
    cardBackground: "#fbf3e0",
    canvas: "#f3e6c8",
    textPrimary: "#2a2118",
    textMuted: "#5e4f37",
    textOnDark: "#f3e6c8",
    accent: "#9e2b25",
    textOnAccent: "#ffffff",
    brass: "#c89b3c",
    border: "#8a6a3c",
  },
  font: {
    heading: "Rye, Georgia, 'Times New Roman', serif",
    body: "Karla, Arial, Helvetica, sans-serif",
  },
} as const;

export const EMAIL_TOKEN_SOURCES: Readonly<Record<keyof typeof emailTheme.color, string>> = {
  pageBackground: "--bg-base",
  headerBackground: "--bg-rail",
  cardBackground: "--bg-surface",
  canvas: "--bg-canvas",
  textPrimary: "--text-primary",
  textMuted: "--text-muted",
  textOnDark: "--text-on-dark",
  accent: "--accent-primary",
  textOnAccent: "--text-on-accent",
  brass: "--accent-brass",
  border: "--border-default",
};
```

- [ ] **Step 5: Run the test**

Run: `pnpm vitest run src/modules/notifications/email/email-theme.test.ts`
Expected: PASS (11 cases).

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml src/modules/notifications/email/email-theme.ts src/modules/notifications/email/email-theme.test.ts
git commit -m "feat(email): mirror provisional tokens for email clients"
```

---

### Task 4: Branded layout and notification renderer

**Owner:** Codex

**Files:**
- Create: `src/modules/notifications/email/email-layout.tsx`
- Create: `src/modules/notifications/email/notification-email-content.ts`
- Create: `src/modules/notifications/email/render-notification-email.tsx`
- Test: `src/modules/notifications/email/render-notification-email.test.tsx`

**Interfaces:**
- Consumes: `emailTheme` (Task 3), `NotificationKind`, `notificationMessages` (Task 1).
- Produces:
  - `EmailLayout(props: { preview: string; heading: string; paragraphs: readonly string[]; action: { label: string; href: string }; appUrl: string; children?: ReactNode })`
  - `type NotificationEmailContext = { requesterDisplayName?: string; institutionName?: string }`
  - `renderNotificationEmail(kind: NotificationKind, context: NotificationEmailContext, appUrl: string): Promise<{ subject: string; html: string; text: string }>`

- [ ] **Step 1: Write the failing test**

```tsx
// src/modules/notifications/email/render-notification-email.test.tsx
// @vitest-environment node
import { describe, expect, test } from "vitest";
import { notificationKinds } from "@/contracts/notifications";
import { renderNotificationEmail } from "./render-notification-email";

const APP = "https://bilikkebal.afes.my";
const FORBIDDEN = [/evidence/i, /object_key/i, /storage/i, /bucket/i, /quarantine/i];

describe.each(notificationKinds.filter((k) => k !== "wanted_reply"))("%s", (kind) => {
  test("renders branded HTML with a text alternative and the action URL", async () => {
    const email = await renderNotificationEmail(kind, {}, APP);
    expect(email.subject.length).toBeGreaterThan(5);
    expect(email.html).toContain("<!DOCTYPE html");
    expect(email.html).toContain(`${APP}/brand/email/logo.png`);
    expect(email.html).toContain('alt="VAULTIX"');
    expect(email.html).toContain("Mark it Not spam");
    const action = /href="(https:\/\/bilikkebal\.afes\.my\/[^"]*)"/.exec(email.html)?.[1];
    expect(action).toBeDefined();
    expect(email.text).toContain(action!.replace(/&amp;/g, "&"));
    for (const pattern of FORBIDDEN) {
      expect(email.html).not.toMatch(pattern);
      expect(email.text).not.toMatch(pattern);
    }
  });
});

test("Sheriff alert names the requester and institution, escaped", async () => {
  const email = await renderNotificationEmail(
    "institution_verification_submitted",
    { requesterDisplayName: "Aina <script>", institutionName: "UiTM Shah Alam" },
    APP,
  );
  expect(email.subject).toBe("New institution verification request");
  expect(email.html).toContain("Aina &lt;script&gt;");
  expect(email.html).not.toContain("<script>");
  expect(email.text).toContain("UiTM Shah Alam");
  expect(email.html).toContain(`${APP}/console`);
});

test("Sheriff alert falls back to neutral wording without context", async () => {
  const email = await renderNotificationEmail("institution_verification_submitted", {}, APP);
  expect(email.text).toContain("a member");
});

test("welcome email names the WELCOME code and 3 free requests", async () => {
  const email = await renderNotificationEmail("welcome", {}, APP);
  expect(email.subject).toBe("Welcome to VAULTIX");
  expect(email.text).toContain("WELCOME");
  expect(email.text).toContain("3 free requests");
  expect(email.html).toContain(`${APP}/profile`);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run src/modules/notifications/email/render-notification-email.test.tsx`
Expected: FAIL — cannot resolve `./render-notification-email`.

- [ ] **Step 3: Implement the layout**

```tsx
// src/modules/notifications/email/email-layout.tsx
import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";
import { emailTheme } from "./email-theme";

const { color, font } = emailTheme;

export const EMAIL_FOOTER_SPAM_HINT = "Found this in Spam? Mark it Not spam so our updates reach you.";

export interface EmailLayoutProps {
  preview: string;
  heading: string;
  paragraphs: readonly string[];
  action: { label: string; href: string };
  appUrl: string;
  children?: ReactNode;
}

/** Shared branded frame. Every button is followed by its URL in plain text. */
export function EmailLayout({ preview, heading, paragraphs, action, appUrl, children }: EmailLayoutProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: color.pageBackground, margin: 0, padding: "24px 0", fontFamily: font.body }}>
        <Container style={{ maxWidth: 560, margin: "0 auto" }}>
          <Section style={{ backgroundColor: color.headerBackground, padding: "20px 24px", textAlign: "center" }}>
            <Img src={`${appUrl}/brand/email/logo.png`} alt="VAULTIX" width={96} height={96} style={{ margin: "0 auto" }} />
          </Section>
          <Section style={{ backgroundColor: color.cardBackground, padding: "28px 24px", borderTop: `4px solid ${color.brass}`, borderBottom: `4px solid ${color.brass}` }}>
            <Text style={{ fontFamily: font.heading, fontSize: 24, lineHeight: "32px", color: color.textPrimary, margin: "0 0 16px" }}>
              {heading}
            </Text>
            {paragraphs.map((paragraph) => (
              <Text key={paragraph} style={{ fontSize: 16, lineHeight: "24px", color: color.textPrimary, margin: "0 0 12px" }}>
                {paragraph}
              </Text>
            ))}
            {children}
            <Button href={action.href} style={{ backgroundColor: color.accent, color: color.textOnAccent, fontSize: 16, fontWeight: 700, padding: "12px 20px", textDecoration: "none", display: "inline-block", marginTop: 8 }}>
              {action.label}
            </Button>
            <Text style={{ fontSize: 13, lineHeight: "20px", color: color.textMuted, margin: "16px 0 0", wordBreak: "break-all" }}>
              If the button does not work, open this link: <Link href={action.href} style={{ color: color.accent }}>{action.href}</Link>
            </Text>
          </Section>
          <Section style={{ padding: "16px 24px", textAlign: "center" }}>
            <Hr style={{ borderColor: color.border, margin: "0 0 12px" }} />
            <Text style={{ fontSize: 13, lineHeight: "20px", color: color.textOnDark, margin: "0 0 4px" }}>
              {EMAIL_FOOTER_SPAM_HINT}
            </Text>
            <Text style={{ fontSize: 13, lineHeight: "20px", color: color.textOnDark, margin: 0 }}>
              VAULTIX · <Link href={appUrl} style={{ color: color.textOnDark }}>{appUrl.replace(/^https?:\/\//, "")}</Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
```

- [ ] **Step 4: Implement per-kind content**

```ts
// src/modules/notifications/email/notification-email-content.ts
import { notificationMessages, type NotificationKind } from "@/contracts/notifications";

export interface NotificationEmailContext {
  requesterDisplayName?: string;
  institutionName?: string;
}

export interface NotificationEmailContent {
  subject: string;
  heading: string;
  paragraphs: string[];
  action: { label: string; path: string };
}

const subjects: Readonly<Record<NotificationKind, string>> = {
  claim_approved: "Your claim was approved",
  claim_rejected: "Your claim was not approved",
  claim_information_requested: "More information is needed for your claim",
  claim_not_selected: "Your claim was not selected",
  institution_verification_approved: "Your institution verification was approved",
  institution_verification_rejected: "Your institution verification was not approved",
  payout_recorded: "A payout was recorded",
  refund_recorded: "A refund was recorded",
  account_restricted: "An account restriction was recorded",
  appeal_updated: "Your appeal has an update",
  // In-app only; the outbox never queues it (migration 202609290001).
  wanted_reply: "Someone replied to your request",
  taxonomy_request_approved: "The entry you asked for was added",
  taxonomy_request_rejected: "The entry you asked for was not added",
  community_payout_approved: "Your bounty release was approved",
  community_payout_rejected: "Your bounty release was not approved",
  community_bounty_awarded: "You were awarded a bounty",
  institution_verification_submitted: "New institution verification request",
  welcome: "Welcome to VAULTIX",
};

const cap = (value: string | undefined) => value?.slice(0, 80).trim() || undefined;

/** Server-composed copy; only allow-listed context fields are ever interpolated. */
export function notificationEmailContent(
  kind: NotificationKind,
  context: NotificationEmailContext,
): NotificationEmailContent {
  if (kind === "institution_verification_submitted") {
    const who = cap(context.requesterDisplayName) ?? "a member";
    const where = cap(context.institutionName);
    return {
      subject: subjects[kind],
      heading: "A verification request needs review",
      paragraphs: [
        `A new institution verification request from ${who}${where ? ` at ${where}` : ""} is waiting for review.`,
        "Open the review queue to see the request. Its details are only shown inside VAULTIX.",
      ],
      action: { label: "Open review queue", path: "/console" },
    };
  }
  if (kind === "welcome") {
    return {
      subject: subjects[kind],
      heading: "Welcome to VAULTIX",
      paragraphs: [
        "Your email is verified. You can now sign in and browse the Wanted Board.",
        "Funding a bounty, submitting a claim and downloading a resource also need institution verification, which a Sheriff grants separately.",
        "Redeem code WELCOME on your profile for 3 free requests. Each member can use it once.",
      ],
      action: { label: "Go to my profile", path: "/profile" },
    };
  }
  return {
    subject: subjects[kind],
    heading: subjects[kind],
    paragraphs: [notificationMessages[kind]],
    action: { label: "Open VAULTIX", path: "/notifications" },
  };
}
```

- [ ] **Step 5: Implement the renderer**

```tsx
// src/modules/notifications/email/render-notification-email.tsx
import { render } from "@react-email/components";
import type { NotificationKind } from "@/contracts/notifications";
import { EmailLayout } from "./email-layout";
import {
  notificationEmailContent,
  type NotificationEmailContext,
} from "./notification-email-content";

export type { NotificationEmailContext } from "./notification-email-content";

export async function renderNotificationEmail(
  kind: NotificationKind,
  context: NotificationEmailContext,
  appUrl: string,
): Promise<{ subject: string; html: string; text: string }> {
  const content = notificationEmailContent(kind, context);
  const origin = appUrl.replace(/\/+$/, "");
  const element = (
    <EmailLayout
      preview={content.paragraphs[0]}
      heading={content.heading}
      paragraphs={content.paragraphs}
      action={{ label: content.action.label, href: `${origin}${content.action.path}` }}
      appUrl={origin}
    />
  );
  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ]);
  return { subject: content.subject, html, text };
}
```

- [ ] **Step 6: Run the tests**

Run: `pnpm vitest run src/modules/notifications/email`
Expected: PASS. If `render(..., { plainText: true })` omits link URLs, append
`\n\n${content.action.label}: ${href}` to `text` in the renderer and re-run.

- [ ] **Step 7: Commit**

```bash
git add src/modules/notifications/email
git commit -m "feat(email): branded layout and notification renderer"
```

---

### Task 5: Dispatcher sends branded HTML

**Owner:** Codex

**Files:**
- Modify: `src/modules/notifications/adapters/brevo-email-provider.ts:6-11,51-58`
- Modify: `src/modules/notifications/adapters/brevo-email-provider.test.ts`
- Modify: `src/modules/notifications/repositories/supabase-notification-email-outbox-repository.ts:8-16,41-50`
- Modify: `src/modules/notifications/repositories/supabase-notification-email-outbox-repository.test.ts`
- Modify: `src/modules/notifications/services/email-delivery-service.ts`
- Modify: `src/modules/notifications/services/email-delivery-service.test.ts`
- Modify: `src/modules/notifications/services/create-email-delivery-service.ts`

**Interfaces:**
- Consumes: `renderNotificationEmail`, `NotificationEmailContext` (Task 4); batch column
  `notification_context` (Task 2).
- Produces: `NotificationEmailInput` = `{ notificationId; recipient; subject; text; html }`;
  `NotificationEmailJob` gains `context: NotificationEmailContext`;
  `NotificationEmailDeliveryDependencies` gains `appUrl: string`.

- [ ] **Step 1: Write failing tests**

Add to `brevo-email-provider.test.ts` (reuse the file's existing fake-fetch helper pattern):

```ts
test("sends both HTML and text bodies", async () => {
  const fetcher = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ messageId: "m-1" }), { status: 201 }),
  );
  const provider = new BrevoNotificationEmailProvider({
    apiKey: "k", fromEmail: "noreply@example.test", fromName: "VAULTIX", fetcher,
  });
  await provider.send({
    notificationId: "00000000-0000-4000-8000-000000000001",
    recipient: "a@example.test",
    subject: "S",
    text: "plain",
    html: "<p>rich</p>",
  });
  const body = JSON.parse(fetcher.mock.calls[0][1].body as string);
  expect(body.htmlContent).toBe("<p>rich</p>");
  expect(body.textContent).toBe("plain");
});
```

Add to `supabase-notification-email-outbox-repository.test.ts`:

```ts
test("maps allow-listed context and defaults it to an empty object", async () => {
  const row = {
    notification_id: "00000000-0000-4000-8000-000000000001",
    lease_token: "00000000-0000-4000-8000-000000000002",
    recipient_email: "s@example.test",
    notification_kind: "institution_verification_submitted",
    attempt: 1,
    idempotency_expires_at: "2026-10-01T00:14:00+00:00",
    correlation_id: "00000000-0000-4000-8000-000000000003",
    notification_context: { requesterDisplayName: "Aina", institutionName: "UiTM", extra: "x" },
  };
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify([row, { ...row, notification_context: null }])));
  const repo = new SupabaseNotificationEmailOutboxRepository({ baseUrl: "https://db.example", serviceRoleKey: "k", fetcher });
  const [first, second] = await repo.claimBatch();
  expect(first.context).toEqual({ requesterDisplayName: "Aina", institutionName: "UiTM" });
  expect(second.context).toEqual({});
});
```

Add to `email-delivery-service.test.ts` (adapt to the file's existing fake repository/provider
builders; pass `appUrl: "https://bilikkebal.afes.my"` in dependencies):

```ts
test("renders branded HTML with context for the provider", async () => {
  // job fixture: kind "institution_verification_submitted",
  // context { requesterDisplayName: "Aina", institutionName: "UiTM" }
  await service.dispatchBatch();
  const sent = provider.send.mock.calls[0][0];
  expect(sent.subject).toBe("New institution verification request");
  expect(sent.html).toContain("Aina");
  expect(sent.text).toContain("UiTM");
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run src/modules/notifications`
Expected: FAIL on the three new tests (missing `html`, `context`, `appUrl`).

- [ ] **Step 3: Implement**

`brevo-email-provider.ts` — add `html: string;` to `NotificationEmailInput`, and in the body:

```ts
          subject: input.subject,
          htmlContent: input.html,
          textContent: input.text,
```

`supabase-notification-email-outbox-repository.ts`:

```ts
const contextSchema = z
  .object({
    requesterDisplayName: z.string().max(80).optional(),
    institutionName: z.string().max(80).optional(),
  })
  .strip();

// inside claimedJobSchema:
  notification_context: contextSchema.nullable().optional(),

// inside the map:
      context: row.notification_context ?? {},
```

`email-delivery-service.ts`:
- Delete the `subjects` map and the `notificationMessages` import.
- `import { renderNotificationEmail, type NotificationEmailContext } from "../email/render-notification-email";`
- Add `context: NotificationEmailContext;` to `NotificationEmailJob`.
- Add `appUrl: string;` to `NotificationEmailDeliveryDependencies`.
- Replace the `provider.send({...})` call with:

```ts
        const email = await renderNotificationEmail(job.kind, job.context, this.dependencies.appUrl);
        const delivered = await this.dependencies.provider.send({
          notificationId: job.notificationId,
          recipient: job.recipient,
          subject: email.subject,
          text: email.text,
          html: email.html,
        });
```

`create-email-delivery-service.ts`: change the import to
`import { parsePublicEnv, resolveSupabasePublicConfig } from "@/lib/config/public-env";` and add
`appUrl: parsePublicEnv(process.env).NEXT_PUBLIC_APP_URL,` to the `NotificationEmailDeliveryService`
dependencies.

Update any existing test fixtures that build `NotificationEmailJob` to include `context: {}` and
dependencies to include `appUrl`.

- [ ] **Step 4: Run tests and typecheck**

Run: `pnpm vitest run src/modules/notifications && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/notifications
git commit -m "feat(notifications): dispatch branded HTML with allow-listed context"
```

---

### Task 6: Email logo asset

**Owner:** Claude Code

**Files:**
- Create: `public/brand/email/logo.png` (96×96) and `public/brand/email/logo@2x.png` (192×192)

- [ ] **Step 1: Export PNGs from the provisional logo**

Run:
```bash
pnpm dlx sharp-cli -i public/brand/logo-tile.webp -o public/brand/email/logo.png resize 96 96
pnpm dlx sharp-cli -i public/brand/logo-tile.webp -o public/brand/email/logo@2x.png resize 192 192
```
Expected: two PNG files. Verify with `file public/brand/email/*.png` → `PNG image data, 96 x 96` / `192 x 192`.

- [ ] **Step 2: Visually check**

Read `public/brand/email/logo@2x.png` with the Read tool; confirm it is the logo tile, not blank.

- [ ] **Step 3: Commit**

```bash
git add public/brand/email
git commit -m "chore(brand): provisional PNG logo for email clients"
```

---

### Task 7: Supabase auth email templates

**Owner:** Codex

**Files:**
- Create: `src/modules/notifications/email/auth-email-templates.tsx`
- Test: `src/modules/notifications/email/auth-email-templates.test.tsx`
- Create (generated): `supabase/templates/confirmation.html`, `supabase/templates/recovery.html`
- Modify: `supabase/config.toml` (`[auth.email]` block, lines ~219-250)

**Interfaces:**
- Consumes: `EmailLayout` (Task 4).
- Produces: `renderAuthEmailTemplate(kind: "confirmation" | "recovery"): Promise<string>`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/modules/notifications/email/auth-email-templates.test.tsx
// @vitest-environment node
import { expect, test } from "vitest";
import { renderAuthEmailTemplate } from "./auth-email-templates";

test("confirmation template targets the scanner-safe confirm page", async () => {
  const html = await renderAuthEmailTemplate("confirmation");
  expect(html).toContain("{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=email");
  expect(html).toContain("{{ .SiteURL }}/brand/email/logo.png");
  expect(html).toContain("Mark it Not spam");
  await expect(html).toMatchFileSnapshot("../../../../supabase/templates/confirmation.html");
});

test("recovery template has the link and the 6-digit code fallback", async () => {
  const html = await renderAuthEmailTemplate("recovery");
  expect(html).toContain("{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=recovery");
  expect(html).toContain("{{ .Token }}");
  await expect(html).toMatchFileSnapshot("../../../../supabase/templates/recovery.html");
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run src/modules/notifications/email/auth-email-templates.test.tsx`
Expected: FAIL — cannot resolve `./auth-email-templates`.

- [ ] **Step 3: Implement**

```tsx
// src/modules/notifications/email/auth-email-templates.tsx
import { render, Text } from "@react-email/components";
import { EmailLayout } from "./email-layout";
import { emailTheme } from "./email-theme";

/** Supabase Go-template placeholders are left verbatim for Supabase Auth to fill. */
const SITE = "{{ .SiteURL }}";
const confirmUrl = (type: "email" | "recovery") =>
  `${SITE}/auth/confirm?token_hash={{ .TokenHash }}&type=${type}`;

export async function renderAuthEmailTemplate(kind: "confirmation" | "recovery"): Promise<string> {
  if (kind === "confirmation") {
    return render(
      <EmailLayout
        preview="Confirm your VAULTIX email address"
        heading="Confirm your email"
        paragraphs={[
          "Press the button to confirm this address belongs to you. The link works once and expires in 1 hour.",
          "If you did not create a VAULTIX account, ignore this email.",
        ]}
        action={{ label: "Confirm my email", href: confirmUrl("email") }}
        appUrl={SITE}
      />,
    );
  }
  return render(
    <EmailLayout
      preview="Reset your VAULTIX password"
      heading="Reset your password"
      paragraphs={[
        "Press the button to choose a new password. The link works once and expires in 1 hour.",
        "If you did not ask to reset your password, ignore this email. Your password stays the same.",
      ]}
      action={{ label: "Reset my password", href: confirmUrl("recovery") }}
      appUrl={SITE}
    >
      <Text style={{ fontSize: 16, lineHeight: "24px", color: emailTheme.color.textPrimary, margin: "0 0 12px" }}>
        Or enter this 6-digit code on the reset page:{" "}
        <strong style={{ fontSize: 20, letterSpacing: 4 }}>{"{{ .Token }}"}</strong>
      </Text>
    </EmailLayout>,
  );
}
```

- [ ] **Step 4: Generate the template files**

Run: `pnpm vitest run -u src/modules/notifications/email/auth-email-templates.test.tsx`
Expected: PASS; `supabase/templates/confirmation.html` and `recovery.html` are written.
Then run without `-u` and expect PASS (drift guard).

- [ ] **Step 5: Point local Supabase at the templates**

In `supabase/config.toml` under `[auth.email]` set `enable_confirmations = true` and add:

```toml
[auth.email.template.confirmation]
subject = "Confirm your VAULTIX email"
content_path = "./supabase/templates/confirmation.html"

[auth.email.template.recovery]
subject = "Reset your VAULTIX password"
content_path = "./supabase/templates/recovery.html"
```

- [ ] **Step 6: Commit**

```bash
git add src/modules/notifications/email/auth-email-templates.tsx src/modules/notifications/email/auth-email-templates.test.tsx supabase/templates supabase/config.toml
git commit -m "feat(auth): branded scanner-safe Supabase email templates"
```

---

### Task 8: `POST /api/auth/confirm`

**Owner:** Codex

**Files:**
- Create: `src/modules/identity/delivery/recovery-grant-cookie.ts`
- Create: `src/modules/identity/delivery/email-link-confirmation.ts`
- Test: `src/modules/identity/delivery/email-link-confirmation.test.ts`
- Create: `src/app/api/auth/confirm/route.ts`
- Test: `src/app/api/auth/confirm/route.test.ts`
- Modify: `src/app/auth/callback/route.ts:45-60` (use cookie helper; behaviour unchanged)

**Interfaces:**
- Consumes: `resolveAuthCallbackPath`, `safeNextPath`, `createPasswordRecoveryGrant`,
  `getIdentityPendingCookieSecret`, `createSupabaseServerClient`.
- Produces:
  - `parseEmailLinkInput(input: { tokenHash: unknown; type: unknown; next: unknown }): { tokenHash: string; type: "email" | "recovery"; next: string } | null`
  - `confirmPathFor(input, errorCode: string | null): string`
  - `setRecoveryGrantCookie(response: NextResponse, userId: string): void`
  - Page contract used by Task 9: `/auth/confirm?token_hash=&type=&next=&status=unavailable`.

- [ ] **Step 1: Write the failing unit test**

```ts
// src/modules/identity/delivery/email-link-confirmation.test.ts
import { expect, test } from "vitest";
import { confirmPathFor, parseEmailLinkInput } from "./email-link-confirmation";

test.each([
  [{ tokenHash: "abc123", type: "email", next: null }, { tokenHash: "abc123", type: "email", next: "/profile" }],
  [{ tokenHash: "pkce_ab-C_9", type: "recovery", next: "/x" }, { tokenHash: "pkce_ab-C_9", type: "recovery", next: "/x" }],
  [{ tokenHash: "abc", type: "email", next: "//evil.example" }, { tokenHash: "abc", type: "email", next: "/profile" }],
])("accepts %j", (input, expected) => {
  expect(parseEmailLinkInput(input)).toEqual(expected);
});

test.each([
  { tokenHash: "", type: "email", next: null },
  { tokenHash: "abc", type: "signup", next: null },
  { tokenHash: "abc", type: "magiclink", next: null },
  { tokenHash: "a b", type: "email", next: null },
  { tokenHash: "x".repeat(513), type: "email", next: null },
  { tokenHash: 5, type: "email", next: null },
])("rejects %j", (input) => {
  expect(parseEmailLinkInput(input)).toBeNull();
});

test("maps outcomes to existing destinations", () => {
  const email = { tokenHash: "abc", type: "email" as const, next: "/profile" };
  const recovery = { tokenHash: "abc", type: "recovery" as const, next: "/profile" };
  expect(confirmPathFor(email, null)).toBe("/verify-email?status=verified");
  expect(confirmPathFor(email, "otp_expired")).toBe("/verify-email?status=expired");
  expect(confirmPathFor(email, "invalid")).toBe("/verify-email?status=invalid");
  expect(confirmPathFor(recovery, null)).toBe("/reset-password");
  expect(confirmPathFor(recovery, "otp_expired")).toBe("/reset-password?status=expired");
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run src/modules/identity/delivery/email-link-confirmation.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the helpers**

```ts
// src/modules/identity/delivery/email-link-confirmation.ts
import { resolveAuthCallbackPath } from "./auth-callback";
import { safeNextPath } from "./auth-http";

export type EmailLinkType = "email" | "recovery";
export interface EmailLinkInput {
  tokenHash: string;
  type: EmailLinkType;
  next: string;
}

const TOKEN_HASH = /^[A-Za-z0-9_-]{1,512}$/;

/** Link parameters are untrusted: only the two types our templates emit are accepted. */
export function parseEmailLinkInput(input: {
  tokenHash: unknown;
  type: unknown;
  next: unknown;
}): EmailLinkInput | null {
  if (typeof input.tokenHash !== "string" || !TOKEN_HASH.test(input.tokenHash)) return null;
  if (input.type !== "email" && input.type !== "recovery") return null;
  const next = safeNextPath(typeof input.next === "string" ? input.next : null, "/profile");
  return { tokenHash: input.tokenHash, type: input.type, next };
}

export function confirmPathFor(input: EmailLinkInput, errorCode: string | null): string {
  return resolveAuthCallbackPath({ errorCode, next: input.next, otpType: input.type });
}
```

```ts
// src/modules/identity/delivery/recovery-grant-cookie.ts
import type { NextResponse } from "next/server";
import { getIdentityPendingCookieSecret } from "@/lib/config/server-env";
import { createPasswordRecoveryGrant } from "@/modules/identity/services/password-recovery-grant";

/** Binds a short-lived password-reset grant to the user who spent the recovery link. */
export function setRecoveryGrantCookie(response: NextResponse, userId: string): void {
  response.cookies.set(
    "vaultix_password_recovery",
    createPasswordRecoveryGrant(userId, getIdentityPendingCookieSecret(process.env)),
    {
      httpOnly: true,
      maxAge: 15 * 60,
      path: "/api/auth/reset-password",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  );
}
```

In `src/app/auth/callback/route.ts`, replace the inline `response.cookies.set("vaultix_password_recovery", …)`
block with `setRecoveryGrantCookie(response, user.id);` and drop the now-unused imports.

- [ ] **Step 4: Write the failing route test**

```ts
// src/app/api/auth/confirm/route.test.ts
import { beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: { verifyOtp: vi.fn(), getUser: vi.fn() },
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: mocks.auth }),
}));

import { POST } from "./route";

const user = { id: "00000000-0000-4000-8000-000000000001" };

function post(fields: Record<string, string>) {
  return new Request("https://vaultix.example/api/auth/confirm", {
    method: "POST",
    body: new URLSearchParams(fields),
    headers: { "content-type": "application/x-www-form-urlencoded" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("IDENTITY_PENDING_COOKIE_SECRET", "local-test-cookie-secret-with-more-than-32-chars");
  mocks.auth.verifyOtp.mockResolvedValue({ error: null });
  mocks.auth.getUser.mockResolvedValue({ data: { user }, error: null });
});

test("verifies an email link once and redirects to the verified state", async () => {
  const response = await POST(post({ token_hash: "abc", type: "email" }));
  expect(mocks.auth.verifyOtp).toHaveBeenCalledWith({ token_hash: "abc", type: "email" });
  expect(response.status).toBe(303);
  expect(response.headers.get("location")).toBe("https://vaultix.example/verify-email?status=verified");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});

test("recovery issues the grant cookie and goes to reset", async () => {
  const response = await POST(post({ token_hash: "abc", type: "recovery" }));
  expect(response.headers.get("location")).toBe("https://vaultix.example/reset-password");
  expect(response.headers.get("set-cookie")).toContain("vaultix_password_recovery=");
});

test("expired link goes to the expired state", async () => {
  mocks.auth.verifyOtp.mockResolvedValue({ error: { code: "otp_expired", status: 403 } });
  const response = await POST(post({ token_hash: "abc", type: "email" }));
  expect(response.headers.get("location")).toBe("https://vaultix.example/verify-email?status=expired");
});

test("provider outage returns to the confirm page so the unspent link can be retried", async () => {
  mocks.auth.verifyOtp.mockResolvedValue({ error: { code: undefined, status: 503 } });
  const response = await POST(post({ token_hash: "abc", type: "email" }));
  expect(response.headers.get("location")).toBe(
    "https://vaultix.example/auth/confirm?token_hash=abc&type=email&status=unavailable",
  );
});

test("rejects unsupported types without calling Supabase", async () => {
  const response = await POST(post({ token_hash: "abc", type: "magiclink" }));
  expect(mocks.auth.verifyOtp).not.toHaveBeenCalled();
  expect(response.headers.get("location")).toBe("https://vaultix.example/verify-email?status=invalid");
});
```

- [ ] **Step 5: Implement the route**

```ts
// src/app/api/auth/confirm/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  confirmPathFor,
  parseEmailLinkInput,
} from "@/modules/identity/delivery/email-link-confirmation";
import { setRecoveryGrantCookie } from "@/modules/identity/delivery/recovery-grant-cookie";

export const dynamic = "force-dynamic";

function redirect(path: string, origin: string): NextResponse {
  // 303 turns the form POST into a GET on the destination.
  const response = NextResponse.redirect(new URL(path, origin), 303);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

/** The only place a confirmation or recovery token is spent. Never logs the token. */
export async function POST(request: Request): Promise<Response> {
  const origin = new URL(request.url).origin;
  const form = await request.formData().catch(() => null);
  const input = parseEmailLinkInput({
    tokenHash: form?.get("token_hash"),
    type: form?.get("type"),
    next: form?.get("next"),
  });
  if (!input) return redirect("/verify-email?status=invalid", origin);

  const client = await createSupabaseServerClient();
  const { error } = await client.auth.verifyOtp({ token_hash: input.tokenHash, type: input.type });

  if (error) {
    const status = (error as { status?: number }).status;
    if (status === undefined || status >= 500 || status === 429) {
      const retry = new URLSearchParams({ token_hash: input.tokenHash, type: input.type, status: "unavailable" });
      return redirect(`/auth/confirm?${retry.toString()}`, origin);
    }
    return redirect(confirmPathFor(input, (error as { code?: string }).code ?? "invalid"), origin);
  }

  const response = redirect(confirmPathFor(input, null), origin);
  if (input.type === "recovery") {
    const { data, error: userError } = await client.auth.getUser();
    if (userError || !data.user) return redirect("/sign-in?error=recovery_failed", origin);
    setRecoveryGrantCookie(response, data.user.id);
  }
  return response;
}
```

- [ ] **Step 6: Run tests**

Run: `pnpm vitest run src/modules/identity/delivery src/app/api/auth src/app/auth && pnpm typecheck`
Expected: PASS, including the existing callback and reset-password tests.

- [ ] **Step 7: Commit**

```bash
git add src/modules/identity/delivery src/app/api/auth/confirm src/app/auth/callback/route.ts
git commit -m "feat(auth): spend email link tokens only on POST"
```

---

### Task 9: `/auth/confirm` page

**Owner:** Claude Code

**Files:**
- Create: `src/components/email-link-confirm.tsx`
- Test: `src/components/email-link-confirm.test.tsx`
- Create: `src/app/auth/confirm/page.tsx`

**Interfaces:**
- Consumes: `POST /api/auth/confirm` form fields `token_hash`, `type`, `next` (Task 8); `UiStatus`.
- Produces: `EmailLinkConfirm(props: { tokenHash: string | null; type: "email" | "recovery" | null; next: string | null; unavailable: boolean })`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/email-link-confirm.test.tsx
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { EmailLinkConfirm } from "./email-link-confirm";

test("email link shows a confirm button that posts the token", () => {
  const { container } = render(
    <EmailLinkConfirm tokenHash="abc" type="email" next={null} unavailable={false} />,
  );
  const button = screen.getByRole("button", { name: "Confirm my email" });
  const form = button.closest("form")!;
  expect(form.getAttribute("method")).toBe("post");
  expect(form.getAttribute("action")).toBe("/api/auth/confirm");
  expect(container.querySelector('input[name="token_hash"]')).toHaveValue("abc");
  expect(container.querySelector('input[name="type"]')).toHaveValue("email");
});

test("recovery link shows a reset button", () => {
  render(<EmailLinkConfirm tokenHash="abc" type="recovery" next={null} unavailable={false} />);
  expect(screen.getByRole("button", { name: "Reset my password" })).toBeInTheDocument();
});

test("explains why a button is needed", () => {
  render(<EmailLinkConfirm tokenHash="abc" type="email" next={null} unavailable={false} />);
  expect(screen.getByText(/security scanners/i)).toBeInTheDocument();
});

test("invalid link offers a way to get a new one and no button", () => {
  render(<EmailLinkConfirm tokenHash={null} type={null} next={null} unavailable={false} />);
  expect(screen.getByRole("heading", { name: "This link cannot be used" })).toBeInTheDocument();
  expect(screen.queryByRole("button")).toBeNull();
  expect(screen.getByRole("link", { name: "Request a new link" })).toHaveAttribute("href", "/verify-email");
});

test("unavailable state keeps the button so the unspent link can be retried", () => {
  render(<EmailLinkConfirm tokenHash="abc" type="email" next={null} unavailable />);
  expect(screen.getByRole("alert")).toHaveTextContent(/could not reach/i);
  expect(screen.getByRole("button", { name: "Confirm my email" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run src/components/email-link-confirm.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the component**

```tsx
// src/components/email-link-confirm.tsx
import Link from "next/link";
import { UiStatus } from "@/components/ui-status";

export interface EmailLinkConfirmProps {
  tokenHash: string | null;
  type: "email" | "recovery" | null;
  next: string | null;
  unavailable: boolean;
}

/**
 * Opening the link does nothing on its own: email security scanners open links
 * before people do, so the one-time token is spent only when this form is sent.
 * A plain form POST works without JavaScript and by keyboard.
 */
export function EmailLinkConfirm({ tokenHash, type, next, unavailable }: EmailLinkConfirmProps) {
  if (!tokenHash || !type) {
    return (
      <UiStatus
        kind="error"
        heading="This link cannot be used"
        message="It is incomplete or was changed. Request a new link and use the newest email."
        action={
          <p className="auth-form__links">
            <Link href="/verify-email">Request a new link</Link>
            <Link href="/recover">Reset your password</Link>
          </p>
        }
      />
    );
  }

  const isRecovery = type === "recovery";
  return (
    <form className="auth-form" method="post" action="/api/auth/confirm">
      {unavailable ? (
        <UiStatus
          kind="offline"
          heading="We could not reach the sign-in service"
          message="Your link has not been used. Try the button again in a moment."
        />
      ) : null}
      <p>
        {isRecovery
          ? "Press the button to continue to choosing a new password."
          : "Press the button to confirm this email address belongs to you."}
      </p>
      <p className="text-muted">
        We ask for this press because some email security scanners open links automatically, which
        would otherwise use up your one-time link.
      </p>
      <input type="hidden" name="token_hash" value={tokenHash} />
      <input type="hidden" name="type" value={type} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <button className="auth-form__submit" type="submit">
        {isRecovery ? "Reset my password" : "Confirm my email"}
      </button>
    </form>
  );
}
```

Check that `UiStatus` with `kind="offline"` renders `role="alert"` (see `announcementRole` in
`ui-status.tsx`); if it renders `role="status"`, change the test's `getByRole("alert")` to
`getByRole("status")` — do not change `UiStatus`.

- [ ] **Step 4: Implement the page**

```tsx
// src/app/auth/confirm/page.tsx
import type { Metadata } from "next";
import { EmailLinkConfirm } from "@/components/email-link-confirm";

export const metadata: Metadata = { title: "Confirm | VAULTIX" };
export const dynamic = "force-dynamic";

function first(value: string | string[] | undefined): string | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && candidate.length > 0 ? candidate : null;
}

/** Renders only. It never calls Supabase, so a scanner's GET spends nothing. */
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawType = first(params.type);
  const type = rawType === "email" || rawType === "recovery" ? rawType : null;
  const tokenHash = first(params.token_hash);
  const validToken = tokenHash && /^[A-Za-z0-9_-]{1,512}$/.test(tokenHash) ? tokenHash : null;

  return (
    <>
      <h1>{type === "recovery" ? "Reset your password" : "Confirm your email"}</h1>
      <EmailLinkConfirm
        tokenHash={validToken}
        type={type}
        next={first(params.next)}
        unavailable={first(params.status) === "unavailable"}
      />
    </>
  );
}
```

- [ ] **Step 5: Run tests and check it in the browser**

Run: `pnpm vitest run src/components/email-link-confirm.test.tsx && pnpm typecheck`
Expected: PASS.
Then `pnpm dev`, open `http://localhost:3000/auth/confirm?token_hash=abc&type=email` at 360 px and
1280 px widths; Tab to the button; confirm nothing overflows and focus is visible.

- [ ] **Step 6: Commit**

```bash
git add src/components/email-link-confirm.tsx src/components/email-link-confirm.test.tsx src/app/auth/confirm
git commit -m "feat(ui): scanner-safe email link confirm page"
```

---

### Task 10: Spam-folder guidance and sign-up destination

**Owner:** Claude Code

**Files:**
- Create: `src/components/email-delivery-hint.tsx`
- Test: `src/components/email-delivery-hint.test.tsx`
- Modify: `src/components/email-verification.tsx:94-104,158-163`
- Modify: `src/components/recover-form.tsx:139-151`
- Modify: `src/components/sign-up-form.tsx:94-96`
- Modify tests: `email-verification.test.tsx`, `recover-form.test.tsx`, `sign-up-form.test.tsx`

**Interfaces:**
- Produces: `EmailDeliveryHint()` and `EMAIL_DELIVERY_HINT` (the exact spam copy string).

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/email-delivery-hint.test.tsx
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { EMAIL_DELIVERY_HINT, EmailDeliveryHint } from "./email-delivery-hint";

test("tells the user to check spam and mark it not spam", () => {
  render(<EmailDeliveryHint />);
  expect(EMAIL_DELIVERY_HINT).toBe(
    "Check your inbox and your Spam or Junk folder. If our email is there, mark it Not spam so future updates reach your inbox.",
  );
  expect(screen.getByRole("note")).toHaveTextContent("mark it Not spam");
});
```

Add to `email-verification.test.tsx`:

```tsx
test("pending state shows the spam-folder hint", () => {
  render(<EmailVerification status="pending" address={ADDRESS} />);
  expect(screen.getByRole("note")).toHaveTextContent("Spam or Junk");
});
```

Add to `recover-form.test.tsx` (use the file's existing helper that submits a valid email and
resolves the operation as accepted):

```tsx
test("accepted recovery request shows the spam-folder hint", async () => {
  // …submit a valid email with an accepted response, as the existing accepted-state test does…
  expect(await screen.findByRole("note")).toHaveTextContent("Spam or Junk");
});
```

Update the existing sign-up success assertion in `sign-up-form.test.tsx` from
`expect(push).toHaveBeenCalledWith("/sign-in")` to `"/verify-email"`.

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run src/components/email-delivery-hint.test.tsx src/components/email-verification.test.tsx src/components/recover-form.test.tsx src/components/sign-up-form.test.tsx`
Expected: FAIL on the new/changed assertions.

- [ ] **Step 3: Implement**

```tsx
// src/components/email-delivery-hint.tsx
export const EMAIL_DELIVERY_HINT =
  "Check your inbox and your Spam or Junk folder. If our email is there, mark it Not spam so future updates reach your inbox.";

/** Deliverability guidance shown wherever an action sends an email. */
export function EmailDeliveryHint() {
  return (
    <p role="note" className="text-muted">
      {EMAIL_DELIVERY_HINT}
    </p>
  );
}
```

`email-verification.tsx`:
- After the `status === "pending"` `UiStatus`, render `<EmailDeliveryHint />` inside the same
  conditional (wrap both in a fragment).
- Replace the `email-verification__sent` paragraph text with
  `If that address still needs a link, one is on its way.` followed by `<EmailDeliveryHint />`.

`recover-form.tsx`: inside the `outcome.kind === "accepted"` block, after the `UiStatus`, add
`<EmailDeliveryHint />`, and change the `UiStatus` message to
`"Check your email for a reset link. You can also enter the 6-digit code from the same email."`

`sign-up-form.tsx`: change `router.push("/sign-in")` to `router.push("/verify-email")`. The sign-up
route already sets the pending-verification cookie that `/verify-email` reads.

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run src/components && pnpm typecheck && pnpm lint`
Expected: PASS. Fix any existing test that asserted the old recover message or old resend text by
updating it to the new copy.

- [ ] **Step 5: Commit**

```bash
git add src/components
git commit -m "feat(ui): spam-folder guidance and verify-email after sign-up"
```

---

### Task 11: Docs, context, and final gates

**Owner:** Claude Code (shared-by-review files: `context/**`, `docs/**`)

**Files:**
- Modify: `context/progress-tracker.md` (append entry)
- Modify: `context/architecture.md` (auth email flow + notification kinds)
- Modify: `docs/superpowers/specs/2026-09-25-branded-auth-and-notification-emails-design.md`
  (signup link type is `email`; confirm logic lives in `email-link-confirmation.ts`, not `AuthService`)

- [ ] **Step 1: Update the spec to match the plan**

In the spec §1 replace `type=signup|recovery` with `type=email|recovery`, and replace
"calls a new `AuthService.confirmEmailLink` → `SupabaseAuthGateway.verifyEmailLink`" with
"uses `parseEmailLinkInput` / `confirmPathFor` in `src/modules/identity/delivery/email-link-confirmation.ts`
and calls `verifyOtp` directly, matching `/auth/callback`". Add to the manual steps: "Supabase →
Auth → Providers → Email: enable Confirm email."

- [ ] **Step 2: Append to `context/progress-tracker.md`**

```md
- 2026-09-25 branded auth and notification emails:
  - Verification and recovery links open `/auth/confirm`; the token is spent only by the button's
    POST to `/api/auth/confirm` (Safe Links / scanner-safe). Recovery emails keep the 6-digit code.
  - Auth templates are generated from `src/modules/notifications/email/auth-email-templates.tsx`
    into `supabase/templates/*.html` and must be pasted into the Supabase dashboard.
  - New notification kinds `institution_verification_submitted` (platform Sheriffs + that
    institution's Sheriffs, never the requester) and `welcome` (once, on first email confirmation).
  - Reward code `WELCOME`: 3 free requests, max_redemptions 100000 (schema maximum = "no cap").
  - All emails are branded HTML + text. `email-theme.ts` mirrors provisional tokens; a test fails on drift.
  - Logo `public/brand/email/logo.png` is provisional.
  - Pending user actions: apply migration 202610010001; paste templates; enable Confirm email;
    add `/auth/confirm` to redirect URLs; confirm `NEXT_PUBLIC_APP_URL` in Vercel Production.
```

- [ ] **Step 3: Update `context/architecture.md`**

Under the notifications/auth section, add one paragraph stating: auth mail = Supabase Auth over
Brevo SMTP with repo-owned templates; `/auth/confirm` GET renders only, POST spends the token;
notification mail = outbox → Brevo API with HTML + text rendered by React Email; email context is
allow-listed per kind in `private.notification_email_context`.

- [ ] **Step 4: Run every gate**

Run:
```bash
pnpm format
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```
Expected: all pass (lint may show the one known sign-out warning). Also run `pnpm test:db` if
local Supabase is available; otherwise say so in the report.

- [ ] **Step 5: Leak check**

Run: `git grep -nE "token_hash|TokenHash" -- src ':!*.test.*'` and confirm no `console.*` line logs
a token, email address, or link. Run `pnpm build` output grep: `grep -r "BREVO_API_KEY" .next/static` → no matches.

- [ ] **Step 6: Commit**

```bash
git add context docs
git commit -m "docs: record branded auth and notification emails"
```

---

## Manual steps for the user (after merge)

1. Apply `supabase/migrations/202610010001_welcome_and_sheriff_alert_emails.sql` to Supabase Cloud.
2. Supabase → Auth → Providers → Email: enable **Confirm email**.
3. Supabase → Auth → Email Templates: paste `supabase/templates/confirmation.html` into
   **Confirm signup** (subject "Confirm your VAULTIX email") and `recovery.html` into **Reset
   password** (subject "Reset your VAULTIX password").
4. Supabase → Auth → URL Configuration: Site URL = production origin; add `<origin>/auth/confirm`.
5. Vercel Production: `NEXT_PUBLIC_APP_URL` = public origin (the email logo loads from it).
