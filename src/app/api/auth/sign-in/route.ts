import { executeJsonOperation } from "@/modules/identity/delivery/auth-http";
import { createAuthService } from "@/modules/identity/services/create-auth-service";
import { rememberPendingVerificationEmail } from "@/modules/identity/delivery/pending-verification";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const service = await createAuthService();
  return executeJsonOperation(
    request,
    (input) => service.signIn(input),
    200,
    async (result, input) => {
      if (
        !result.ok &&
        result.code === "EMAIL_NOT_VERIFIED" &&
        typeof input === "object" &&
        input !== null &&
        "email" in input &&
        typeof input.email === "string"
      ) {
        await rememberPendingVerificationEmail(input.email);
      }
    },
    "identity.sign_in",
  );
}
