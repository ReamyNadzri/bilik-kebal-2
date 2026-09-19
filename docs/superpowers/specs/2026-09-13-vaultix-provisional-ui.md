# VAULTIX Provisional UI Foundation

**Date:** 2026-09-13
**Owner:** Claude Code
**Status:** Prepared, not implemented — waiting on the Codex Foundation commit
**Implements:** Task 4 of `docs/superpowers/plans/2026-09-13-vaultix-foundation.md`
**Governed by:** `context/ui-context.md`, `context/code-standards.md`, `docs/superpowers/plans/2026-09-13-vaultix-mvp-coordination.md`

## 1. Purpose and Blocking Status

This document fixes the provisional token layer and component contracts for Task 4 so that
implementation is mechanical once the baseline exists. Nothing here is final brand approval:
`context/ui-context.md` permits a complete provisional frontend, with temporary visual values
isolated behind semantic tokens so the external handoff can replace them without touching product
components.

Task 4 is blocked. It modifies `src/app/globals.css`, `src/app/layout.tsx`, and `src/app/page.tsx`
and relies on the `@/*` alias plus the Vitest/jsdom/RTL harness — all produced by Codex Tasks 1–3.
At the time of writing, `codex/backend` is identical to `main` (`aeab5ba`, documentation only) and no
`codex/provisional-ui` branch exists.

**Start condition:** a Foundation commit on `codex/backend` containing `package.json`,
`pnpm-lock.yaml`, `tsconfig.json` with the `@/*` alias, `vitest.config.ts`, `vitest.setup.ts`, and a
renderable `src/app/{layout,page}.tsx` + `globals.css`.

**Ownership note for Codex:** `src/app/globals.css` and `src/app/layout.tsx` are shared-by-review
paths. The foundation plan assigns both to Claude Code for this slice, which satisfies the
coordination rule that a slice brief names the owner before work begins. Codex should not restyle
them in Tasks 1–3 beyond what is needed to make the scaffold render.

## 2. Provisional Token Layer

Warm-neutral, restrained, original. It reads as frontier-adjacent without imitating any protected
trade dress, and it is deliberately plain so that nobody mistakes it for the delivered design.

### 2.1 Colour — the thirteen required roles

Every variable required by `context/ui-context.md` plus two additions noted below.

```css
:root {
  /* Surfaces */
  --bg-base: #FAF8F5;
  --bg-surface: #FFFFFF;
  --bg-subtle: #F1EDE7;

  /* Text */
  --text-primary: #1F1B16;
  --text-muted: #5C544A;
  --text-on-accent: #FFFFFF;      /* addition: legible text on filled accents/states */

  /* Accents */
  --accent-primary: #7A4E1D;
  --accent-secondary: #2F5D50;

  /* Lines and focus */
  --border-default: #C6BBAA;
  --border-strong: #8E8272;       /* addition: control outlines needing WCAG 1.4.11 3:1 */
  --focus-ring: #0F52D9;

  /* States */
  --state-error: #B3261E;
  --state-warning: #8A5300;
  --state-success: #1B5E36;
  --state-info: #14557A;
}
```

`--text-on-accent` and `--border-strong` are additions, not substitutions. Input and control
boundaries need 3:1 under WCAG 1.4.11, which a decorative separator colour cannot carry; keeping them
separate stops `--border-default` from being darkened into ugliness to serve both jobs. Both are
flagged for the designer in §7.

### 2.2 Verified contrast

Computed with the WCAG 2.x relative-luminance formula. All pairs meet their target; re-run this
check whenever a value changes.

| Pair | Ratio | Target |
| --- | --- | --- |
| `--text-primary` on `--bg-base` | 16.15:1 | 4.5 |
| `--text-primary` on `--bg-surface` | 17.12:1 | 4.5 |
| `--text-primary` on `--bg-subtle` | 14.68:1 | 4.5 |
| `--text-muted` on `--bg-base` | 7.02:1 | 4.5 |
| `--text-muted` on `--bg-subtle` | 6.38:1 | 4.5 |
| `--text-on-accent` on `--accent-primary` | 7.15:1 | 4.5 |
| `--text-on-accent` on `--accent-secondary` | 7.49:1 | 4.5 |
| `--accent-primary` text on `--bg-base` | 6.75:1 | 4.5 |
| `--accent-secondary` text on `--bg-base` | 7.07:1 | 4.5 |
| `--focus-ring` on `--bg-base` | 6.13:1 | 3 |
| `--focus-ring` on `--bg-surface` | 6.50:1 | 3 |
| `--text-on-accent` on `--focus-ring` | 6.50:1 | 4.5 |
| `--border-default` on `--bg-base` | 1.79:1 | 1.5 (separator floor) |
| `--border-default` on `--bg-subtle` | 1.62:1 | 1.5 (separator floor) |
| `--border-strong` on `--bg-base` | 3.55:1 | 3 |
| `--border-strong` on `--bg-surface` | 3.76:1 | 3 |
| `--border-strong` on `--bg-subtle` | 3.22:1 | 3 |
| `--state-error` text on `--bg-base` | 6.17:1 | 4.5 |
| `--state-warning` text on `--bg-base` | 5.97:1 | 4.5 |
| `--state-success` text on `--bg-base` | 7.33:1 | 4.5 |
| `--state-info` text on `--bg-base` | 7.59:1 | 4.5 |
| `--text-on-accent` on `--state-error` | 6.54:1 | 4.5 |
| `--text-on-accent` on `--state-success` | 7.78:1 | 4.5 |

