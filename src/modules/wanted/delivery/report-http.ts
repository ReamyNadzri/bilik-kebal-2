import type { OperationResult } from "@/contracts/operation-result";

const STATUS: Record<string, number> = {
  AUTH_REQUIRED: 401,
  NOT_ELIGIBLE: 403,
  NOT_AUTHORIZED: 403,
  NOT_FOUND: 404,
  PAID_OUT: 409,
  RATE_LIMITED: 429,
  VALIDATION_ERROR: 422,
  REMOVAL_UNAVAILABLE: 503,
  REPORTS_UNAVAILABLE: 503,
};

/** Reads a JSON body (an empty one counts as `{}`) and answers with the operation's envelope. */
export async function reportJson(
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
      { status: 422 },
    );
  }
  const result = await operation(body);
  return Response.json(result, {
    headers: { "Cache-Control": "private, no-store" },
    status: result.ok ? 200 : (STATUS[result.code] ?? 400),
  });
}
