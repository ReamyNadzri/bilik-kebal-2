import { createAuthService } from "@/modules/identity/services/create-auth-service";
import { operationResponse } from "@/modules/identity/delivery/auth-http";

export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  const service = await createAuthService();
  const result = await service.signOut();
  return operationResponse(result, 200, "identity.sign_out");
}
