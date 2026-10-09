import type { OperationResult } from "@/contracts/operation-result";

const STATUS: Record<string, number> = {
  AUTH_REQUIRED: 401,
  EMAIL_NOT_VERIFIED: 403,
  ROUND_NOT_FOUND: 404,
  ACHIEVEMENT_NOT_FOUND: 404,
  REWARD_NOT_ELIGIBLE: 403,
  ACHIEVEMENT_INCOMPLETE: 409,
  OPPONENT_UNAVAILABLE: 409,
  ROUND_EXPIRED: 410,
  VALIDATION_ERROR: 422,
  TOO_SOON: 429,
  DUEL_UNAVAILABLE: 503,
};

const headers = { "Cache-Control": "private, no-store" };

export function duelResponse(result: OperationResult<unknown, string>): Response {
  return Response.json(result, {
    headers,
    status: result.ok ? 200 : (STATUS[result.code] ?? 400),
  });
}

/** Reads a JSON body (an empty one counts as `{}`) and answers with the operation's envelope. */
export async function duelJson(
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
  return duelResponse(await operation(body));
}
