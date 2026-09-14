import {
  authRequiredResponse,
  executeJsonOperation,
  identityUnavailableResponse,
} from "@/modules/identity/delivery/auth-http";
import { createEvidenceReadContext } from "@/modules/identity/loaders/identity-read";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    const context = await createEvidenceReadContext();
    if (!context) return authRequiredResponse();
    return executeJsonOperation(request, (input) =>
      context.service.createEvidenceUrl(input, context.actor),
    );
  } catch {
    return identityUnavailableResponse();
  }
}
