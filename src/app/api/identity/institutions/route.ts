import { failure, success } from "@/contracts/operation-result";
import {
  authRequiredResponse,
  identityUnavailableResponse,
  operationResponse,
} from "@/modules/identity/delivery/auth-http";
import { loadSelectableInstitutions } from "@/modules/identity/loaders/identity-read";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const result = await loadSelectableInstitutions();
    if (result.status === "auth_required") {
      return authRequiredResponse();
    }
    if (result.status === "email_not_verified") {
      return operationResponse(
        failure("EMAIL_NOT_VERIFIED", "Verify your email to choose an institution."),
      );
    }
    return operationResponse(success(result.institutions));
  } catch {
    return identityUnavailableResponse();
  }
}
