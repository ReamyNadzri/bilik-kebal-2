# Performance Remediation — Executed Plan

- **Date:** 2026-09-26
- **Branch:** `claude/vibrant-heisenberg-3g7ujl` (user-directed full-stack slice)
- **Source:** a diagnostic report drafted with Gemini, reviewed here against the code and against the
  installed Next.js 16.3.5, React 19.3 and supabase-js 2.116 sources, then executed with the
  corrections recorded below.

## 1. What actually makes pages slow

1. **Region.** The production deployment runs its functions in `iad1` (Washington, D.C.); the
   Supabase project `yuzgkjowtcfwqanituta` is in `ap-southeast-1` (Singapore). Every Supabase call a
   page makes crosses the Pacific and back, roughly 200 ms each, and a page waits on three to six of
   them in sequence. This is the largest single cause and it is not a code change — see §6.
2. **Reads that waited on each other.** Independent reads were awaited one after another: the root
   layout's account read then the unread count; the Hunt page's account, Board and own-claims reads;
   a Wanted and the viewer's account; every console page's guard before its data.
3. **Console overview waterfall.** The overview fetched four queue counts from the browser after
   hydration, each a separate function invocation that checked the session again.
4. **Prefetch traffic.** 13–27 prefetch requests per page view, each a function invocation that
   runs the session proxy, for links whose destinations are rendered per request anyway.
5. **The map, twice.** `/map` downloaded the 397 KB map art as-is through CSS (ship sprites) in
   addition to the resized copy `next/image` serves.

## 2. Review of the original findings

| Original claim | Verdict | Evidence |
| --- | --- | --- |
| Supabase images are not the main cause | Correct | Avatars are 16–22 KB; the map and hero go through `next/image` |
| `<Link>` defaults to `prefetch={true}` | Incorrect | Default is `null` ("auto"); for these dynamic routes Next prefetches the route tree and, where one exists, the `loading.tsx` shell (`link.js`, `segment-cache/scheduler.js`) |
| Each prefetch runs 15–25 queries; 250+ per click | Incorrect | Route-tree prefetches render no layout or page; loading-boundary prefetches stop at `loading.tsx` (`walk-tree-with-flight-router-state.js`, `create-component-tree.js`). Their cost is one invocation plus the session proxy each |
| 15–20 prefetches stall on the 6-connection limit | Overstated | Next 16.3.5 caps viewport prefetches at 4 concurrent (12 on hover); Vercel serves HTTP/2. The requests were real, though: 13–27 per page (§4) |
| `prefetch={false}` falls back to hover prefetching | Incorrect | In the App Router it disables hover prefetching too; the shell now prefetches on intent itself |
| `React.cache` is absent | Correct | — |
| 7 Supabase Auth round trips per page | Incorrect in effect | The code called `auth.getUser()` up to seven times, but Next memoises identical GET `fetch` calls within a render (`dedupe-fetch.js`); measured: **1** Auth call per page before and after |
| Console dashboard fires 4 client fetches | Correct | Removed |
| `force-dynamic` stops catalogue caching | Partly | `force-dynamic` only stops full-route caching; a shared cache was ruled out on access-control grounds (§5) |
| Map 406 → ~95 KB and hero 355 → ~110 KB at WebP q80 | Incorrect | Both are already about q80: re-encoding at q80 gives 387 KB and 349 KB. `next/image` already sends phones a resized copy (≈65–150 KB) |
| Textures shrink ~50% losslessly | Incorrect | They are mostly lossy already; q75 saves 1–7 KB each at visible cost |
| — (not in the report) | — | Function region mismatch (§1.1); the raw map download on `/map` (§1.5) |

## 3. What changed

**Prefetching (Phase 1).** `prefetch={false}` on per-item and per-tab links: Wanted cards, Hunt
cards and claim cards, console tabs and overview tiles, console queues (entries, releases, hidden
messages, members), notification lists, library titles, the map's campus link and the wordmark.
The shell rail and "Post a Wanted" prefetch on intent (pointer, touch or focus) through
`router.prefetch`, which keeps their loading state instant without a request per link on sight.

**Request-scoped reads (Phase 2).** `getRequestSupabaseClient()` and `getRequestUser()` in
`src/lib/supabase/server.ts`, and `loadAccountContext()` in the identity loaders, wrapped in
`React.cache`: one client, one Auth check and one account read per server render, shared by the
layout, the guard and every loader. `readAccount()` is cached the same way. React scopes `cache` to
one request and does not memoise outside a render (route handlers), so nothing is shared between
requests or viewers. Independent reads now run together: the layout, `/claims`, `/wanted/[id]`, the
Wanted detail's summary and extras, the library lookups, and every console page's guard and data.

