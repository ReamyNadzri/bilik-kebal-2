import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // VAULTIX build and report output:
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    ".worktrees/**",
  ]),
  {
    // Untrusted input is narrowed through validation, never through `any`.
    // See context/code-standards.md.
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
]);

export default eslintConfig;
