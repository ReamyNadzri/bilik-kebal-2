import type { NextRequest } from "next/server";

import { refreshSupabaseSession } from "@/lib/supabase/proxy";

/**
 * Lives in `src/` because the app does.
 *
 * Next resolves this convention relative to the directory holding `app/`, so a
 * `proxy.ts` at the repository root is never scanned while `src/app/` exists —
 * it is silently ignored rather than reported, and the Supabase session then
 * never refreshes for anyone.
 */
export async function proxy(request: NextRequest) {
  return refreshSupabaseSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
