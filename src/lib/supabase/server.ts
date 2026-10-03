import { auth, currentUser } from "@clerk/nextjs/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { cache } from "react";

import { parsePublicEnv, resolveSupabasePublicConfig } from "@/lib/config/public-env";
import { SupabaseClerkUserSyncRepository } from "@/modules/identity/repositories/supabase-clerk-user-sync-repository";
import {
  toClerkUserSyncInput,
  type ClerkUserPayload,
} from "@/modules/identity/services/clerk-user-sync";

import { createSupabaseAdminClient } from "./admin";
import type { Database } from "./database";

/**
 * The signed-in member as the server sees them, whichever sign-in produced the
 * session. Field names follow Supabase Auth's `User` so a Supabase user is one
 * of these unchanged; the Supabase Auth branch goes when every account signs in
 * with Clerk (docs/superpowers/plans/2026-09-29-clerk-auth-migration.md).
 */
export interface RequestUser {
  /** The internal user id every table keys on — never the Clerk `user_…` id. */
  readonly id: string;
  readonly email?: string | null;
  readonly email_confirmed_at?: string | null;
  /** When the password (first factor) was last entered, as far as the session knows. */
  readonly last_sign_in_at?: string | null;
  readonly created_at: string;
}

export interface RequestUserResult {
  readonly data: { readonly user: RequestUser | null };
  readonly error: Error | null;
}

interface IdentityRow {
  user_id: string;
  email: string | null;
  email_verified_at: string | null;
  created_at: string;
}

/**
 * The Supabase client for this request, authenticated as the caller.
 *
 * With a Clerk session it sends the Clerk session token, which Supabase trusts
 * as a third-party provider; such a client has no `auth` API. Otherwise it is
 * the cookie-bound Supabase Auth client of an account not yet on Clerk.
 */
export async function createSupabaseServerClient<Schema extends Database = Database>() {
  const session = await auth();
  const config = resolveSupabasePublicConfig(process.env);

  if (session.userId) {
    return createClient<Schema>(config.url, config.key, {
      accessToken: async () => (await session.getToken()) ?? null,
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  return createSupabaseAuthClient<Schema>();
}

/**
 * The cookie-bound Supabase Auth client, for the Supabase Auth flows (confirm,
 * recover, reauthenticate) that remain until the sign-in screens move to Clerk.
 */
export async function createSupabaseAuthClient<Schema extends Database = Database>() {
  const cookieStore = await cookies();
  const config = resolveSupabasePublicConfig(process.env);

  return createServerClient<Schema>(config.url, config.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, options, value } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot write cookies. The root proxy refreshes them.
        }
      },
    },
  });
}

/**
 * One Supabase client per server render.
 *
 * React scopes `cache` to a single request: the layout, the page, its guard and
 * every loader they call share this client, and a session it refreshes, for
 * that request only. Nothing is shared between requests or viewers. Outside a
 * render — route handlers — `cache` does not memoise, so each call there still
 * gets a client of its own, exactly as `createSupabaseServerClient` would.
 */
export const getRequestSupabaseClient = cache(() => createSupabaseServerClient());

/**
 * The caller's whole account as `current_account()` returns it (migration
 * 202610170002): identity, profile, membership, restriction, latest
 * verification request and console access, in one round trip. The account
 * read uses it instead of querying those tables again.
 */
export interface CurrentAccountSnapshot extends IdentityRow {
  public_id: string;
  display_name: string;
  avatar_object_key: string | null;
  avatar_preset: number | null;
  external_avatar_url: string | null;
  membership: {
    institution_id: string;
    verification_state: Database["public"]["Enums"]["institution_verification_state"];
    institution_name: string | null;
  } | null;
  restriction: { id: string; expires_at: string | null } | null;
  latest_request: {
    id: string;
    state: Database["public"]["Enums"]["verification_request_state"];
    created_at: string;
    reviewed_at: string | null;
    decision_reason_code: string | null;
    evidence_delete_after: string;
  } | null;
  has_console_access: boolean;
  /**
   * The latest Terms of Use version the member accepted, null for none.
   * Absent until migration 202610200007 is applied.
   */
  terms_accepted_version?: string | null;
}

/** The snapshot this request read, if any; one per render (React `cache`). */
const snapshotHolder = cache((): { current: CurrentAccountSnapshot | null } => ({ current: null }));

/** The account snapshot read for `userId` in this request, or null to read it afresh. */
export function currentAccountSnapshot(userId: string): CurrentAccountSnapshot | null {
  const snapshot = snapshotHolder().current;
  return snapshot?.user_id === userId ? snapshot : null;
}

async function readOwnIdentity(): Promise<IdentityRow | null> {
  const client = await getRequestSupabaseClient();
  const account = await client.rpc("current_account");
  if (!account.error) {
    const snapshot = (account.data ?? null) as unknown as CurrentAccountSnapshot | null;
    snapshotHolder().current = snapshot;
    return snapshot;
  }
  // Until migration 202610170002 is applied: the identity alone, as before.
  const { data, error } = await client.rpc("current_identity");
  if (error) throw new Error("IDENTITY_UNAVAILABLE");
  return data?.[0] ?? null;
}

/**
 * A Clerk account the webhook has not reached yet is provisioned now, through
 * the same idempotent database function, so the first page after sign-up does
 * not see a stranger. The webhook arriving later changes nothing.
 */
export async function syncCurrentClerkUser(): Promise<void> {
  const user = await currentUser();
  if (!user?.raw) return;
  await new SupabaseClerkUserSyncRepository(createSupabaseAdminClient()).syncUser(
    toClerkUserSyncInput(user.raw as unknown as ClerkUserPayload),
  );
}

function minutesAgo(minutes: unknown): string | null {
  return typeof minutes === "number" && minutes >= 0
    ? new Date(Date.now() - minutes * 60_000).toISOString()
    : null;
}

async function readClerkRequestUser(fva: unknown): Promise<RequestUserResult> {
  let row = await readOwnIdentity();
  if (!row) {
    await syncCurrentClerkUser();
    row = await readOwnIdentity();
  }
  if (!row) return { data: { user: null }, error: null };

  return {
    data: {
      user: {
        id: row.user_id,
        email: row.email,
        email_confirmed_at: row.email_verified_at,
        last_sign_in_at: minutesAgo(Array.isArray(fva) ? fva[0] : null),
        created_at: row.created_at,
      },
    },
    error: null,
  };
}

/**
 * The signed-in member for this server render, checked once.
 *
 * Every page, guard and loader used to ask separately; sharing the answer here
 * makes one check per request a guarantee. The trust is unchanged: Clerk
 * verifies its session, Supabase verifies the token, and Supabase Auth
 * verifies its own session. Explicit caching choice
 * (context/code-standards.md): scoped to one request, never shared.
 */
export const getRequestUser = cache(async (): Promise<RequestUserResult> => {
  const session = await auth();
  if (session.userId) {
    try {
      return await readClerkRequestUser(session.sessionClaims?.fva);
    } catch (error) {
      return {
        data: { user: null },
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  const client = await getRequestSupabaseClient();
  return client.auth.getUser();
});

export function getApplicationUrl(): string {
  return parsePublicEnv(process.env).NEXT_PUBLIC_APP_URL;
}
