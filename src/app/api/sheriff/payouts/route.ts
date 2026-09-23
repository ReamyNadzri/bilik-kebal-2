import { NextResponse } from "next/server";
import {
  authRequiredResponse,
  identityUnavailableResponse,
} from "@/modules/identity/delivery/auth-http";
import { createPayoutService } from "@/modules/payouts/services/create-payout-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const session = await createPayoutService();
    if (!session) return authRequiredResponse();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") ?? undefined;

    const result = await session.service.listPayoutTasks(session.userId, status);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, code: result.code, error: result.message, message: result.message },
        { status: result.code === "AUTH_REQUIRED" ? 401 : 403 },
      );
    }

    return NextResponse.json({ ok: true, data: result.data }, { status: 200 });
  } catch {
    return identityUnavailableResponse();
  }
}
