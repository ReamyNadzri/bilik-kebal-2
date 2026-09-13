import {
  authRequiredResponse,
  executeJsonOperation,
  identityUnavailableResponse,
  withTrustedFields,
} from "@/modules/identity/delivery/auth-http";
import { createVerificationContext } from "@/modules/identity/services/create-verification-service";

export const dynamic = "force-dynamic";

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