**Console overview (Phase 3).** `loadConsoleQueueCounts()` counts the claim, appeal, payout and
refund queues on the server through the same operations the queues use, in parallel, and each
count fails on its own. `ConsoleDashboard` is presentational and sends no request.

**Images (Phase 4).** The ship sprites read `public/brand/map-ships.webp`, a 43.8 KB lossless strip
cut from the map art (each tile pixel-identical to the art), instead of the 397 KB map. Plain
`<img>` elements (Wanted picture uploads, drawn-avatar choices, badge images) load lazily.

## 4. Measurements

Production builds of the branch before this change (`5959705`) and after it, served locally against a stand-in
Supabase (ES256 sessions verified through its JWKS, like an asymmetric-key project) that adds
**100 ms to every call** to model the distance. Median of three runs, signed in as an Owner.

| Page | Full load before → after (ms) | Navigation before → after (ms) |
| --- | --- | --- |
| `/claims` | 644 → 333 | 637 → 325 |
| `/wanted/[id]` | 436 → 332 | 637 → 328 |
| `/console/people` | 532 → 325 | 526 → 320 |
| `/console/badges` | 534 → 320 | 529 → 319 |
| `/console/requests` | 430 → 323 | 422 → 322 |
| `/console` | 430 → 326, and 4 browser API calls → 0 | 317 → 319 |
| `/map`, `/archive`, `/notifications`, `/forbidden` and other pages | ≈430 → ≈325 | unchanged to −100 |
| `/board`, `/profile`, `/wanted/new` | 476 / 449 / 439 → 455 / 429 / 432 | unchanged |

Supabase calls per render did not change (1 Auth call; the same database calls), confirming the
fetch memoisation above: the gains come from removing sequential waits. At the real `iad1` to
Singapore distance each saved wait is roughly twice what is shown here.

Background requests in Chromium within 6 s of load (before → after):

| Page | Prefetch requests | Browser API calls |
| --- | --- | --- |
| `/` | 13 → 4 | 0 → 0 |
| `/board` | 21 → 2 | 0 → 0 |
| `/claims` | 25 → 0 | 0 → 0 |
| `/console` | 27 → 0 | 4 → 0 |
| `/console/people` | 27 → 0 | 0 → 0 |
| `/archive` | 13 → 2 | 0 → 0 |
| `/profile` | 16 → 4 | 0 → 0 |

The remaining prefetches are single call-to-action links (such as "Post a Wanted"), which keep their
instant loading state. `/map` now downloads the 43.8 KB ship strip instead of the 397 KB map a
second time; the sprites match the previous rendering apart from single-pixel sampling seams.

## 5. Not done, and why

- **Shared (cross-user) caching of taxonomy, institutions and campus regions.** RLS lets only
  email-verified, signed-in users read these tables, and `unstable_cache` cannot read cookies, so a
  shared cache would have to read with the service-role client — an RLS bypass, which is a protected
  area. Campus regions also carry bounty totals, and financial data must not enter shared caches
  (`context/code-standards.md`). The saving is one round trip of a few milliseconds once §6.1 is
  done.
- **Re-encoding the hero, map and textures.** Measured above: already about q80.
- **Embedding the institution in the account read** (`institutions(id, name)` on the membership
  query). It would save one round trip on every page, but this environment's egress policy blocks
  the Supabase API, so it could not be verified against the live PostgREST schema, and a failure
  there would make every account read fail. Validate it on a preview deployment first.
- **`auth.getClaims()` instead of `auth.getUser()` in loaders.** `getUser()` asks the Auth server,
  which notices revoked sessions and returns `email_confirmed_at` and `last_sign_in_at` (used for
  the email trust state and the 15-minute step-up). Switching changes trust semantics and needs a
  decision.
- **Client-side queue fetches in Claim reviews, Appeals and Operations.** Those screens still load
  their queue from the browser after hydration, the pattern removed from the overview. A follow-up.

## 6. Recommended actions for the Owner

1. **Run functions next to the database.** Vercel → Project `vaultix` → Settings → Functions →
   Function Region → **Singapore (`sin1`)**, then redeploy; or commit `vercel.json` with
   `{ "regions": ["sin1"] }`. This turns each round trip from ~200 ms into a few milliseconds. It is
   a production setting, so it was left for the Owner: on a paid plan, check Vercel's regional
   pricing for function usage before switching.
2. **Check the JWT signing keys.** Supabase → Project Settings → JWT Keys. If the legacy HS256
   secret is still the current key, the session proxy's `getClaims()` falls back to calling
   Supabase Auth on every request, prefetches included. Rotating to an asymmetric (ECC) key lets it
   verify sessions locally.
