# Changelog

All notable changes to VAULTIX are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Money is always shown in RM and stored
as integer sen.

## [Production candidate] — 2026-09-25

Changes on the `production` branch that are not yet on `main` (`e032efe`). 21 commits, 157 files,
+13,374 / −3,755 lines.

### Before deploying

- Apply two new migrations to Supabase Cloud, in order. Neither has been applied yet:
  1. `supabase/migrations/202609290001_profiles_free_requests_and_regions.sql`
  2. `supabase/migrations/202609300001_paid_community_codes_and_taxonomy_requests.sql`
- After applying, confirm the open campuses. Open campuses are matched by name (`ilike`).
- Regenerate Supabase types (`pnpm db:types`) if the database schema differs from
  `src/lib/supabase/database.types.ts`.
- Payment stays `disabled`. The Backer contribution endpoint
  (`POST /api/marketplace/wanted/[id]/contribution`) has not been built, and paid missing items and
  discussions return `PAYMENT_DISABLED`.
- The posting terms (`2026-09-24.2`) are a draft pending legal review. They must be reviewed before
  public launch.

### Added

**Request kinds and free requests**

- Three request kinds: academic resource, missing item and discussion. Missing items and
  discussions take text replies, never files.
- Any kind can be free or carry a bounty. A free academic request publishes with no bounty, fee or
  payment step. When a claim is approved, the poster gets access and no RM0 payout task is created.
- Each member gets 3 free requests for life. Owner-created reward codes add more. A member can
  redeem each code once, and failed attempts are limited to 10 per hour.
- A paid missing item or discussion is released when the poster names the member who helped and a
  Sheriff approves. Approval creates a manual payout task with the 10% fee. A Sheriff who is a party
  to the request cannot approve it.
- Reply threads on missing items and discussions. The poster can mark the request found or
  resolved and receives an in-app notification for each reply. Reply notifications are never
  emailed.

**Posting a Wanted**

- Duration is now 3 to 30 days, set with a slider (previously 7, 14 or 30 days).
- Bounty and Back-this-Wanted amounts use an RM1–RM50 slider with quick amounts.
- The academic session is optional, and the form's copy follows the request type.
- Versioned posting terms are shown during posting, and the snapshotted policy version is now
  `2026-09-24.2`.
- Members cannot type their own taxonomy. They ask a Sheriff to add a missing campus, faculty,
  programme, course, session, resource type or tag, and they are notified in the app and by email
  when it is decided.

**Profiles**

- `/profile` is editable: display name, bio, read-only email, verification rows, a reward code
  field and the member's entry requests.
- The picture is either one of 12 drawn avatars or the member's own photo. The photo editor
  supports drag or arrow-key positioning, zoom, 90° rotation and straightening. It saves a 512 px
  WebP; re-encoding drops camera metadata. The photo is uploaded through a one-time signed slot in
  the member's own folder and recorded only after the object exists.
- Public member pages at `/u/[publicId]` show name, avatar, joined date, badge and public Wanted
  posters only. They never show email, evidence, claims or contributions.
- The header profile chip (avatar, name, star, trust state) opens a menu with View profile, Edit
  profile and Sign out. Notifications shows an unread badge.

**Explore Map and region lock**

- The map reads campuses, region state, and live open-request and bounty totals from the database
  instead of fixtures.
- Region lock: only UiTM Shah Alam, Puncak Alam, Kuala Terengganu, Dungun and Bukit Besi accept new
  Wanted requests. The database enforces this. Other branch campuses appear as grey "coming soon"
  pins.
- Counts and totals require a verified email. Signed-out visitors see only which campuses are
  open.

**Archive and Sheriff Console**

- `/archive` (previously a dead link) lists fulfilled and resolved requests, plus *My library* of
  approved resources with freshly signed downloads.
- The Sheriff Console gains section tabs, a dashboard of queue tiles, an Appeals page, and an
  *Entries & releases* tab for taxonomy requests and community payouts.
- Appeal decisions take an inline rationale field instead of `window.prompt`.
- `/payment/return` handles the ToyyibPay return URL. It never treats the redirect as payment and
  never echoes provider references.

**API routes**

