const STATUS: Record<string, number> = {
  AUTH_REQUIRED: 401,
  RECENT_AUTH_REQUIRED: 401,
  NOT_AUTHORIZED: 403,
  MEMBER_NOT_FOUND: 404,
  ALREADY_RESTRICTED: 409,
  VALIDATION_ERROR: 422,
  CONSOLE_UNAVAILABLE: 503,
};

export function consoleResponse(result: { ok: boolean; code?: string }): Response {
  return Response.json(result, {
    headers: { "Cache-Control": "private, no-store" },
    status: result.ok ? 200 : (STATUS[result.code ?? ""] ?? 400),
  });
}

export async function consoleJson(
  request: Request,
  operation: (input: unknown) => Promise<{ ok: boolean; code?: string }>,
): Promise<Response> {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return consoleResponse({ ok: false, code: "VALIDATION_ERROR" });
  }
  return consoleResponse(await operation(input));
}
