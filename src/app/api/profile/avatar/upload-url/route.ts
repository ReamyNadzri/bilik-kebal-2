import { requestAvatarUpload } from "@/modules/profiles/loaders/profile-operations";

export const dynamic = "force-dynamic";

const STATUS: Record<string, number> = {
  AUTH_REQUIRED: 401,
  EMAIL_NOT_VERIFIED: 403,
  PROFILE_NOT_FOUND: 404,
  PROFILE_UNAVAILABLE: 503,
};

/** A one-time signed upload slot for a cropped WebP avatar in the member's folder. */
export async function POST(): Promise<Response> {
  const result = await requestAvatarUpload();
  return Response.json(result, {
    headers: { "Cache-Control": "private, no-store" },
    status: result.ok ? 201 : (STATUS[result.code] ?? 400),
  });
}
