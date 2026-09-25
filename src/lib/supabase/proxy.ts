import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { resolveSupabasePublicConfig } from "@/lib/config/public-env";

import type { Database } from "./database.types";
import { LAST_SEEN_COOKIE, MEMBER_IDLE_MS } from "@/lib/idle-policy";

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

  const { data } = await client.auth.getClaims();
  if (data?.claims) {
    // Idle backstop: a session unused for 7 days ends here even if no tab
    // was open to notice. The 30-minute Sheriff limit runs in the browser.
    const lastSeen = Number(request.cookies.get(LAST_SEEN_COOKIE)?.value);
    const now = Date.now();
    if (Number.isFinite(lastSeen) && lastSeen > 0 && now - lastSeen > MEMBER_IDLE_MS) {
      await client.auth.signOut({ scope: "local" });
      response.cookies.delete(LAST_SEEN_COOKIE);
    } else {
      response.cookies.set(LAST_SEEN_COOKIE, String(now), {
        httpOnly: true,
        sameSite: "lax",
        secure: request.nextUrl.protocol === "https:",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
    }
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
