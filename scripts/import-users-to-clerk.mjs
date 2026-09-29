#!/usr/bin/env node
/**
 * Imports Supabase Auth accounts into Clerk and links them to their VAULTIX
 * profiles (docs/superpowers/plans/2026-09-29-clerk-auth-migration.md, slice 5).
 *
 *   node --env-file=.env.local scripts/import-users-to-clerk.mjs --file <export.json>
 *   node --env-file=.env.local scripts/import-users-to-clerk.mjs --file <export.json> --apply
 *
 * Dry run unless --apply. A live Clerk key (sk_live_) also needs --production.
 * --include-unverified imports accounts that never confirmed their email; Clerk
 * would mark those addresses verified, so it is off by default.
 *
 * Re-runnable: accounts already in Clerk (by external_id) are skipped, and the
 * link (`sync_clerk_user`) is idempotent. Emails are masked in the output.
 *
 * Needs CLERK_SECRET_KEY, NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 * Node 24+ (runs the TypeScript planning module directly).
 */
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";

import {
  maskEmail,
  planImport,
  summarise,
} from "../src/modules/identity/services/clerk-user-import.ts";
import { toClerkUserSyncInput } from "../src/modules/identity/services/clerk-user-sync.ts";

const CLERK_API = "https://api.clerk.com/v1";
const PAGE = 500;
const PAUSE_MS = 120;

const { values } = parseArgs({
  options: {
    file: { type: "string" },
    apply: { type: "boolean", default: false },
    production: { type: "boolean", default: false },
    "include-unverified": { type: "boolean", default: false },
  },
});

function fail(message) {
  console.error(`import-users-to-clerk: ${message}`);
  process.exit(1);
}

const secretKey = process.env.CLERK_SECRET_KEY ?? "";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!values.file)
  fail("pass --file <export.json> (scripts/sql/export-supabase-users-for-clerk.sql)");
if (!secretKey.startsWith("sk_")) fail("CLERK_SECRET_KEY is missing");
if (values.apply && (!supabaseUrl || !serviceRoleKey)) {
  fail("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are needed to link profiles");
}
const live = secretKey.startsWith("sk_live_");
if (values.apply && live && !values.production) {
  fail("this is the PRODUCTION Clerk instance (sk_live_); add --production to confirm");
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function clerk(path, init = {}, attempt = 1) {
  const response = await fetch(`${CLERK_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if (response.status === 429 && attempt <= 5) {
    const wait = Number(response.headers.get("retry-after") ?? "2") * 1000;
    await sleep(wait);
    return clerk(path, init, attempt + 1);
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const code = body?.errors?.[0]?.code ?? `http_${response.status}`;
    throw new Error(code);
  }
  return body;
}

async function existingClerkUsers() {
  const externalIds = new Set();
  const emails = new Set();
  const byExternalId = new Map();
  for (let offset = 0; ; offset += PAGE) {
    const page = await clerk(`/users?limit=${PAGE}&offset=${offset}`);
    for (const user of page) {
      if (user.external_id) {
        externalIds.add(user.external_id);
        byExternalId.set(user.external_id, user);
      }
      for (const address of user.email_addresses ?? []) {
        emails.add(String(address.email_address).toLowerCase());
      }
    }
    if (page.length < PAGE) break;
  }
  return { externalIds, emails, byExternalId };
}

async function linkProfile(user) {
  const input = toClerkUserSyncInput(user);
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/sync_clerk_user`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      target_clerk_user_id: input.clerkUserId,
      target_external_id: input.externalId,
      target_email: input.email,
      target_email_verified: input.emailVerified,
      target_display_name: input.displayName,
      target_clerk_updated_at: input.clerkUpdatedAt.toISOString(),
    }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(`link_failed:${body?.code ?? response.status}`);
  }
  const linkedUserId = await response.json();
  if (linkedUserId !== input.externalId) throw new Error("link_mismatch");
}

const rows = JSON.parse(readFileSync(values.file, "utf8"));
if (!Array.isArray(rows)) fail("the export must be a JSON array (the `users` cell)");
const emailById = new Map(rows.map((row) => [row.id, row.email]));

console.log(
  `Clerk instance: ${live ? "PRODUCTION" : "development"} · ${rows.length} exported accounts · ${
    values.apply ? "APPLY" : "dry run"
  }`,
);

const existing = await existingClerkUsers();
const decisions = planImport(rows, existing, {
  includeUnverified: values["include-unverified"],
});
console.table(summarise(decisions));

for (const decision of decisions) {
  if (decision.kind === "skip" && decision.reason !== "already_imported") {
    console.log(
      `skip ${decision.reason.padEnd(17)} ${decision.id} ${maskEmail(emailById.get(decision.id))}`,
    );
  }
}

if (!values.apply) {
  console.log("Dry run: nothing was created. Re-run with --apply to import.");
} else {
  let created = 0;
  let relinked = 0;
  const failures = [];
  for (const decision of decisions) {
    const imported = decision.kind === "skip" && decision.reason === "already_imported";
    if (decision.kind !== "create" && !imported) continue;
    try {
      if (imported) {
        // A previous run may have created the Clerk user and failed to link it.
        await linkProfile(existing.byExternalId.get(decision.id));
        relinked += 1;
        continue;
      }
      const user = await clerk("/users", { method: "POST", body: JSON.stringify(decision.body) });
      await linkProfile(user);
      created += 1;
    } catch (error) {
      failures.push({
        id: decision.id,
        email: maskEmail(emailById.get(decision.id)),
        error: String(error.message),
      });
    }
    await sleep(PAUSE_MS);
  }

  console.log(`Imported and linked ${created} account(s); re-checked the link of ${relinked}.`);
  if (failures.length > 0) {
    console.log(`${failures.length} failed (re-running retries them):`);
    console.table(failures);
    process.exitCode = 1;
  } else {
    console.log("Done. Delete the export file now: it contains password hashes.");
  }
}
