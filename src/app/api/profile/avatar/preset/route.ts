import { setOwnAvatarPreset } from "@/modules/profiles/loaders/profile-operations";

export const dynamic = "force-dynamic";

const STATUS: Record<string, number> = {
  AUTH_REQUIRED: 401,
  EMAIL_NOT_VERIFIED: 403,
  VALIDATION_ERROR: 422,
  PROFILE_UNAVAILABLE: 503,
};

/** Chooses one of the twelve drawn avatars (`{ preset: 0..11 }`) instead of a photo. */
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
  const result = await setOwnAvatarPreset(body);
  return Response.json(result, {
    headers: { "Cache-Control": "private, no-store" },
    status: result.ok ? 200 : (STATUS[result.code] ?? 400),
  });
}
