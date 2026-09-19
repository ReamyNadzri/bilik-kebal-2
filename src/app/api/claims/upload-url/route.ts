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
        const wantedId =
          typeof input === "object" &&
          input !== null &&
          "wantedId" in input &&
          typeof input.wantedId === "string"
            ? input.wantedId
            : "";
        const trust = await context.getActor(wantedId);
        return context.service.create(trust.actor, trust.wantedStatus, input);
      },
      201,
    );
  } catch {
    return identityUnavailableResponse();
  }
}
