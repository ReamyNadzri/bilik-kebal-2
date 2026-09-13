# VAULTIX Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a reproducible, tested Next.js foundation that safely supports separate Codex backend and Claude Code frontend work.

**Architecture:** Codex establishes the pinned toolchain, strict configuration, server/client environment boundary, shared operation-result contract, and CI commands. Claude then builds the provisional semantic token system and accessible application shell without introducing business behavior.

**Tech Stack:** Node.js 24 LTS, pnpm 11, Next.js 16.3.3 Active LTS, React 19.3, TypeScript strict, Tailwind CSS 4.3, Zod 4.6, Vitest 5, React Testing Library, Playwright

**Spec:** `docs/superpowers/specs/2026-09-13-vaultix-mvp-design.md`

## Global Constraints

- Use Node.js 24 LTS for CI and production compatibility; Node.js 26 may be used locally only if all checks also pass under Node.js 24.
- Pin the package manager through the `packageManager` field and commit the generated `pnpm-lock.yaml`.
- Use Next.js 16.3.3 or a later 16.3 security patch; do not downgrade below the August 2026 security release.
- Server-only configuration must never be imported by Client Components.
- Provider modes default to disabled and the application must build without provider secrets.
- The UI is provisional but complete in structure and state coverage; all temporary visual values use semantic CSS variables.
- Generated scaffolding/configuration is verified through commands; all authored production behavior follows test-first development.

---

### Task 1: Reproducible project and quality baseline

**Owner:** Codex

