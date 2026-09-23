import { NextResponse } from "next/server";
import {
  authRequiredResponse,
  identityUnavailableResponse,
} from "@/modules/identity/delivery/auth-http";
import { createEntitlementService } from "@/modules/entitlements/services/create-entitlement-service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const session = await createEntitlementService();
    if (!session) return authRequiredResponse();

    const { id } = await context.params;
    const result = await session.service.getClaimDownloadUrl(session.userId, id);

    if (!result.ok) {
      const statusMap: Record<string, number> = {
        NOT_FOUND: 404,
        AUTH_REQUIRED: 401,
        NOT_ENTITLED: 403,
        RESTRICTED: 403,
        REVOKED: 403,
        STORAGE_ERROR: 500,
      };

      const status = statusMap[result.code] ?? 400;
      return NextResponse.json(
        { ok: false, code: result.code, error: result.message, message: result.message },
        { status },
      );
    }

    return NextResponse.json({ ok: true, data: result.data }, { status: 200 });
  } catch {
    return identityUnavailableResponse();
  }
}
