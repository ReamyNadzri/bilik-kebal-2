interface HttpOperationSuccess {
  ok: true;
  data: unknown;
}

interface HttpOperationFailure {
  ok: false;
  code: string;
  message: string;
  fieldErrors?: Record<string, string[]>;
}

type HttpOperationResult = HttpOperationSuccess | HttpOperationFailure;

const statusByCode: Readonly<Record<string, number>> = {
  APPEAL_ALREADY_EXISTS: 409,
  APPEAL_EXPIRED: 410,
  AUTH_RATE_LIMITED: 429,
  AUTH_REQUIRED: 401,
  AUTH_UNAVAILABLE: 503,
  CANNOT_REVIEW_OWN_APPEAL: 403,
  CLAIM_NOT_FOUND: 404,
  CLAIM_NOT_REJECTED: 400,
  EMAIL_NOT_VERIFIED: 403,
  EVIDENCE_UPLOAD_UNAVAILABLE: 503,
  EVIDENCE_EXPIRED: 410,
  INVALID_CREDENTIALS: 401,
  MARKETPLACE_UNAVAILABLE: 503,
  MODERATION_UNAVAILABLE: 503,
  NOT_AUTHORIZED: 403,
  RECENT_AUTH_REQUIRED: 401,
  REQUEST_NOT_FOUND: 404,
  SEGREGATION_VIOLATION: 403,
  UNSUPPORTED_EVIDENCE_TYPE: 415,
  VALIDATION_ERROR: 400,
  VERIFICATION_CONFLICT: 409,
};

export async function executeJsonOperation(
  request: Request,
  operation: (input: unknown) => Promise<HttpOperationResult>,
  successStatus = 200,
  onResult?: (result: HttpOperationResult, input: unknown) => Promise<void>,
): Promise<Response> {
  let input: unknown;

  try {
    input = await request.json();
  } catch {
    return Response.json(
      {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "Request body must be valid JSON.",
      },
      { status: 400 },
    );
  }

  const result = await operation(input);
  await onResult?.(result, input);
  return operationResponse(result, successStatus);
}

export function operationResponse(result: HttpOperationResult, successStatus = 200): Response {
  const status = result.ok ? successStatus : (statusByCode[result.code] ?? 400);
  return Response.json(result, {
    headers: { "Cache-Control": "private, no-store" },
    status,
  });
}

export function authRequiredResponse(): Response {
  return Response.json(
    { ok: false, code: "AUTH_REQUIRED", message: "Sign in to continue." },
    { headers: { "Cache-Control": "private, no-store" }, status: 401 },
  );
}

export function identityUnavailableResponse(): Response {
  return Response.json(
    {
      ok: false,
      code: "AUTH_UNAVAILABLE",
      message: "Identity services are temporarily unavailable. Try again.",
    },
    { headers: { "Cache-Control": "private, no-store" }, status: 503 },
  );
}

export function withTrustedFields(input: unknown, trustedFields: Record<string, unknown>): unknown {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return input;
  }

  return { ...input, ...trustedFields };
}

export function safeNextPath(candidate: string | null, fallback: string): string {
  if (!candidate?.startsWith("/") || candidate.startsWith("//")) {
    return fallback;
  }

  try {
    const base = new URL("https://vaultix.invalid");
    const resolved = new URL(candidate, base);
    return resolved.origin === base.origin
      ? `${resolved.pathname}${resolved.search}${resolved.hash}`
      : fallback;
  } catch {
    return fallback;
  }
}
