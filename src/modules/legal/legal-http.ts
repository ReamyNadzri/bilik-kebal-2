import type { OperationResult } from "@/contracts/operation-result";

const STATUS: Record<string, number> = {
  AUTH_REQUIRED: 401,
  NOT_AUTHORIZED: 403,
  NOT_FOUND: 404,
  TERMS_VERSION_STALE: 409,
  VALIDATION_ERROR: 422,
  RATE_LIMITED: 429,
  TERMS_UNAVAILABLE: 503,
  PRIVACY_UNAVAILABLE: 503,
};

const headers = { "Cache-Control": "private, no-store" };

export function legalResponse(result: OperationResult<unknown, string>): Response {
  return Response.json(result, {
    headers,
    status: result.ok ? 200 : (STATUS[result.code] ?? 400),
  });
}

/** Reads a JSON body (an empty one counts as `{}`) and answers with the operation's envelope. */
export async function legalJson(
  request: Request,
  operation: (input: unknown) => Promise<OperationResult<unknown, string>>,
): Promise<Response> {
  let body: unknown = {};
  try {
    const text = await request.text();
    body = text.trim() === "" ? {} : JSON.parse(text);
  } catch {
    return Response.json(
      { ok: false, code: "VALIDATION_ERROR", message: "Request body must be valid JSON." },
      { headers, status: 422 },
    );
  }
  return legalResponse(await operation(body));
}