The 1.5:1 separator floor is a self-imposed visibility minimum, not a WCAG requirement — decorative
separators have none, but an invisible one is a bug.

### 2.3 Typography, spacing, shape, motion

```css
:root {
  /* Type families — display family deferred to the handoff, aliased for now */
  --font-ui: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
  --font-display: var(--font-ui);
  --font-mono: ui-monospace, SFMono-Regular, "Cascadia Mono", Consolas, monospace;

  /* Type scale */
  --text-xs: 0.75rem;   --text-sm: 0.875rem;  --text-base: 1rem;
  --text-lg: 1.125rem;  --text-xl: 1.375rem;  --text-2xl: 1.75rem;  --text-3xl: 2.25rem;
  --leading-tight: 1.25; --leading-normal: 1.55; --leading-relaxed: 1.7;

  /* Spacing — 4px base */
  --space-1: 0.25rem; --space-2: 0.5rem;  --space-3: 0.75rem; --space-4: 1rem;
  --space-5: 1.5rem;  --space-6: 2rem;    --space-7: 3rem;    --space-8: 4rem;

  /* Shape */
  --radius-sm: 2px; --radius-md: 4px; --radius-lg: 8px; --radius-pill: 999px;
  --border-width-1: 1px; --border-width-2: 2px;

  /* Elevation — warm-neutral, deliberately shallow */
  --shadow-sm: 0 1px 2px rgb(31 27 22 / 0.08);
  --shadow-md: 0 2px 8px rgb(31 27 22 / 0.12);

  /* Focus */
  --focus-ring-width: 2px;
  --focus-ring-offset: 2px;

  /* Motion — decorative only */
  --motion-fast: 120ms;
  --motion-base: 200ms;
  --motion-ease: cubic-bezier(0.2, 0, 0.2, 1);
}

@media (prefers-reduced-motion: reduce) {
  :root { --motion-fast: 1ms; --motion-base: 1ms; }
  *, *::before, *::after {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 1ms !important;
    scroll-behavior: auto !important;
  }
}
```

Base body size is `--text-base` (16px) at `--leading-normal`, which clears the AA legibility floor.

### 2.4 Global rules that belong in `globals.css`

- `:focus-visible { outline: var(--focus-ring-width) solid var(--focus-ring); outline-offset: var(--focus-ring-offset); }`
  — never remove an outline without replacing it with an equally visible one.
- `.numeric { font-variant-numeric: tabular-nums; }` — required for every money value by
  `context/ui-context.md`. Apply at the presentation edge only; formatting stays out of domain code.
- `body { background: var(--bg-base); color: var(--text-primary); font-family: var(--font-ui); }`
- A single `PROVISIONAL` comment banner at the top of the token block stating that every value is
  temporary and replaced wholesale by the handoff.

### 2.5 Deliberate deferrals

- **Dark mode is not defined.** `context/ui-context.md` treats light/dark as conditional on the
  handoff. The architecture supports it at zero component cost — redefine the same variables inside
  one `@media (prefers-color-scheme: dark)` block — so adding it later touches no component.
- **No pixel art, logo, favicon, or display face.** Those are handoff deliverables. `--font-display`
  aliases `--font-ui` so introducing a display family is a one-line change.

## 3. Component Contracts

Exactly the files Task 4 lists — no expansion.

### 3.1 `src/features/presentation/navigation.ts`

Pure presentation data, no business rules, no permissions. Visibility and permissions arrive later in
Codex view models; this module never decides them.

```ts
export type NavItemId = "board" | "claims" | "archive" | "notifications" | "profile";

export interface NavItem {
  readonly id: NavItemId;
  readonly label: string;
  readonly href: string;
}

export const PRIMARY_NAV: readonly NavItem[] = [
  { id: "board",         label: "Wanted Board",  href: "/board" },
  { id: "claims",        label: "Hunt",          href: "/claims" },
  { id: "archive",       label: "Archive",       href: "/archive" },
  { id: "notifications", label: "Notifications", href: "/notifications" },
  { id: "profile",       label: "Profile",       href: "/profile" },
] as const;
```

Labels use the branded nouns that `context/ui-context.md` mandates. Plain-language explanation of
each role belongs in onboarding copy, not in the nav label.

### 3.2 `src/components/app-shell.tsx`

```ts
export interface AppShellProps {
  children: React.ReactNode;
  currentNavId?: NavItemId;
}
export function AppShell(props: AppShellProps): React.JSX.Element;
```

