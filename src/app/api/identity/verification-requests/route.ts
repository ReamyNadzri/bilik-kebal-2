import {
  authRequiredResponse,
  executeJsonOperation,
  identityUnavailableResponse,
  withTrustedFields,
} from "@/modules/identity/delivery/auth-http";
import { createVerificationContext } from "@/modules/identity/services/create-verification-service";
import { failure, success } from "@/contracts/operation-result";
import { operationResponse } from "@/modules/identity/delivery/auth-http";
import { loadVerificationReviewQueue } from "@/modules/identity/loaders/identity-read";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const state = new URL(request.url).searchParams.get("state");
    if (state !== "pending") {
      return operationResponse(
        failure("VALIDATION_ERROR", "Only the pending review queue is available."),
      );
    }
    const result = await loadVerificationReviewQueue();
    if (result.status === "auth_required") return authRequiredResponse();
    if (result.status === "not_authorized") {
      return operationResponse(failure("NOT_AUTHORIZED", "You cannot access this queue."));
    }
    if (result.status !== "ready") return identityUnavailableResponse();
    return operationResponse(success(result.items));
  } catch {
    return identityUnavailableResponse();
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const context = await createVerificationContext();
    if (!context) {
      return authRequiredResponse();
    }

    return executeJsonOperation(
      request,
      (input) =>
        context.service.requestManualVerification(
          withTrustedFields(input, {
            emailVerified: context.emailVerified,
            userId: context.userId,
          }),
        ),
      201,
    );
  } catch {
    return identityUnavailableResponse();
  }
}
