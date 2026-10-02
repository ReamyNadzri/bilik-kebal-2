import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

const DIR = join(process.cwd(), "supabase", "migrations");
/** The Clerk bridge rewrote every auth.uid() once; nothing after it may bring one back. */
const BRIDGE = "202610160001_clerk_identity_bridge.sql";

function code(sql: string): string {
  return sql
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
}

function liveOffenders(): string[] {
  const files = readdirSync(DIR)
    .filter((name) => name > BRIDGE && name.endsWith(".sql"))
    .sort();
  const live = new Map<string, { file: string; usesUid: boolean }>();
  for (const file of files) {
    const sql = code(readFileSync(join(DIR, file), "utf8"));
    const pattern =
      /create\s+(?:or\s+replace\s+)?function\s+([\w.]+)\s*\(([\s\S]*?)\$\$([\s\S]*?)\$\$/gi;
    for (const match of sql.matchAll(pattern)) {
      live.set(match[1]!.toLowerCase(), {
        file,
        usesUid: match[3]!.includes("auth.uid()"),
      });
    }
  }
  return [...live].filter(([, v]) => v.usesUid).map(([name, v]) => `${name} (${v.file})`);
}

test("no function defined after the Clerk bridge identifies the caller with auth.uid()", () => {
  expect(liveOffenders()).toEqual([]);
});
