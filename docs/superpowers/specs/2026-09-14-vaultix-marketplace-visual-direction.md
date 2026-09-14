# VAULTIX marketplace-first visual direction

Status: approved temporary direction. Supersedes nothing; it extends
`docs/superpowers/specs/2026-09-13-vaultix-provisional-ui.md` from a neutral accessibility baseline
to a themed one, and implements the direction recorded in `context/ui-context.md`.

Every value here is **provisional**. It is an implementation aid, not an approved brand asset, and
the Final Visual Handoff Gate in `context/ui-context.md` still applies. The point of the token layer
is that the handoff replaces values, not components.

## 1. What the product is

An academic resource bounty marketplace for Malaysian university students. A student posts a
structured request, classmates pool RM1–RM50 each behind it, a Hunter submits a file, a human
Sheriff decides, and only then does anyone get access or money.

Two consequences drive every decision below.

**The marketplace is the product.** Authentication is plumbing. A visitor must understand the loop
before being asked to sign in, so the root page is a board, not a door.

**Money and moderation are on the page.** A student is being asked to part with RM10 on the promise
that a stranger will be reviewed fairly. The interface has to look organised and accountable. That
rules out anything playful enough to read as a game, and anything anonymous enough to read as a
template.

## 2. The direction in one sentence

An organised academic bounty ledger: paper case files pinned to a dark timber board, with brass
marking the money.

Not a cowboy game. The frontier reference is the *bounty board* as an information object — posted
notices, stamped statuses, index tabs, a value plate — not saloons, guns, horses, characters or
sepia. `context/ui-context.md` forbids imitating Red Dead Redemption trade dress, and nothing in
this direction derives from it.

### 2.1 The structural idea

Most of the visual identity comes from one inversion, not from decoration:

**the page ground is dark timber, and content is a parchment sheet laid on it.**

A light page with warm accents is the commonest look a generated interface arrives at. Putting the
dark surface *outside* the content and the paper *inside* it gives the product a frame, makes every
screen read as "a notice posted on a board", and costs nothing in legibility — all body text still
sits on paper at 12:1 or better.

It also means the existing Identity screens inherit the theme without being rewritten: they already
render inside `main`, and `main` is now the sheet.

## 3. Colour

Implemented as semantic custom properties in `src/app/globals.css`. No component may use a literal
colour. Ratios below are computed, not estimated.

### 3.1 Base palette

| Name | Value |
| --- | --- |
| Night ink | `#211A14` |
| Board timber | `#493323` |
| Parchment canvas | `#E9D8AF` |
| Fresh paper | `#FFF8E8` |
| Leather action | `#74421F` |
| Aged brass | `#B88A32` |
| Trail teal | `#135A56` (darkened from `#176B67` for AA on parchment) |
| Marshal red | `#8F2D27` (darkened from `#9D342E` for headroom on parchment) |
| Muted ink | `#655A4B` |

### 3.2 Semantic roles

| Role | Token | Value | Verified against |
| --- | --- | --- | --- |
| Application background | `--bg-base` | `#211A14` | sheet on it 12.19 |
| Elevated board surface | `--bg-board` | `#493323` | header, footer, dark rails |
| Board canvas (the sheet) | `--bg-canvas` | `#E9D8AF` | primary text 12.19 |
| Paper surface | `--bg-surface` | `#FFF8E8` | primary text 16.23 |
| Inset paper | `--bg-subtle` | `#DFCFA5` | primary text 11.13, muted 4.36 |
| Primary text | `--text-primary` | `#211A14` | paper 16.23, canvas 12.19 |
| Muted text | `--text-muted` | `#655A4B` | paper 6.37, canvas 4.78 |
| Text on dark | `--text-on-dark` | `#E9D8AF` | timber 8.37, ink 12.19 |
| Muted text on dark | `--text-on-dark-muted` | `#C6B48C` | timber 5.79, ink 8.43 |
| Text on accent | `--text-on-accent` | `#FFF8E8` | leather 7.81 |
| Strong border | `--border-strong` | `#7D6A4F` | paper 4.90, canvas 3.68 |
| Default border | `--border-default` | `#8E7A5C` | paper 3.90 |
| Subtle divider | `--border-subtle` | `#C4B18A` | decorative only |
| Brass rule (on dark) | `--accent-brass` | `#B88A32` | timber 3.77, ink 5.50 |
| Brass text (on light) | `--accent-brass-ink` | `#8A6620` | paper 4.96 |
| Primary action | `--accent-primary` | `#74421F` | paper text on it 7.81 |
| Primary action hover | `--accent-primary-hover` | `#5C3417` | paper text on it 10.13 |
| Secondary accent | `--accent-secondary` | `#135A56` | paper 7.56, canvas 5.68 |
| Focus ring | `--focus-ring` | `#1E63E6` | paper 4.98, canvas 3.74 |
| Focus halo | `--focus-ring-contrast` | `#FFF8E8` | timber 11.14, ink 16.23 |
| Safe / verified | `--state-success` | `#135A56` | paper 7.56, canvas 5.68 |
| Warning / pending | `--state-warning` | `#7E4A00` | paper 6.92, canvas 5.20 |
| Danger / restricted | `--state-error` | `#8F2D27` | paper 7.71, canvas 5.79 |
| Information | `--state-info` | `#14557A` | paper 7.60, canvas 5.71 |
| Bounty plate ground | `--bounty-plate-bg` | `#211A14` | — |
| Bounty value | `--bounty-value` | `#CFA043` | on plate 7.17 |
| Selected navigation | `--nav-selected` | `#FFF8E8` + brass rule | timber 11.14 |
| Disabled control | `--control-disabled` | `#655A4B` on `--bg-subtle` | 4.36 |

