# UI Context

## Ownership and Status

The detailed visual system is owned by a separate designer and has not yet been delivered. Engineering must not invent final colours, typefaces, pixel assets, iconography, radii, or decorative treatments. This file records the approved product direction and the interface constraints that the design handoff must satisfy. Frontend implementation may begin with structural, accessible primitives only after the visual handoff is incorporated here.

## Theme Direction

- Product identity: `VAULTIX` only. Do not display AFES branding inside the product UI.
- Direction: an original Western frontier bounty-board atmosphere expressed through restrained pixel-art details.
- Do not copy Red Dead Redemption logos, artwork, characters, typography, UI assets, or other protected trade dress.
- The themed layer must never obscure payment, policy, security, accessibility, status, or error information.
- Formal actions retain familiar language: Pay, Refund, Withdraw, Report, Appeal, Download, and Delete.
- Interface language is English in the first release.

## Required Design Tokens

The external design handoff must define semantic CSS custom properties for at least:

| Role | Required variable |
| --- | --- |
| Page background | `--bg-base` |
| Elevated surface | `--bg-surface` |
| Subtle surface | `--bg-subtle` |
| Primary text | `--text-primary` |
| Muted text | `--text-muted` |
| Primary action | `--accent-primary` |
| Secondary accent | `--accent-secondary` |
| Default border | `--border-default` |
| Focus ring | `--focus-ring` |
| Error | `--state-error` |
| Warning | `--state-warning` |
| Success | `--state-success` |
| Information | `--state-info` |

No component may hardcode a final colour value. Temporary development tokens must be clearly isolated and replaced before visual acceptance.

## Typography

- The designer must supply a readable UI family and an optional display/pixel family.
- Body text, forms, tables, money, policies, and error messages use the readable UI family.
- Display/pixel typography, if used, is limited to headings, badges, or decorative labels and must remain legible.
- Numeric money values use tabular figures.
- Minimum body size, line height, and contrast must support WCAG 2.1 AA.

## Shape, Motion, and Pixel Art

- Radius, border, shadow, and spacing scales must be expressed as tokens.
- Pixel-art assets must be original, lightweight, responsive, and optional under reduced-motion or data-saving conditions.
- Animation is decorative only. Respect `prefers-reduced-motion`.
- No essential state may rely on colour, animation, themed terminology, or an icon alone.

## Component Foundation

- Tailwind CSS implements semantic tokens and responsive layout.
- Use accessible headless primitives for dialogs, menus, tabs, tooltips, selects, and focus management.
- Product wrappers live outside generated primitive files.
- Icons must have a consistent family and accessible labels where meaning is not accompanied by text.

## Required Layout Patterns

- Student experience: responsive top-level navigation with Wanted Board, Hunt/Claims, Archive, Notifications, and Profile.
- Wanted Board: searchable filter area plus cards showing course, institution/campus, resource type, academic period, gross bounty, Backer count, age, and safe status.
- Wanted detail: lifecycle/status, metadata, bounty breakdown, contribution action, claim action, and policy notice without unverified file preview.
- Create Wanted: multi-step or sectioned form with duplicate suggestions before payment.
- Submit Claim: metadata, file upload, rights declaration, takedown/payout disclosure, and access-basis selection.
- Sheriff Console: desktop-efficient queues and detail panels, while urgent triage remains functional from 360 px width.
- Owner finance views: plain financial language, explicit confirmation, reconciliation state, and immutable history.
- Destructive or money-moving actions: confirmation dialog plus consequence summary; recent authentication where required.

## Status Language

- Use the branded nouns Wanted, Commissioner, Backer, Hunter, Claim, Bounty, Sheriff, and Archive.
- Explain each branded role during onboarding and use plain language beside high-stakes actions.
- `Not Selected` is distinct from `Rejected`.
- `Institution Verified` is distinct from `Email Verified`.
- Payout and refund states must say whether user action, Owner action, or provider confirmation is pending.

## Accessibility and Responsive Requirements

- Meet WCAG 2.1 AA for primary student and Sheriff flows.
- All functions must be operable with keyboard only.
- Focus is visible and restored correctly after dialogs or navigation.
- Form errors are linked to fields and summarised at the top of long forms.
- Tables have usable narrow-screen alternatives rather than horizontal clipping of essential actions.
- Primary flows work from 360 px width upward.
- Safe document previews provide a text alternative or clear unsupported-preview message.
- Verification stars, status badges, charts, and risk flags include text equivalents.

## Visual Handoff Gate

Before visual implementation is considered complete, the designated designer must provide and approve:

1. Colour tokens for light/dark behaviour, if more than one mode exists.
2. Font files/licences and typography scale.
3. Radius, spacing, shadow, border, and motion scales.
4. Original logo, pixel-art assets, favicon, icons, and usage rules.
5. Desktop and mobile designs for authentication, Wanted Board, detail, create, claim, payment, Sheriff review, payout/refund, and error states.
6. Empty, loading, success, failure, restricted, expired, and offline states.
