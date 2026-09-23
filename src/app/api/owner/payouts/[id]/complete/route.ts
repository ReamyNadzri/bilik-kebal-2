import { NextResponse } from "next/server";
import {
  authRequiredResponse,
  identityUnavailableResponse,
} from "@/modules/identity/delivery/auth-http";
import { recordPayoutCompletionSchema } from "@/contracts/payouts";
import { createPayoutService } from "@/modules/payouts/services/create-payout-service";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const session = await createPayoutService();
    if (!session) return authRequiredResponse();

    const { id } = await context.params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { ok: false, code: "VALIDATION_ERROR", error: "Request body must be valid JSON." },
        { status: 400 },
      );
    }

    const parsed = recordPayoutCompletionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          code: "VALIDATION_ERROR",
          error: parsed.error.issues[0]?.message ?? "Invalid payout completion data.",
        },
        { status: 400 },
      );
    }

    const result = await session.service.completePayout(session.userId, id, parsed.data);
    if (!result.ok) {
      const statusMap: Record<string, number> = {
        FORBIDDEN: 403,
        NOT_FOUND: 404,
        LEDGER_ERROR: 500,
        INVALID_STATE: 400,
      };
      return NextResponse.json(
        { ok: false, code: result.code, error: result.message, message: result.message },
        { status: statusMap[result.code] ?? 400 },
      );
    }

    return NextResponse.json({ ok: true, data: result.data }, { status: 200 });
  } catch {
    return identityUnavailableResponse();
  }
}