### 3.3 Two rules that constrain use

**Brass is never text on a light ground.** `#B88A32` on fresh paper is 2.95:1. Brass appears as a
rule or edge on dark surfaces, or as `--accent-brass-ink` when it must carry words on paper. The
bounty value is legible because the plate is dark, not because brass is bright.

**No status is colour alone.** Every stamp carries its word. Every status additionally differs in
border weight or style, so the distinction survives greyscale and colour-blindness.

**Focus needs two bands, not one.** No single hue clears 3:1 against both paper and timber. The ring
is a blue outline plus a paper-coloured halo: on light grounds the blue carries it, on dark grounds
the halo does.

## 4. Typography

Two families, clearly distinct, both from locally available stacks. No remote font is introduced —
matching a generated reference image is not worth a network dependency on a page that shows money.

| Role | Token | Stack |
| --- | --- | --- |
| Wordmark, page headings, Wanted titles | `--font-display` | `Charter, "Bitstream Charter", "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif` |
| Body, navigation, forms, metadata, filters, policy, status | `--font-ui` | existing humanist system stack |
| Money and counts | `.numeric` | `--font-ui` with `font-variant-numeric: tabular-nums` |

Charter and Iowan Old Style ship with macOS and many Linux distributions; Palatino Linotype and
Georgia cover Windows. All are sturdy book serifs — a printed ledger, not a novelty face.

Deliberately avoided: distressed or western display faces; all-caps metadata; monospace for small
labels; letter-spaced eyebrow labels above headings. Letter-spacing appears in exactly two places —
the wordmark and status stamps — because a stamp is literally a stamp.

Line length is capped at 68 characters for body prose. Serif body text is not used; the serif is a
display face only, so no line-height compensation is needed.

## 5. Shape, texture and motion

- Radii stay at 2–4px. A bounty plate and a stamp have their own geometry; nothing else does.
- The only textures are two CSS gradients: a faint vertical grain on the timber ground and a very
  faint warm wash on the parchment sheet. No images, no `background-image` files, no filters.
- Paper depth is a 1px border plus a single low shadow. No card lifts on hover; hover changes border
  colour and underlines the action.
- No entrance animation anywhere. The `prefers-reduced-motion` collapse already in the token layer
  stays; components never write a literal duration.
- Every decorative element carries `aria-hidden`.

### 5.1 The one memorable element: the bounty plate

Spent deliberately, once per Wanted, and nowhere else.

```
        ┌────────┐
        │   RM   │   dark night-ink block, 2px brass edge,
        │   85   │   top corners notched, brass tabular numerals,
        └────────┘   overlapping the card's top rule so it reads as fixed on
```

A dark plate rather than the brass coin in the reference images. Three reasons: brass-on-paper fails
contrast, a circular gold token reads as game currency, and a notched dark plate is the only dark
block on a pale card — so the eye finds the money first without any colour shouting.

## 6. Card anatomy

The generic outcome here is a rounded box with a title, a grey subtitle, three pill tags and a
button. Each part below is a deliberate departure.

