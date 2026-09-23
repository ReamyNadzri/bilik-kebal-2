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
    const {
      data: { user },
      error,
    } = await client.auth.getUser();
    const cookieStore = await cookies();
    const grant = cookieStore.get(recoveryCookieName)?.value;
    const secret = getIdentityPendingCookieSecret(process.env);

    if (error || !user || !grant || !verifyPasswordRecoveryGrant(grant, user.id, secret)) {
      return operationResponse(
        failure(
          "RECOVERY_LINK_INVALID",
          "This recovery link is invalid or expired. Request a new one.",
        ),
        200,
        "identity.reset_password",
      );
    }

    const service = new AuthService(new SupabaseAuthGateway(client.auth), getApplicationUrl());
    return executeJsonOperation(
      request,
      (input) => service.updatePassword(input),
      200,
      async (result) => {
        if (result.ok) cookieStore.delete(recoveryCookieName);
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
