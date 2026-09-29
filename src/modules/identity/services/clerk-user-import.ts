/**
 * Supabase Auth → Clerk account import (migration plan slice 5).
 *
 * Pure planning: which exported Supabase accounts become Clerk users, with
 * what body, and which are skipped and why. The runner
 * (scripts/import-users-to-clerk.mjs) does the I/O. No imports, and only
 * type-erasable TypeScript, so Node can run this file directly.
 */

/** One row of scripts/sql/export-supabase-users-for-clerk.sql. */
export interface SupabaseAuthExportRow {
  id: string;
  email: string | null;
  encrypted_password: string | null;
  email_confirmed_at: string | null;
  display_name: string | null;
  created_at: string;
}

/** Clerk Backend API `POST /v1/users` body. */
export interface ClerkCreateUserBody {
  external_id: string;
  email_address: string[];
  first_name?: string;
  password_digest?: string;
  password_hasher?: "bcrypt";
  skip_password_checks?: boolean;
  skip_password_requirement?: boolean;
  created_at: string;
}

export type ImportSkipReason =
  | "already_imported"
  | "email_taken"
  | "no_email"
  | "unverified_email"
  | "invalid_id"
  | "duplicate_email";

export type ImportDecision =
  | { kind: "create"; id: string; body: ClerkCreateUserBody }
  | { kind: "skip"; id: string; reason: ImportSkipReason };

export interface ExistingClerkUsers {
  /** `external_id`s already in the Clerk instance. */
  externalIds: ReadonlySet<string>;
  /** Lower-cased email addresses already in the Clerk instance. */
  emails: ReadonlySet<string>;
}

export interface ImportOptions {
  /**
   * Clerk marks every email created through the Backend API as verified, so
   * an account that never confirmed its address would gain the "email
   * verified" trust state by being imported. Off unless the Owner decides
   * otherwise (docs/superpowers/plans/2026-09-29-clerk-auth-migration.md).
   */
  includeUnverified: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BCRYPT = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

export function isBcryptDigest(value: string | null): value is string {
  return value !== null && BCRYPT.test(value);
}

export function toClerkCreateUserBody(row: SupabaseAuthExportRow): ClerkCreateUserBody {
  const email = (row.email ?? "").trim().toLowerCase();
  const name = row.display_name?.trim();
  const body: ClerkCreateUserBody = {
    external_id: row.id,
    email_address: [email],
    created_at: new Date(row.created_at).toISOString(),
  };
  if (name) body.first_name = name.slice(0, 100);
  if (isBcryptDigest(row.encrypted_password)) {
    // The member keeps their password: Clerk verifies it against the same hash.
    body.password_digest = row.encrypted_password;
    body.password_hasher = "bcrypt";
    body.skip_password_checks = true;
  } else {
    // No usable hash (never set one): they sign in with a reset code or Google.
    body.skip_password_requirement = true;
  }
  return body;
}

export function planImport(
  rows: readonly SupabaseAuthExportRow[],
  existing: ExistingClerkUsers,
  options: ImportOptions,
): ImportDecision[] {
  const seenEmails = new Set<string>();
  return rows.map((row): ImportDecision => {
    const id = row.id;
    if (!UUID.test(id)) return { kind: "skip", id, reason: "invalid_id" };
    if (existing.externalIds.has(id)) return { kind: "skip", id, reason: "already_imported" };

    const email = (row.email ?? "").trim().toLowerCase();
    if (email === "") return { kind: "skip", id, reason: "no_email" };
    // Someone already holds this address in Clerk; linking it would hand them this account.
    if (existing.emails.has(email)) return { kind: "skip", id, reason: "email_taken" };
    if (seenEmails.has(email)) return { kind: "skip", id, reason: "duplicate_email" };
    seenEmails.add(email);

    if (!row.email_confirmed_at && !options.includeUnverified) {
      return { kind: "skip", id, reason: "unverified_email" };
    }
    return { kind: "create", id, body: toClerkCreateUserBody(row) };
  });
}

export function summarise(decisions: readonly ImportDecision[]): Record<string, number> {
  const counts: Record<string, number> = { create: 0 };
  for (const decision of decisions) {
    const key = decision.kind === "create" ? "create" : `skip:${decision.reason}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

/** Shows enough of an address to recognise it in a report, not to harvest it. */
export function maskEmail(email: string | null): string {
  if (!email) return "(none)";
  const [local = "", domain = ""] = email.split("@");
  return `${local.slice(0, 2)}***@${domain}`;
}
