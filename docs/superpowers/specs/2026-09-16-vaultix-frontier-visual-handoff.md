# VAULTIX frontier visual handoff

Status: approved by the user on 2026-09-16. Lane: Claude Code (`claude/frontier-visual`).

This implements the user's own design export, `Bounty hunter game website.zip`
(`Vaultix.dc.html` plus its `assets/`), across the provisional frontend. It supersedes the temporary
direction in `2026-09-14-vaultix-marketplace-visual-direction.md` — including that document's
exclusion of characters, horses and frontier figures — and it replaces the provisional token values
in `src/app/globals.css`. It does not replace the six context files: where the design and a context
rule disagree on accessibility, money, privacy or honesty, the context rule wins and the deviation is
listed in §6.

## 1. Decisions taken with the user

1. **Every screen in the design is built.** Screens with a published operation keep reading it.
   Screens or panels without one (Explore Map, avatar and profile editing, Hunter statistics) are
   built fixture-backed behind `FixtureNotice`, and the contract each needs is proposed in §7.
   A number with no source is omitted, never invented.
2. **Wanted posters carry a resource-type emblem, not the Commissioner's avatar.** The Board does not
   expose who asked for a resource. Avatars appear only on the viewer's own profile and in the
   Hunter's Office.
3. **Approach: tokens first, then reskin.** Every colour, border, shadow, font and texture from the
   design becomes a semantic custom property; components consume the properties and keep their
   existing data flow, states and tests.

## 2. Assets

Converted from the export to WebP with `sharp` and committed under `public/brand/`
(about 40 MB of PNG became about 1.5 MB). The PNG sources stay outside the repository.

| Asset | Use |
| --- | --- |
| `logo-tile` | Header and footer mark, favicon and Apple touch icon |
| `dark-timber` | Page ground |
| `hero-frontier` | Homepage hero (decorative, `next/image`) |
| `paper` | Wanted posters, Hunter licence, pinned notes |
| `wood-wall` | Board surfaces behind posters and contracts |
| `wood-rail-top` / `wood-rail-bottom` | Frame edges of a board surface |
| `wood-plank` | Hanging sign behind the "How the hunt works" heading |
| `wood-grain` | Footer edge |
| `map-malaysia` | Explore Map and its homepage teaser |
| `avatar-0` … `avatar-11` | Avatar picker, profile licence, Hunter's Office |

Not shipped: `brand-sheet.png` and `avatars.png` (composite reference sheets whose parts ship
individually), `room-wood.png` (no layout in the design uses it) and everything in `uploads/`, which
is source material and reference. `uploads/bounty sample.png` is third-party copyrighted artwork and
must never enter the product.

## 3. Typography

Self-hosted at build time through `next/font/google`, so no page takes a runtime dependency on a
third-party font host. All three are SIL Open Font License.

| Token | Family | Use |
| --- | --- | --- |
| `--font-ui` | Karla | Body, forms, tables, **money**, policy and error text |
| `--font-display` | Rye | Headings, the WANTED masthead, course codes |
| `--font-pixel` | Silkscreen | Small uppercase labels, stamps, primary button labels |
| `--font-money` | Karla 800, tabular | Every amount of money (§6) |

## 4. Tokens and contrast

Values are the design's, except where a pairing failed WCAG 2.1 AA. Ratios are computed.

| Pairing | Design | Implemented | Ratio |
| --- | --- | --- | --- |
| Small label on panel | `#8a7451` (3.61) | `#6b5a3f` | 5.37 |
| Placeholder on field | `#8b7a5d` (3.77) | `#6f5f44` | 5.59 |
| Field boundary on field (non-text) | `#c0a575` (2.14) | `#8a6a3c` | 4.52 |
| Poster small text on paper stain | `#4a3116` (3.91) | `#3a2412` over a paper wash | ≥ 4.73 |