**Files:**
- Create: `.gitignore`
- Create: `.node-version`
- Create: `package.json`
- Create: `pnpm-lock.yaml`
- Create: `next.config.ts`
- Create: `tsconfig.json`
- Create: `eslint.config.mjs`
- Create: `postcss.config.mjs`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `playwright.config.ts`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/globals.css`
- Create: `src/app/page.test.tsx`

**Interfaces:**
- Consumes: the project boundaries and stack defined by the MVP design.
- Produces: scripts `dev`, `build`, `lint`, `typecheck`, `test`, `test:watch`, and `test:e2e`; the `@/*` alias; a renderable root page Claude can replace.

- [ ] **Step 1: Create the scaffold and pin the runtime**

Generate a Next.js 16.3.3 App Router TypeScript scaffold using pnpm in a temporary directory, then apply only the generated runtime/configuration files to the repository. Set:

```json
{
  "engines": { "node": ">=24 <27" },
  "packageManager": "pnpm@11.3.0"
}
```

Add Vitest, jsdom, React Testing Library, jest-dom, and Playwright as development dependencies. Add these scripts:

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint .",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:e2e": "playwright test"
}
```

- [ ] **Step 2: Write the root-page test before authoring the root page**

```tsx
import { render, screen } from "@testing-library/react";
import HomePage from "./page";

test("identifies the VAULTIX application", () => {
  render(<HomePage />);
  expect(screen.getByRole("heading", { name: "VAULTIX" })).toBeInTheDocument();
});
```

- [ ] **Step 3: Run the focused test and verify RED**

Run: `pnpm test src/app/page.test.tsx`

Expected: FAIL because `src/app/page.tsx` does not yet export the VAULTIX page.

- [ ] **Step 4: Add the minimal root page and test setup**

```tsx
export default function HomePage() {
  return (
    <main>
      <h1>VAULTIX</h1>
      <p>Academic resource bounties for verified communities.</p>
    </main>
  );
}
```

Configure Vitest for `jsdom`, the `@/*` alias, globals, and `vitest.setup.ts`; import `@testing-library/jest-dom/vitest` in the setup file.

- [ ] **Step 5: Verify the baseline**

Run:

```text
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Expected: every command exits 0 with no application warning or test failure.

- [ ] **Step 6: Commit**

```text
git add .gitignore .node-version package.json pnpm-lock.yaml next.config.ts tsconfig.json eslint.config.mjs postcss.config.mjs vitest.config.ts vitest.setup.ts playwright.config.ts src/app
git commit -m "build: establish VAULTIX application baseline"
```

### Task 2: Typed operation result contract

**Owner:** Codex

**Files:**
- Create: `src/contracts/operation-result.ts`
- Create: `src/contracts/operation-result.test.ts`
- Create: `src/contracts/index.ts`

**Interfaces:**
- Consumes: no runtime dependency.
- Produces: `OperationResult<TData, TCode>`, `success(data)`, and `failure(code, message, fieldErrors?)` for every backend/UI operation.

- [ ] **Step 1: Write failing contract tests**

```ts
import { failure, success } from "./operation-result";

test("creates a successful operation result", () => {
  expect(success({ id: "public_123" })).toEqual({
    ok: true,
    data: { id: "public_123" },
  });
});

test("creates a safe failure with field errors", () => {
  expect(failure("INVALID_INPUT", "Check the form.", { title: ["Required"] })).toEqual({
    ok: false,
    code: "INVALID_INPUT",
    message: "Check the form.",
    fieldErrors: { title: ["Required"] },
  });
});
```

- [ ] **Step 2: Verify RED**

Run: `pnpm test src/contracts/operation-result.test.ts`

Expected: FAIL because the contract module does not exist.

- [ ] **Step 3: Implement the minimal contract**

```ts
export type OperationResult<TData, TCode extends string> =
  | { ok: true; data: TData }
  | {
      ok: false;
      code: TCode;
      message: string;
      fieldErrors?: Record<string, string[]>;
    };

export function success<TData>(data: TData): OperationResult<TData, never> {
  return { ok: true, data };
}

export function failure<TCode extends string>(
  code: TCode,
  message: string,
  fieldErrors?: Record<string, string[]>,
): OperationResult<never, TCode> {
  return fieldErrors
    ? { ok: false, code, message, fieldErrors }
    : { ok: false, code, message };
}
```

- [ ] **Step 4: Verify GREEN and public exports**

Run: `pnpm test src/contracts/operation-result.test.ts && pnpm typecheck`

Expected: PASS and both helpers are exported through `src/contracts/index.ts`.

- [ ] **Step 5: Commit**

```text
git add src/contracts
git commit -m "feat: define shared operation result contract"
```

### Task 3: Safe server environment boundary

**Owner:** Codex

**Files:**
- Create: `.env.example`
- Create: `src/lib/config/server-env.ts`
- Create: `src/lib/config/server-env.test.ts`
- Create: `src/lib/config/public-env.ts`
- Create: `src/lib/config/public-env.test.ts`

**Interfaces:**
- Consumes: Zod 4.
- Produces: `parseServerEnv(input)` with default-disabled provider flags and `parsePublicEnv(input)` containing browser-safe values only.

- [ ] **Step 1: Write failing server-environment tests**

```ts
import { parseServerEnv } from "./server-env";

test("defaults risky providers to disabled", () => {
  const env = parseServerEnv({ NODE_ENV: "test" });
  expect(env.PAYMENT_MODE).toBe("disabled");
  expect(env.PUBLIC_UPLOADS_ENABLED).toBe(false);
});

test("requires sandbox credentials only when sandbox payments are enabled", () => {
  expect(() =>
    parseServerEnv({ NODE_ENV: "test", PAYMENT_MODE: "sandbox" }),
  ).toThrow(/TOYYIBPAY_SANDBOX_SECRET/);
});
```

- [ ] **Step 2: Verify RED**

Run: `pnpm test src/lib/config/server-env.test.ts`

Expected: FAIL because the parser does not exist.

- [ ] **Step 3: Implement strict schemas**

Use Zod discriminated configuration so `disabled` requires no provider secret, `sandbox` requires only sandbox credentials, and `live_limited` requires separate live credentials plus an allowlist configuration. Parse boolean strings explicitly; never use JavaScript truthiness for environment flags.

The public schema may expose only:

```ts
{
  NEXT_PUBLIC_APP_URL: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
}
```

- [ ] **Step 4: Add boundary and redaction tests**

Assert that the public parser removes unknown keys and that serialising its result cannot contain `SECRET`, `SERVICE_ROLE`, or `TOYYIBPAY`.

- [ ] **Step 5: Verify GREEN**

Run: `pnpm test src/lib/config && pnpm typecheck && pnpm build`

Expected: PASS; a disabled-provider production build does not require secrets.

- [ ] **Step 6: Commit**

```text
git add .env.example src/lib/config package.json pnpm-lock.yaml
git commit -m "feat: validate safe runtime configuration"
```

### Task 4: Complete provisional app shell

**Owner:** Claude Code

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/page.tsx`
- Create: `src/components/app-shell.tsx`
- Create: `src/components/app-shell.test.tsx`
- Create: `src/components/ui-status.tsx`
- Create: `src/components/ui-status.test.tsx`
- Create: `src/features/presentation/navigation.ts`

**Interfaces:**
- Consumes: the `@/*` alias and semantic token requirements in `context/ui-context.md`.
- Produces: responsive top-level navigation, skip link, main-content landmark, provisional token layer, and reusable loading/empty/error/restricted status presentation.

- [ ] **Step 1: Write failing shell tests**

```tsx
import { render, screen } from "@testing-library/react";
import { AppShell } from "./app-shell";

test("provides keyboard-first navigation landmarks", () => {
  render(<AppShell><h1>Board</h1></AppShell>);
  expect(screen.getByRole("link", { name: "Skip to content" })).toHaveAttribute("href", "#main-content");
  expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
  expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
});
```

- [ ] **Step 2: Verify RED**

Run: `pnpm test src/components/app-shell.test.tsx`

Expected: FAIL because `AppShell` does not exist.

- [ ] **Step 3: Implement semantic tokens and shell**

Define every required variable from `context/ui-context.md`, plus spacing, radius, shadow, typography, and motion tokens. Use restrained neutral provisional values. Implement links for Wanted Board, Hunt/Claims, Archive, Notifications, and Profile. Every icon has accompanying text or an accessible label.

- [ ] **Step 4: Implement shared status presentation test-first**

Use a discriminated `kind` of `loading | empty | error | restricted | expired | offline`. Error and restricted variants use `role="alert"`; loading uses `aria-live="polite"`. The component accepts a heading, message, and optional action without embedding business rules.

- [ ] **Step 5: Verify responsive and accessibility baseline**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`

Manually verify at 360 px and 1280 px that the skip link, focus ring, navigation, heading hierarchy, and status messages remain usable.

- [ ] **Step 6: Commit**

```text
git add src/app src/components src/features/presentation
git commit -m "feat: add provisional accessible application shell"
```

### Task 5: Continuous integration and contributor commands

**Owner:** Codex

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `README.md`
- Modify: `CLAUDE.md` only if it remains untracked and its current author approves inclusion
- Modify: `context/progress-tracker.md`

**Interfaces:**
- Consumes: scripts created in Task 1.
- Produces: one documented local/CI verification sequence using Node.js 24 and pnpm 11.

- [ ] **Step 1: Add CI workflow**

Configure checkout, Node.js 24 with pnpm cache, Corepack/pnpm 11, frozen install, lint, typecheck, tests, and build. Do not add deployment, secrets, live provider calls, or public-upload activation.

- [ ] **Step 2: Document exact commands**

Update README with:

```text
pnpm install --frozen-lockfile
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Record the completed Foundation units and remaining Claude/Codex work in the progress tracker.

- [ ] **Step 3: Run the full gate**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`

Expected: all commands exit 0. Inspect the production bundle output for accidental server-secret imports.

- [ ] **Step 4: Commit**

```text
git add .github/workflows/ci.yml README.md context/progress-tracker.md
git commit -m "ci: verify the VAULTIX foundation"
```

## Phase 1 Completion Gate

- [ ] Clean install succeeds from the committed lockfile.
- [ ] Lint, typecheck, unit tests, and production build pass under Node.js 24 LTS.
- [ ] Risky provider modes and public uploads default to disabled.
- [ ] Browser-safe configuration contains no server secret.
- [ ] Shared operation results compile for backend and frontend consumers.
- [ ] The provisional shell is usable at 360 px and desktop width with keyboard-visible focus.
- [ ] Context and contributor instructions reflect the runnable repository.
