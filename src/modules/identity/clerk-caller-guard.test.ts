import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const DIR = join(process.cwd(), "supabase", "migrations");
/** The Clerk bridge rewrote every auth.uid() once; nothing after it may bring one back. */
const BRIDGE = "202610160001_clerk_identity_bridge.sql";

function code(sql: string): string {
  return sql
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
}

function squash(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/** The text between the parenthesis at `open` and its matching close. */
function balanced(sql: string, open: number): { inner: string; end: number } | null {
  let depth = 0;
  for (let index = open; index < sql.length; index += 1) {
    if (sql[index] === "(") depth += 1;
    if (sql[index] === ")") {
      depth -= 1;
      if (depth === 0) return { inner: sql.slice(open + 1, index), end: index + 1 };
    }
  }
  return null;
}

type Definition = { key: string; at: number; usesUid: boolean | null };

/**
 * Every function and policy a migration defines or drops, in file order.
 * Functions are keyed by name and argument list, so overloads stay apart;
 * policies by name and table. `usesUid` is null for a drop.
 */
function definitions(source: string): Definition[] {
  const sql = code(source);
  const found: Definition[] = [];

  const fn = /create\s+(?:or\s+replace\s+)?function\s+([\w."]+)\s*\(/gi;
  for (const match of sql.matchAll(fn)) {
    const args = balanced(sql, match.index + match[0].length - 1);
    if (args === null) continue;
    // Any dollar-quote tag: $$, $fn$, $body$ ...
    const body = /\$(\w*)\$([\s\S]*?)\$\1\$/.exec(sql.slice(args.end));
    if (body === null) continue;
    found.push({
      key: `function ${squash(match[1]!)}(${squash(args.inner)})`,
      at: match.index,
      usesUid: body[2]!.includes("auth.uid()"),
    });
  }

  const policy = /create\s+policy\s+("[^"]+"|\w+)\s+on\s+([\w."]+)([\s\S]*?);/gi;
  for (const match of sql.matchAll(policy)) {
    found.push({
      key: `policy ${squash(match[1]!)} on ${squash(match[2]!).replace(/^public\./, "")}`,
      at: match.index,
      usesUid: match[3]!.includes("auth.uid()"),
    });
  }

  const dropPolicy = /drop\s+policy\s+(?:if\s+exists\s+)?("[^"]+"|\w+)\s+on\s+([\w."]+)/gi;
  for (const match of sql.matchAll(dropPolicy)) {
    found.push({
      key: `policy ${squash(match[1]!)} on ${squash(match[2]!).replace(/^public\./, "")}`,
      at: match.index,
      usesUid: null,
    });
  }

  return found.sort((a, b) => a.at - b.at);
}

/** What is still live after the migrations run in order and uses auth.uid(). */
function liveOffenders(migrations: readonly { file: string; sql: string }[]): string[] {
  const live = new Map<string, string>();
  for (const { file, sql } of migrations) {
    for (const { key, usesUid } of definitions(sql)) {
      if (usesUid) live.set(key, file);
      else live.delete(key);
    }
  }
  return [...live].map(([key, file]) => `${key} (${file})`);
}

function postBridgeMigrations() {
  return readdirSync(DIR)
    .filter((name) => name > BRIDGE && name.endsWith(".sql"))
    .sort()
    .map((file) => ({ file, sql: readFileSync(join(DIR, file), "utf8") }));
}

test("nothing defined after the Clerk bridge identifies the caller with auth.uid()", () => {
  const migrations = postBridgeMigrations();
  // Guard against a parser that silently matches nothing.
  const seen = migrations.flatMap(({ sql }) => definitions(sql)).map(({ key }) => key);
  expect(seen.filter((key) => key.startsWith("function ")).length).toBeGreaterThan(10);
  expect(seen.filter((key) => key.startsWith("policy ")).length).toBeGreaterThan(0);
  expect(liveOffenders(migrations)).toEqual([]);
});

describe("the guard's parser", () => {
  const one = (sql: string) => liveOffenders([{ file: "m.sql", sql }]);

  test("reads a body in a named dollar quote", () => {
    expect(
      one(`create function public.f() returns uuid language sql as $fn$ select auth.uid() $fn$;`),
    ).toEqual(["function public.f() (m.sql)"]);
  });

  test("keeps overloads apart, so a clean one does not hide a dirty one", () => {
    expect(
      liveOffenders([
        {
          file: "a.sql",
          sql: `create function public.f(a uuid) returns uuid language sql as $$ select auth.uid() $$;`,
        },
        {
          file: "b.sql",
          sql: `create or replace function public.f(a uuid, b numeric(10, 2)) returns uuid language sql as $$ select private.current_user_id() $$;`,
        },
      ]),
    ).toEqual(["function public.f(a uuid) (a.sql)"]);
  });

  test("a later clean definition of the same function clears it", () => {
    expect(
      liveOffenders([
        { file: "a.sql", sql: `create function f(a uuid) returns uuid as $$ auth.uid() $$;` },
        {
          file: "b.sql",
          sql: `create or replace function f(a uuid) returns uuid as $body$ x $body$;`,
        },
      ]),
    ).toEqual([]);
  });

  test("catches a policy whose using or with check calls auth.uid()", () => {
    expect(
      one(`create policy own_rows on public.things for select to authenticated
           using (owner_id = auth.uid());
           create policy own_insert on things for insert with check (owner_id = auth.uid());`),
    ).toEqual(["policy own_rows on things (m.sql)", "policy own_insert on things (m.sql)"]);
  });

  test("a later drop of the same policy on the same table clears it", () => {
    expect(
      one(`create policy own_rows on public.things using (owner_id = auth.uid());
           drop policy if exists own_rows on public.things;
           create policy own_rows on public.others using (owner_id = auth.uid());`),
    ).toEqual(["policy own_rows on others (m.sql)"]);
  });

  test("ignores auth.uid() in a comment", () => {
    expect(one(`-- auth.uid() was here\ncreate policy p on t using (true);`)).toEqual([]);
  });
});
