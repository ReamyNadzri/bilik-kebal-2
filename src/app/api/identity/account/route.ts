import { success } from "@/contracts/operation-result";
import {
  authRequiredResponse,
  identityUnavailableResponse,
  operationResponse,
} from "@/modules/identity/delivery/auth-http";
import { loadAccountViewModel } from "@/modules/identity/loaders/identity-read";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const account = await loadAccountViewModel();
    return account ? operationResponse(success(account)) : authRequiredResponse();
  } catch {
    return identityUnavailableResponse();
  }
}
