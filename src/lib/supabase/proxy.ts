import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { resolveSupabasePublicConfig } from "@/lib/config/public-env";

import type { Database } from "./database.types";

export async function refreshSupabaseSession(request: NextRequest): Promise<NextResponse> {
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
