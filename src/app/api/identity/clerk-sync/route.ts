import { auth } from "@clerk/nextjs/server";

import { syncCurrentClerkUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const headers = { "Cache-Control": "private, no-store" };

/**
 * Copies the signed-in member's Clerk account (email, verification) to
 * VAULTIX now instead of when the webhook arrives. It reads the caller's own
 * account from Clerk and takes nothing from the request body, so it can only
 * ever update the caller. Idempotent, like the webhook it anticipates.
 */
export async function POST(): Promise<Response> {
  const { userId } = await auth();
  if (!userId) {
    return Response.json(
      { ok: false, code: "AUTH_REQUIRED", message: "Sign in to continue." },
      { status: 401, headers },
    );
  }
  try {
    await syncCurrentClerkUser();
    return Response.json({ ok: true, data: { synced: true } }, { headers });
  } catch {
    return Response.json(
      { ok: false, code: "AUTH_UNAVAILABLE", message: "Your account could not be updated yet." },
      { status: 503, headers },
    );
  }
}
