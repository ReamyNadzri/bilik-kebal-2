import { NextResponse } from "next/server";
import {
  authRequiredResponse,
  identityUnavailableResponse,
} from "@/modules/identity/delivery/auth-http";
import { createPayoutService } from "@/modules/payouts/services/create-payout-service";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const session = await createPayoutService();
    if (!session) return authRequiredResponse();

    const { id } = await context.params;
    const result = await session.service.expireBounty(session.userId, id);

    if (!result.ok) {
      const statusMap: Record<string, number> = {
        FORBIDDEN: 403,
        INVALID_STATE: 400,
        NOT_FOUND: 404,
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
