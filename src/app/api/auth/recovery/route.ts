import { executeJsonOperation } from "@/modules/identity/delivery/auth-http";
import { createAuthService } from "@/modules/identity/services/create-auth-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const service = await createAuthService();
  return executeJsonOperation(request, (input) => service.recoverPassword(input), 202);
}
