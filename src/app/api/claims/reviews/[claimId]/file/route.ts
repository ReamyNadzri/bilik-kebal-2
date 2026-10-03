import type { ClaimFileAccessCode } from "@/contracts/claim-reviews";
import {
  authRequiredResponse,
  identityUnavailableResponse,
} from "@/modules/identity/delivery/auth-http";
import { createClaimFileReviewService } from "@/modules/claims/services/create-claim-file-review-service";

export const dynamic = "force-dynamic";

const STATUS: Record<ClaimFileAccessCode, number> = {
  VALIDATION_ERROR: 400,
  AUTH_REQUIRED: 401,
  NOT_AUTHORIZED: 403,
  CLAIM_NOT_FOUND: 404,
  PREVIEW_UNSUPPORTED: 422,
  FILE_UNAVAILABLE: 503,
};

/**
 * A reviewer's short-lived signed URL for a claim's file, as JSON. The file is
 * never read or proxied here, and the URL is never logged or redirected to: the
 * browser opens it on the Storage domain.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ claimId: string }> },
): Promise<Response> {
  try {
    const service = await createClaimFileReviewService();
    if (!service) return authRequiredResponse();
    const { claimId } = await context.params;
    const purpose = new URL(request.url).searchParams.get("purpose") ?? "";
    const result = await service.open(claimId, purpose);
    return Response.json(result, {
      headers: { "Cache-Control": "private, no-store" },
      status: result.ok ? 200 : STATUS[result.code],
    });
  } catch {
    return identityUnavailableResponse();
  }
}
