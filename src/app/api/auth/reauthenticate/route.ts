import { authRequiredResponse, executeJsonOperation } from "@/modules/identity/delivery/auth-http";
import { createAuthService } from "@/modules/identity/services/create-auth-service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** "Confirm it's you": re-enter the password to refresh the 15-minute step-up window. */
export async function POST(request: Request): Promise<Response> {
  const client = await createSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user?.email) return authRequiredResponse();
  const email = user.email;
  const service = await createAuthService();
  return executeJsonOperation(
    request,
    (input) => service.reauthenticate(email, input),
    200,
    undefined,
    "identity.reauthenticate",
  );
}
