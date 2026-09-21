import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { resolveSupabasePublicConfig } from "@/lib/config/public-env";

import type { Database } from "./database.types";

/**
 * Refreshes the Supabase session cookie for every matched request.
 *
 * Server Components cannot write cookies, so this is the only place a rotated
 * refresh token can be persisted. Without it a session dies at the access
 * token's expiry and the viewer is signed out mid-visit.
 *
 * A failure here never fails the request. Identity configuration can be absent
 * and Supabase can be unreachable, and neither is a reason to take down public
 * pages or — worse — the sign-in screen someone needs in order to recover.
 * The request continues without a refreshed session and the loaders report
 * identity as unavailable in the screens that actually need it.
 */
export async function refreshSupabaseSession(request: NextRequest): Promise<NextResponse> {
  try {
    return await refreshOrThrow(request);
  } catch {
    // The reason belongs in server logs, never in a response a browser reads
    // (context/code-standards.md, error boundaries).
    const response = NextResponse.next({ request });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
}

async function refreshOrThrow(request: NextRequest): Promise<NextResponse> {
  const config = resolveSupabasePublicConfig(process.env);
  let response = NextResponse.next({ request });
  const client = createServerClient<Database>(config.url, config.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }

        response = NextResponse.next({ request });
        for (const { name, options, value } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        for (const [name, value] of Object.entries(headers)) {
          response.headers.set(name, value);
        }
      },
    },
  });

  await client.auth.getClaims();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
