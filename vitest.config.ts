import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    exclude: ["tests/e2e/**", "node_modules/**"],
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // Domain and component tests live beside their source in src/.
    // tests/e2e belongs to Playwright; vitest cannot collect those specs.
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
