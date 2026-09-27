import { listPublicHunters } from "@/modules/profiles/loaders/hunters-operations";

export const dynamic = "force-dynamic";

const STATUS: Record<string, number> = {
  AUTH_REQUIRED: 401,
  EMAIL_NOT_VERIFIED: 403,
  VALIDATION_ERROR: 422,
  PROFILE_UNAVAILABLE: 503,
};

/** One page of the Hunters wall, for paging without reloading the Board. */
export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const result = await listPublicHunters({
    page: Number(params.get("page")),
    pageSize: Number(params.get("per")),
  });
  return Response.json(result, {
    headers: { "Cache-Control": "private, no-store" },
    status: result.ok ? 200 : (STATUS[result.code] ?? 400),
  });
}
