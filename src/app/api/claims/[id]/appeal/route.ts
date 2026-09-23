import {
  authRequiredResponse,
  executeJsonOperation,
  identityUnavailableResponse,
} from "@/modules/identity/delivery/auth-http";
import { createClaimModerationService } from "@/modules/moderation/services/create-claim-moderation-service";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const service = await createClaimModerationService();
    if (!service) return authRequiredResponse();
    const { id } = await context.params;

    return executeJsonOperation(
      request,
      async (body: unknown) => {
        const input = typeof body === "object" && body !== null ? body : {};
        return service.submitAppeal({
          ...input,
          claimId: id,
        } as Parameters<typeof service.submitAppeal>[0]);
      },
      201,
    );
  } catch {
    return identityUnavailableResponse();
  }
}