Unchanged and passing: body `#2a2118` on panel `#f3e6c8` 12.76; muted `#5e4f37` 6.40; white on
Wanted red `#9e2b25` 7.43; link green `#1f4d34` 7.82; money `#7d1f19` on field 9.12; nav
`#c2ab82` on rail 8.35; brass on rail 7.26; every status ink on its stamp ≥ 5.38.

Focus is two bands because no single hue clears 3:1 on both paper and timber: a 2 px ink ring
(12.76 on paper) inside a brass halo (7.26 on the rail, 5.28 on a board).

## 5. Screens

| Route | Source | Design section |
| --- | --- | --- |
| Shell | static | Sticky rail header: logo, primary nav, title search, notifications, profile, Post a Wanted |
| `/` | public Wanted read | Hero, verification panel, How the hunt works, featured posters, map teaser, submission rules |
| `/board` | public Wanted read + taxonomy | Heading panel, filter rail, results on a board surface |
| `/wanted/[id]` | public Wanted detail | Case file panel; poster, ledger and trust panels |
| `/wanted/new` | Phase 3A operations | Intake sheet panels |
| `/claims` | fixture | Hunter's Office header, open contracts, claim ledger with stage track |
| `/map` | fixture | Campus map with pins, selected campus panel, bounty by campus |
| `/profile` | account read + fixture section | Hunter licence, verification summary, fixture profile and avatar editor |
| Identity screens | identity operations | Inherit the paper sheet and form tokens |

## 6. Deviations from the design, and why

- **Money is set in Karla, not Rye.** `context/ui-context.md` requires money in the readable UI
  family. The choice is one token, `--font-money`, if that rule is revised.
- **No "Net reward to Hunter" figure and no funding progress bar.** The rounding rule for a
  percentage fee on integer sen is unspecified, and a Wanted has no funding target. The fee rate
  snapshotted at publication is shown instead (`CLAUDE.md`: never infer financial behaviour).
- **No platform totals** ("128 active", "RM 2,840", "13 campuses") and **no unread count**. There is
  no operation behind them. The hero panel explains what each verification unlocks.
- **"Newly posted" is not a status.** The contract's five states are the only ones rendered.
- **No commissioner avatar or name on posters** (§1.2).
- **Hunter statistics are counts derived from the fixture claim list**, never earnings or win rates.
- **Profile edits and avatar choices are not saved.** The editor says so and saves nothing.
- **Popular search chips are omitted.** Nothing measures popularity, and search matches titles only.

## 7. Contracts proposed for Codex

1. **Campus demand read** — per campus: identifier, name, state, open Wanted count, gross open bounty
   in sen. Pin coordinates remain presentation data.
2. **Profile read and update** — display name, handle, programme, short bio, `avatarId` (0–11) and
   `avatarTone` (`fair` | `light` | `medium` | `tan` | `deep`), with validation and moderation rules
   for free text.
3. **Hunter summary read** — counts of the viewer's claims by lifecycle state.
4. **Notification unread count** for the shell.
5. **Board aggregate read** for any platform total the homepage may later show.

## 8. Acceptance criteria

1. Every visual value in components comes from a custom property; no component file contains a hex
   colour, and the new tokens are defined once in `globals.css`.
2. All pairings in §4 meet WCAG 2.1 AA; focus is visible on paper, rail and board surfaces.
3. Every route in §5 renders from 360 px upward without horizontal page scroll, and is operable by
   keyboard, including map pins, campus list, avatar and tone choices.
4. Connected routes show no fixture figure and keep every existing state (signed-out, unverified,
   unavailable, empty, filtered, not-found). Fixture screens and panels carry `FixtureNotice`.
5. Posters show course code, course name, resource type with emblem, bounty in integer sen, backer
   count, closing time, campus, session and status in words, and nothing about the Commissioner.
6. Decorative imagery is `aria-hidden` or has empty `alt`; meaningful images have text alternatives;
   ambient motion stops under `prefers-reduced-motion`.
7. `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test` and `pnpm build` pass, with new
   component tests for the map, avatar picker, emblem and claim stage track.
8. `context/ui-context.md` and `context/progress-tracker.md` record the handoff.
