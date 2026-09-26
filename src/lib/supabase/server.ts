import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";

import { parsePublicEnv, resolveSupabasePublicConfig } from "@/lib/config/public-env";

import type { Database } from "./database.types";

export async function createSupabaseServerClient<Schema extends Database = Database>() {
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
 * One cookie-bound Supabase client per server render.
 *
 * React scopes `cache` to a single request: the layout, the page, its guard and
 * every loader they call share this client, and a session it refreshes, for
 * that request only. Nothing is shared between requests or viewers. Outside a
 * render — route handlers — `cache` does not memoise, so each call there still
 * gets a client of its own, exactly as `createSupabaseServerClient` would.
 */
export const getRequestSupabaseClient = cache(() => createSupabaseServerClient());

/**
 * The signed-in user for this server render, checked with Supabase Auth once.
 *
 * `auth.getUser()` is a round trip to Supabase Auth, and a page, its guard and
 * each of its loaders used to ask separately. Next's fetch memoisation usually
 * collapsed those identical requests, but only while they stayed identical;
 * sharing the answer here makes one check per request a guarantee. The trust is
 * unchanged: the Auth server still verifies the session. Explicit caching
 * choice (context/code-standards.md): scoped to one request, never shared.
 */
export const getRequestUser = cache(async () => {
  const client = await getRequestSupabaseClient();
  return client.auth.getUser();
});

export function getApplicationUrl(): string {
  return parsePublicEnv(process.env).NEXT_PUBLIC_APP_URL;
}
