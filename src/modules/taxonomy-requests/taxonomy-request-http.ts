const STATUS: Record<string, number> = {
  AUTH_REQUIRED: 401,
  INSTITUTION_VERIFICATION_REQUIRED: 403,
  NOT_AUTHORIZED: 403,
  VALIDATION_ERROR: 422,
  REQUEST_LIMIT_REACHED: 429,
  REQUEST_NOT_FOUND: 404,
  COURSE_CODE_EXISTS: 409,
  TAXONOMY_REQUESTS_UNAVAILABLE: 503,
};

export function taxonomyRequestResponse(result: { ok: boolean; code?: string }): Response {
  return Response.json(result, {
    headers: { "Cache-Control": "private, no-store" },
    status: result.ok ? 200 : (STATUS[result.code ?? ""] ?? 400),
  });
}

export async function readJson(
  request: Request,
): Promise<{ ok: true; body: unknown } | { ok: false }> {
  try {
    return { ok: true, body: await request.json() };
  } catch {
    return { ok: false };
  }
}
