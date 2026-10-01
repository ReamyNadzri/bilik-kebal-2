import { saveOwnPaymentDetails } from "@/modules/profiles/loaders/profile-operations";

export const dynamic = "force-dynamic";

const STATUS: Record<string, number> = {
  AUTH_REQUIRED: 401,
  VALIDATION_ERROR: 422,
  PAYMENT_DETAILS_UNAVAILABLE: 503,
};

/** Saves the signed-in member's phone and bank account. Never echoes the full account number. */
export async function PUT(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, code: "VALIDATION_ERROR", message: "Request body must be valid JSON." },
      { status: 422 },
    );
  }
  const result = await saveOwnPaymentDetails(body);
  return Response.json(result, {
    headers: { "Cache-Control": "private, no-store" },
    status: result.ok ? 200 : (STATUS[result.code] ?? 400),
  });
}
