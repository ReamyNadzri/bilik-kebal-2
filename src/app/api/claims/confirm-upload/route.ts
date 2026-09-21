import {
  authRequiredResponse,
  executeJsonOperation,
  identityUnavailableResponse,
} from "@/modules/identity/delivery/auth-http";
import { createClaimUploadContext } from "@/modules/claims/services/create-claim-upload-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    const context = await createClaimUploadContext();
    if (!context) return authRequiredResponse();
    return executeJsonOperation(
      request,
      async (input) => {
        const trust = await context.getActor("");
        return context.service.complete(trust.actor, input);
      },
      200,
    );
  } catch {
    return identityUnavailableResponse();
  }
}
