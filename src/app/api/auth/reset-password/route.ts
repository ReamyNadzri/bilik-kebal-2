import { cookies } from "next/headers";

import { failure } from "@/contracts/operation-result";
import { getIdentityPendingCookieSecret } from "@/lib/config/server-env";
import { createSupabaseServerClient, getApplicationUrl } from "@/lib/supabase/server";
import { executeJsonOperation, operationResponse } from "@/modules/identity/delivery/auth-http";
import { AuthService } from "@/modules/identity/services/auth-service";
import { verifyPasswordRecoveryGrant } from "@/modules/identity/services/password-recovery-grant";
import { SupabaseAuthGateway } from "@/modules/identity/services/supabase-auth-gateway";

export const dynamic = "force-dynamic";

const recoveryCookieName = "vaultix_password_recovery";

export async function POST(request: Request): Promise<Response> {
  try {
    const client = await createSupabaseServerClient();
    const service = new AuthService(new SupabaseAuthGateway(client.auth), getApplicationUrl());
    const cookieStore = await cookies();

    return executeJsonOperation(
      request,
      async (input) => {
        const body =
          typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
        if (typeof body.token === "string" && typeof body.email === "string") {
          return service.resetPasswordWithOtp(input);
        }

        const {
          data: { user },
          error,
        } = await client.auth.getUser();
        const grant = cookieStore.get(recoveryCookieName)?.value;
        const secret = getIdentityPendingCookieSecret(process.env);

        if (error || !user || !grant || !verifyPasswordRecoveryGrant(grant, user.id, secret)) {
          return failure(
            "RECOVERY_LINK_INVALID",
            "This recovery link is invalid or expired. Request a new one.",
          );
        }

        return service.updatePassword(input);
      },
      200,
      async (result) => {
        if (result.ok) {
          cookieStore.delete(recoveryCookieName);
          await client.auth.signOut();
        }
      },
      "identity.reset_password",
    );
  } catch {
    return operationResponse(
      failure("AUTH_UNAVAILABLE", "Password recovery is unavailable right now. Try again shortly."),
      503,
      "identity.reset_password",
    );
  }
}