```
┌─┬──────────────────────────────────────────┐
│▌│ CSC510  Database Systems       ┌──────┐  │  brass index tab, full height
│▌│                                │  RM  │  │
│▌│ Final Exam Notes + Summary     │  85  │  │  serif title, up to two lines
│▌│ (Chapters 1–12)                └──────┘  │
│▌│                                          │
│▌│ Campus     UiTM Shah Alam                │  <dl> index grid, sans, muted
│▌│ Resource   Lecture notes                 │  labels, never middle dots
│▌│ Session    Semester 2, 2024/2025         │
│▌├──────────────────────────────────────────┤
│▌│ ⟦ OPEN ⟧   6 backers    2 days left      │  stamp + tabular counts
│▌│ View this Wanted                         │  one clear action
└─┴──────────────────────────────────────────┘
```

- **Brass index tab**: a 4px left edge, the card's one piece of brass on light. It reads as an
  archive card's colour tab and removes the need for a coloured header band.
- **`<dl>` index grid** instead of a middle-dot meta string. Denser, machine-readable, and it
  announces as label/value pairs rather than an undifferentiated run-on line.
- **Stamp** carries its word, a 1px box, and per-status border treatment (solid / dashed / doubled).
- **One action.** The card is not one giant link; the title and the action are the two link targets
  and both go to the same Wanted, which keeps the accessible name honest.

## 7. Shell

```
1440
┌──────────────────────────────────────────────────────────────────────────┐
│ VAULTIX │ Wanted Board  Hunt  Archive ┃ Notifications  Profile [Post a…] │ timber
└──────────────────────────────────────────────────────────────────────────┘
  serif     sans, brass rule under active  ┃ brass divider separates utilities
```

Hierarchy is structural, not decorative: marketplace destinations sit next to the wordmark, a brass
vertical rule separates them from account utilities, and the one filled leather button is the only
primary action in the bar.

360px keeps the same information in three bands rather than hiding it behind a menu — the shell
stays a Server Component with no JavaScript, as its existing comment intends:

```
360
┌────────────────────────────────┐
│ VAULTIX        [Post a Wanted] │
├────────────────────────────────┤
│ Wanted Board   Hunt   Archive  │  min-height 44px
├────────────────────────────────┤
│ Notifications  Profile         │  smaller, muted
└────────────────────────────────┘
```

Preserved exactly: the skip link first in tab order, `nav[aria-label="Primary"]`, `main#main-content`
with `tabIndex={-1}`, visible focus, `aria-current="page"`.

The footer stops being a provisional disclaimer. It becomes a quiet timber strip carrying the
wordmark and one honest sentence about Sheriff review. The "Provisional interface" line moves to a
development-only marker that does not render in a production build.

## 8. Route 1 — `/`

Above the fold at 1440×900, without scrolling: the proposition, the search, both actions, the
verification explanation, and four live Wanteds.

```
┌──────────────────────────────────────────────────────────────────┐
│ header                                                           │
├───────────────────────────────┬──────────────────────────────────┤
│ Find the notes worth          │ Open on the board now            │
│ hunting for.                  │ ┌────────────┐ ┌──────────────┐  │
│                               │ │CSC510 [RM85]│ │ACC406  [RM45]│  │
│ Post what your class needs,   │ └────────────┘ └──────────────┘  │
│ build a shared bounty, and…   │ ┌────────────┐ ┌──────────────┐  │
│                               │ │MAT183 [RM38]│ │EEE312  [RM35]│  │
│ [ Search course, campus … ]   │ └────────────┘ └──────────────┘  │
│ [Browse the Board] [Post a…]  │                                  │
│                               │                                  │
│ Email verified → browse       │                                  │
│ Institution verified → fund   │                                  │
├───────────────────────────────┴──────────────────────────────────┤
│ How it works   1 Post or back   2 Hunters submit   3 Sheriff …   │
└──────────────────────────────────────────────────────────────────┘
```

The hero is the board itself, not a headline over empty space. Numbered markers appear only in the
"How it works" strip, which genuinely is a three-step sequence.

No fabricated user counts, success rates, payout totals, growth figures, institution counts or
testimonials. The only numbers on the page are fixture bounties and backer counts, and the fixture
marker says so.

## 9. Route 2 — `/board`

