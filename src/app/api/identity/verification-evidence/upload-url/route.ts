import {
  authRequiredResponse,
  executeJsonOperation,
  identityUnavailableResponse,
  withTrustedFields,
} from "@/modules/identity/delivery/auth-http";
import { createEvidenceUploadContext } from "@/modules/identity/services/create-evidence-upload-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    const context = await createEvidenceUploadContext();
    if (!context) {
      return authRequiredResponse();
    }

    return executeJsonOperation(
      request,
      (input) =>
        context.service.createUpload(
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
