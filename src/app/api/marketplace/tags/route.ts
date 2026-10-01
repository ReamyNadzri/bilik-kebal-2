import { addTag } from "@/modules/taxonomy/loaders/tag-operations";

export const dynamic = "force-dynamic";

const STATUS: Record<string, number> = {
  AUTH_REQUIRED: 401,
  INSTITUTION_VERIFICATION_REQUIRED: 403,
  VALIDATION_ERROR: 422,
  TAG_UNAVAILABLE: 409,
  TAXONOMY_UNAVAILABLE: 503,
};

/** Adds (or finds) a tag by name; open to any institution-verified member. */
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
  const result = await addTag(body);
  return Response.json(result, {
    headers: { "Cache-Control": "private, no-store" },
    status: result.ok ? 200 : (STATUS[result.code] ?? 400),
  });
}
