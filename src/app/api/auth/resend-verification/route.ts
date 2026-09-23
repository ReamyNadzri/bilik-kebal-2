import { failure } from "@/contracts/operation-result";
import { operationResponse } from "@/modules/identity/delivery/auth-http";
import { readPendingVerificationEmail } from "@/modules/identity/delivery/pending-verification";
import { createAuthService } from "@/modules/identity/services/create-auth-service";

export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  try {
    const email = await readPendingVerificationEmail();
    if (!email) {
      return operationResponse(
        failure("AUTH_UNAVAILABLE", "Verification email could not be resent. Sign up again."),
        200,
        "identity.resend_verification",
      );
    }
    return operationResponse(
      await (await createAuthService()).resendVerification(email),
      202,
      "identity.resend_verification",
    );
  } catch {
    return operationResponse(
      failure("AUTH_UNAVAILABLE", "Verification email could not be resent. Try again."),
      200,
      "identity.resend_verification",
    );
  }
}
