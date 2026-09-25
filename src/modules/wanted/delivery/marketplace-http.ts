interface MarketplaceHttpResult {
  ok: boolean;
  code?: string;
  message?: string;
  [key: string]: unknown;
}

const statusByCode: Readonly<Record<string, number>> = {
  AUTH_REQUIRED: 401,
  EMAIL_NOT_VERIFIED: 403,
  INSTITUTION_VERIFICATION_REQUIRED: 403,
  ACCOUNT_RESTRICTED: 403,
  NOT_AUTHORIZED: 403,
  DRAFT_NOT_FOUND: 404,
  WANTED_NOT_FOUND: 404,
  DRAFT_NOT_EDITABLE: 409,
  DUPLICATE_CHECK_REQUIRED: 409,
  DUPLICATE_CHECK_EXPIRED: 409,
  PAYMENT_DISABLED: 503,
  PAYMENT_UNAVAILABLE: 503,
  MONEY_UNAVAILABLE: 503,
  PAYMENT_CALLBACK_INVALID: 400,
  PAYMENT_PROVIDER_REJECTED: 200,
  MARKETPLACE_UNAVAILABLE: 503,
  AMOUNT_OUT_OF_RANGE: 422,
  REGION_CLOSED: 422,
  FREE_LIMIT_REACHED: 409,
  VALIDATION_ERROR: 422,
};

export function marketplaceResponse(result: MarketplaceHttpResult, successStatus = 200): Response {
  return Response.json(result, {
    headers: { "Cache-Control": "private, no-store" },
    status: result.ok ? successStatus : (statusByCode[result.code ?? ""] ?? 400),
  });
}

export async function executeMarketplaceJson(
  request: Request,
  operation: (input: unknown) => Promise<MarketplaceHttpResult>,
  successStatus = 200,
): Promise<Response> {
  try {
    return marketplaceResponse(await operation(await request.json()), successStatus);
  } catch {
    return marketplaceResponse({
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Request body must be valid JSON.",
    } as MarketplaceHttpResult);
  }
}