Structure, in order: skip link → `<header>` containing `<nav aria-label="Primary">` → `<main
id="main-content" tabIndex={-1}>` → `<footer>`.

- Skip link is the first focusable element, visually hidden until focused, `href="#main-content"`.
- `main` takes `tabIndex={-1}` so the skip target actually receives focus in every browser.
- The active item carries `aria-current="page"`; it is also distinguished by weight and an underline,
  never by colour alone.
- **Server Component — no `use client`.** The provisional nav wraps and scrolls rather than using a
  disclosure toggle, so the shell needs no JavaScript at 360 px. A client-side disclosure can be
  introduced when the nav outgrows the row; that decision is deferred, not assumed.
- Every icon, if any is added later, carries text or an accessible label.

### 3.3 `src/components/ui-status.tsx`

```ts
export type UiStatusKind =
  | "loading" | "empty" | "error" | "restricted" | "expired" | "offline";

export interface UiStatusProps {
  kind: UiStatusKind;
  heading: string;
  message?: string;
  action?: React.ReactNode;
}
export function UiStatus(props: UiStatusProps): React.JSX.Element;
```

Announcement semantics:

| Kind | Role / live region | Rationale |
| --- | --- | --- |
| `error` | `role="alert"` | Foundation plan, Step 4 |
| `restricted` | `role="alert"` | Foundation plan, Step 4 |
| `loading` | `aria-live="polite"` + `aria-busy="true"` | Foundation plan, Step 4 |
| `empty` | none | Not an interruption |
| `expired` | `role="status"` | Extension: polite, consistent with non-error states |
| `offline` | `role="status"` | Extension: polite, consistent with non-error states |

`expired` and `offline` are not specified in the plan; `role="status"` is the conservative reading and
is flagged here rather than decided silently.

Each kind renders a visible text label in addition to any colour treatment, satisfying the rule that
no essential state relies on colour, animation, themed terminology, or an icon alone. The component
accepts heading, message, and action, and embeds no business rule, no copy, and no lifecycle
knowledge — callers supply the words.

### 3.4 `src/app/{layout,page}.tsx`

`layout.tsx` imports `globals.css`, sets `lang="en"`, and renders `AppShell` around `children`.
`page.tsx` keeps the `VAULTIX` heading that the Codex Task 1 test asserts — **do not break that
test** — and adds a short provisional landing body.

## 4. Test Plan — RED First

Every test below is written and observed failing before the corresponding implementation, per
`context/code-standards.md` and the plan's red-green-refactor requirement.

`src/components/app-shell.test.tsx`

1. The verbatim test from foundation plan Task 4 Step 1: skip link `href="#main-content"`,
   `nav` named `Primary`, `main` with `id="main-content"`.
2. All five `PRIMARY_NAV` items render as links.
3. `currentNavId` sets `aria-current="page"` on exactly that one item.
4. Children render inside the `main` landmark.

`src/components/ui-status.test.tsx`

1. `error` and `restricted` expose `role="alert"`.
2. `loading` exposes `aria-live="polite"` and `aria-busy="true"`.
3. Each of the six kinds renders a visible text label — the colour-independence guard.
4. `heading` and optional `message` render; `action` renders when supplied and is absent otherwise.

## 5. Execution Order Once Unblocked

1. Confirm the Foundation commit on `codex/backend`; read it rather than assuming its shape.
2. `git worktree add .worktrees/claude-ui -b codex/provisional-ui <foundation-commit>`.
3. `pnpm install --frozen-lockfile`, then confirm `pnpm lint typecheck test build` are green before
   changing anything — establish that the baseline itself is sound.
4. Write the failing tests from §4; run them; observe RED.
5. Implement tokens, `navigation.ts`, `AppShell`, `UiStatus`; reach GREEN.
6. `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
7. Manually verify 360 px and 1280 px: skip link, focus ring, nav wrapping, heading order, status
   messages.
8. Commit per the plan: `feat: add provisional accessible application shell`.
9. Update `context/progress-tracker.md` in the same slice.

Node note: this machine runs Node 26.1.0, which the plan permits locally only if the checks also pass
under Node 24 LTS — CI is the authority. Flag any Node-version-dependent failure rather than pinning
around it locally.

## 6. Out of Scope Here

Backend behaviour, database models, payment logic, domain contracts, and anything under Codex-owned
paths. The development-only fixture marker that coordination §5 requires for non-integrated screens
is a Phase 2 concern — Task 4 ships no fixture-backed screen — and will be specified with the first
such screen.

## 7. Questions for the Final Design Handoff

1. Does `--text-on-accent` survive as a token, or does the handoff guarantee every accent is
   light-text-safe? (Provisional answer assumes the token.)
2. Does the system need the `--border-default` / `--border-strong` split, or will one border colour
   carry 3:1 for control outlines?
3. Is there a dark mode? If so, supply the same variable names redefined under one media query.
4. Display/pixel family: which elements may use it, and what is the legibility floor?
5. Elevation: are shadows part of the system, or is the frontier treatment flat with borders only?
