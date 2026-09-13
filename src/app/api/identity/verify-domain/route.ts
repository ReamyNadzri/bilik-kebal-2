import {
  authRequiredResponse,
  identityUnavailableResponse,
  operationResponse,
} from "@/modules/identity/delivery/auth-http";
import { createVerificationContext } from "@/modules/identity/services/create-verification-service";

export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  try {
    const context = await createVerificationContext();
    if (!context) {
      return authRequiredResponse();
    }

    return operationResponse(
      await context.service.verifyByEmailDomain({
        email: context.email,
        emailVerified: context.emailVerified,
        userId: context.userId,
      }),
    );
  } catch (error) {
    console.error(
      "Identity domain verification failed",
      error instanceof Error ? `${error.name}: ${error.message}` : "Unknown error",
    );
    return identityUnavailableResponse();
  }
}