- `marketplace/allowance`, `marketplace/regions`, `marketplace/taxonomy-requests`
- `marketplace/wanted/community`, `marketplace/wanted/[id]/replies`,
  `marketplace/wanted/[id]/resolve`, `marketplace/wanted/[id]/payout-request`,
  `marketplace/wanted/drafts/[id]/free-publication`
- `profile`, `profile/avatar`, `profile/avatar/upload-url`, `profile/avatar/preset`,
  `profile/reward-code`
- `sheriff/taxonomy-requests/[id]`, `sheriff/community-payouts/[id]`

**Backend modules and data**

- New modules: `profiles`, `rewards` and `taxonomy-requests`. `wanted` gains a community service
  for replies, resolution and payout requests.
- New contracts: `profiles`, `rewards` and `taxonomy-requests`, plus extensions to `marketplace`,
  `identity` and `notifications`.
- New tables and storage: `wanted_replies`, `reward_codes`, `reward_code_redemptions`,
  `taxonomy_requests`, `community_payout_requests`, and the public `avatars` bucket (the only public
  bucket, owner-folder RLS, 512 KB limit). `payout_tasks` now references exactly one of a claim or a
  community payout request.

### Changed

- A shared `WantedPoster` renders both the Board card and the detail ledger.
- All buttons use the pixel typeface. Karla, Rye and Silkscreen are self-hosted with `next/font`.
- Claims and operations screens use the token system instead of about 250 inline styles: payout and
  refund queues, operations console, evidence locker, upload field, dispatch banner and toast, and
  the claim workspace.
- The payout queue shows each task's snapshotted fee rate instead of a hard-coded 10%.
- The desktop rail fits on one row from 1280 px. Account utilities show icons only below 85rem.
- Hunt has real *Open hunts* and *My claims* tabs, and the masthead is readable.
- The Board, Wanted and Hunt actions also work while a Wanted is ending soon or well funded.
- The UiTM Kuala Terengganu and Dungun campuses are open. The remaining branch campuses are seeded
  as coming soon.

### Fixed

- Approving a winning claim failed because the lifecycle check rejected the `fulfilled` status.
  `fulfilled` and `closed` are now allowed.
- The Hunt page queried columns that do not exist and showed invented RM25 and one-backer defaults.
  It now reads the published Wanted operation.
- Production CSS dropped the Google Fonts `@import`, so every family fell back to system fonts.
- The claim file input was unreachable by keyboard, and the upload rights confirmation was already
  ticked.
- A malformed Wanted id produced a simulated "uploaded" success in production.
- `SignOutButton` navigated away even when sign-out was refused.
- The operations tabs lacked tabpanel wiring and arrow-key navigation.
- Close and Cancel on paper dialogs used an unreadable timber-only button style.
- Two set-state-in-effect lint errors in the recovery forms.
- Error copy for payout and refund recording failures, sign-out, file upload formatting, and the
  email-verification message in the Back dialog.

### Removed

- Invented policy copy: a 48-hour free-release delay, an "only refundable on expiry" rule and
  encryption claims. Free-release copy now states only the invariant: Hunter opt-in plus
  Sheriff-confirmed rights, otherwise Backers only.
- The fixture-only hunter licence tone picker, `ProfileStudio`, and the campus-demand fixtures.

### Security and privacy notes

- The `avatars` bucket is public by design and holds only re-encoded profile pictures. Every other
  bucket stays private.
- Public profiles exclude email, evidence, claims and contributions.
- Reply notifications are in-app only and never enter email payloads.
- Reward-code redemption is rate limited, and redemptions are unique per code and member.

### Known gaps

- There is no Owner UI for creating reward codes. Use `create_reward_code` or the SQL editor.
- Account deletion is shown as unavailable until a retention decision is made.
- Free-text replies have no moderation or reporting. Reporting exists for claims only.
- About 85 Playwright specs need a reachable Supabase or have selector clashes. The failures match
  the untouched `main` baseline, so no new failures were introduced.

### Verification

- Typecheck, lint and format check pass. About 1,000 unit tests pass, and the production build
  succeeds.
- No horizontal overflow on 17 routes at 360 px and 1440 px.
- The full migration chain applies to Postgres 16 with stubbed `auth` and `storage`.
