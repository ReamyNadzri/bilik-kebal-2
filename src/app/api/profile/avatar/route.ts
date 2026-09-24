import { setOwnAvatar } from "@/modules/profiles/loaders/profile-operations";

export const dynamic = "force-dynamic";

const STATUS: Record<string, number> = {
  AUTH_REQUIRED: 401,
  EMAIL_NOT_VERIFIED: 403,
  VALIDATION_ERROR: 422,
  AVATAR_NOT_UPLOADED: 409,
  PROFILE_UNAVAILABLE: 503,
};

/**
 * Records an avatar the browser already uploaded to the public `avatars`
 * bucket (under the member's own folder, enforced by storage policy), or
 * clears it with `{ objectKey: null }`.
 */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, code: "VALIDATION_ERROR", message: "Request body must be valid JSON." },
      { status: 422 },
    );
  }
  const result = await setOwnAvatar(body);
  return Response.json(result, {
    headers: { "Cache-Control": "private, no-store" },
    status: result.ok ? 200 : (STATUS[result.code] ?? 400),
  });
}
