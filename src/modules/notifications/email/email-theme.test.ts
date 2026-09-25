// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { EMAIL_TOKEN_SOURCES, emailTheme } from "./email-theme";

const css = readFileSync(
  fileURLToPath(new URL("../../../app/globals.css", import.meta.url)),
  "utf8",
);

function firstTokenValue(name: string): string | undefined {
  const match = new RegExp(`${name}:\s*([^;]+);`).exec(css);
  return match?.[1].trim().toLowerCase();
}

test.each(Object.entries(EMAIL_TOKEN_SOURCES))("%s mirrors %s", (key, token) => {
  const value = emailTheme.color[key as keyof typeof emailTheme.color];
  expect(firstTokenValue(token)).toBe(value.toLowerCase());
});
