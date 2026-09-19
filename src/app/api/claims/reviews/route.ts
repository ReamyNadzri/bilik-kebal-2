import {
  authRequiredResponse,
  executeJsonOperation,
  identityUnavailableResponse,
  operationResponse,
} from "@/modules/identity/delivery/auth-http";
import { createClaimReviewService } from "@/modules/claims/services/create-claim-review-service";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const service = await createClaimReviewService();
    if (!service) return authRequiredResponse();
    return operationResponse(await service.listQueue());
  } catch {
    return identityUnavailableResponse();
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const service = await createClaimReviewService();
    if (!service) return authRequiredResponse();
    return executeJsonOperation(request, (input) => service.record(input), 201);
  } catch {
    return identityUnavailableResponse();
  }
}