```
1440
┌──────────────────────────────────────────────────────────────────┐
│ Wanted Board                    [ search …………………………………………… ]     │
│ 6 open requests                          Sort [ Newest    ▾ ]    │
├────────────┬─────────────────────────────────────────────────────┤
│ Campus  ▾  │ ┌───────────┐ ┌───────────┐ ┌───────────┐           │
│ Course  ▾  │ │ card      │ │ card      │ │ card      │           │
│ Resource▾  │ └───────────┘ └───────────┘ └───────────┘           │
│ Session ▾  │ ┌───────────┐ ┌───────────┐ ┌───────────┐           │
│ Status  ▾  │ │ card      │ │ card      │ │ card      │           │
│            │ └───────────┘ └───────────┘ └───────────┘           │
│ Clear all  │                                                     │
└────────────┴─────────────────────────────────────────────────────┘
  15rem rail   3 columns ≥1200px · 2 ≥820px · 1 below
```

Density is deliberate: cards are ~230px tall, the rail is narrow, and results take the width. An
oversized card grid is the ecommerce default and is explicitly rejected.

Every control is a `GET` form field, so state lives in the URL (`?q=`, `?campus=`, `?course=`,
`?resource=`, `?session=`, `?status=`, `?sort=`). The Board stays server-rendered, linkable and
back-button-correct, per the structural exploration in
`docs/superpowers/specs/2026-09-14-vaultix-identity-screen-design.md` §10.3.

At 360px the search stays visible, the rail becomes a `<details>` disclosure whose summary reports
the selected-filter count in words, and the grid is one column.

## 10. Route 3 — `/wanted/[id]`

```
1200
┌─────────────────────────────────────────┬────────────────────────┐
│ ⟦ OPEN ⟧  Posted 3 days ago             │ ┌────────────────────┐ │
│ Final Exam Notes + Summary              │ │ Total bounty       │ │
│ (Chapters 1–12)                         │ │        RM 85       │ │
│                                         │ │ 6 backers          │ │
│ Looking for comprehensive notes…        │ └────────────────────┘ │
│                                         │ 2 days 15 hours left   │
│ Course     CSC510 Database Systems      │                        │
│ Campus     UiTM Shah Alam               │ [ Back this Wanted ]   │
│ Faculty    FSKM                         │ [ Submit a Claim ]     │
│ Session    Semester 2, 2024/2025        │ RM1–RM50 per backer    │
│ Resource   Lecture notes                │                        │
│ Language   English                      │ Platform fee …         │
│                                         │ ── Verification ──     │
│ Tags: Final exam · Summary notes        │ Email verified …       │
│                                         │ Institution verified … │
│ Policy notice …                         │ Sheriff review …       │
│ Activity ──●──●──●──                    │                        │
│ Similar Wanteds  [3 cards]              │                        │
└─────────────────────────────────────────┴────────────────────────┘
```

The case file reads left, the ledger acts right. Below 1000px the ledger moves above the case file,
so the bounty and both actions stay reachable without scrolling past the description.

Never rendered: file previews, object keys, bucket names, evidence, download links, payment
confirmations, approval outcomes, entitlements.

## 11. Route 4 — `/claims`

Two views, addressed by `?view=hunts` and `?view=claims`, rendered as links with `aria-current` — not
an ARIA tablist. They are navigation, the state is linkable, and no JavaScript is required.

**Open hunts** prioritises match, bounty, closing time, current competition and the eligibility
requirement, with one "View hunt" action.

**My claims** is a status ledger. The eight states get distinct words, distinct stamps and a distinct
"what happens next" sentence:

| State | Stamp | Next step sentence |
| --- | --- | --- |
| Draft | dashed | Complete and submit your claim. |
| Screening | solid, info | We are checking your file. Nothing is visible to a Sheriff yet. |
| Needs information | solid, warning | A Sheriff asked for more detail before reviewing. |
| Under Sheriff review | solid, info | A Sheriff is reviewing your claim. |
| Not selected | doubled, muted | Your claim was valid. Another claim was chosen for this bounty. |
| Approved | solid, success | Approved. The payout is prepared by the Owner. |
| Rejected | solid, error | This claim did not meet the content policy. |
| Quarantined | doubled, error | Held for content safety review. |

`Not selected` and `Rejected` must never converge. One is "you did nothing wrong, someone else won",
the other is "this breached policy". They differ in label, stamp treatment and sentence, and neither
uses the other's colour.

## 12. Review against generated-interface defaults

Each item is a specific default the plan was checked against and what replaced it.

