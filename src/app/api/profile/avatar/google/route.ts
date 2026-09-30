import { chooseOwnExternalAvatar } from "@/modules/profiles/loaders/profile-operations";
import { syncCurrentClerkUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const STATUS: Record<string, number> = {
  AUTH_REQUIRED: 401,
  EMAIL_NOT_VERIFIED: 403,
  VALIDATION_ERROR: 422,
  PROFILE_UNAVAILABLE: 503,
};

/**
 * Shows the Google photo the member signed in with again, instead of their
 * uploaded photo or drawn avatar. Their Clerk account is copied first, so the
 * photo is the current one even if the webhook has not arrived. Takes no body:
 * the link only ever comes from Clerk.
 */
export async function POST(): Promise<Response> {
  try {
    await syncCurrentClerkUser();
  } catch {
    // The copy already held, if any, is used.
  }
  const result = await chooseOwnExternalAvatar();
  return Response.json(result, {
    headers: { "Cache-Control": "private, no-store" },
    status: result.ok ? 200 : (STATUS[result.code] ?? 400),
  });
}