| Default | Present? | Resolution |
| --- | --- | --- |
| Warm cream page + serif display + terracotta accent | palette is mandated by the brief | Inverted: the ground is dark timber and paper is the inset sheet. The page does not read as a cream landing page. |
| Identical rounded SaaS cards, one radius, one grey shadow | no | Asymmetric card anatomy; radii 2–4px; a single warm low shadow; no hover lift. |
| Broadsheet / hairline-rule newspaper template | no | Grid layout with a filter rail, not columns of prose. |
| Cowboy game interface, saloon poster, quest HUD | no | No guns, horses, characters, torn edges, bullet holes or sepia. Frontier reads only as the notice-board metaphor. |
| Ecommerce grid with oversized product cards | no | Dense catalogue cards, ~230px, three across. |
| Crowdfunding template (progress bars, stretch goals, backer walls) | no | A bounty is a pooled total, not a funding target. No progress bar, since there is no target to fill. |
| ALL-CAPS eyebrow above every heading | no | Letter-spacing only on the wordmark and status stamps. |
| Meta strings joined with middle dots | no | `<dl>` index grid. |
| `→` appended to button and link text | no | Plain verb phrases: "Browse the Board", "View this Wanted". |
| Monospace for small data labels | no | Tabular numerals on the humanist sans. |
| Numbered 01 / 02 / 03 markers | only where real | Used once, on the genuinely sequential "How it works". |
| Gradient washes, glassmorphism, neon | no | Two flat CSS gradients at very low amplitude, as texture. |
| Fade-and-slide entrance on each section | no | No entrance motion at all. |
| Emoji icons | no | Text labels; the only glyph is the existing `★` institution emblem, which already carries a text note. |

One thing was cut after this review: the reference images put a decorative illustrated landscape
strip behind the homepage hero and vertical carved slogans down the page edges. Both were dropped.
They are image assets that cannot be produced code-natively at quality, they carry no information,
and the vertical slogans would be either unreadable or noise for a screen reader. The brass plate is
the accessory that stays.

## 13. Fixture boundary

Phase 3 backend operations do not exist. Everything on these four routes is frontend-owned fixture
data behind one replaceable seam.

```
src/features/marketplace/
  types.ts        view models (no database rows, no storage keys)
  money.ts        integer sen → "RM 85.00"
  time.ts         relative age and closing time, against an injected `now`
  filters.ts      URLSearchParams ⇄ normalised filter state
  fixtures.ts     the deterministic dataset, clearly fictional
  wanted-source.ts the seam: listWanted / readWanted / listHunts / listClaims
```

Rules this boundary keeps: money is integer sen and is formatted only at the presentation edge; IDs
and timestamps are literal constants; no `Math.random()`; no `Date.now()` inside a component; no
Supabase import; no personal data; no file, path or bucket ever appears.

Relative time is computed against an explicit `FIXTURE_NOW` constant rather than the wall clock.
Deterministic output is required by the brief, and it also removes the server/client hydration
mismatch that a live clock would cause. Recorded as a fixture limitation: real closing times must
come from the backend and be rendered from a server-supplied instant.

## 14. Backend contracts this frontend now needs

Recorded for Codex, not implemented here.

1. `listWanted(query)` — filtered, sorted, cursor-paginated Board read returning gross bounty in
   integer sen, backer count, lifecycle state, closing instant and taxonomy labels. No file data.
2. `readWanted(id)` — Wanted detail including the published fee-rate snapshot, policy version,
   activity events and duplicate/similar suggestions.
3. `listHuntOpportunities()` — open Wanteds scoped to what the viewer may claim, with the
   eligibility reason when they may not.
4. `listMyClaims()` — the viewer's claims with the eight lifecycle states, never exposing another
   claimant's existence beyond a competition count.
5. A viewer capability view model carrying the authoritative `canBrowseMetadata`, `canTransact`,
   `canSubmitClaim` decisions, so the frontend stops guessing which action routes to sign-in.
6. A `next` parameter on `/sign-in` so a protected action can return the user to where they were.
   Until it exists, protected actions link to `/sign-in` plainly and say what they will unlock.

## 15. Provisional gate for these four routes

1. Success, empty, no-results, loading, unavailable and fixture states exist for each route.
2. Each route works from 360px upward by keyboard, with no horizontal overflow.
3. No component hardcodes a visual value; every colour, radius and duration is a token.
4. Money, verification, policy and moderation information reads as plain English beside any branded
   noun.
5. Component and Playwright tests cover the critical interaction and accessibility behaviour.
