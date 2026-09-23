import {
  authRequiredResponse,
  identityUnavailableResponse,
} from "@/modules/identity/delivery/auth-http";
import { createClaimModerationService } from "@/modules/moderation/services/create-claim-moderation-service";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const service = await createClaimModerationService();
    if (!service) return authRequiredResponse();

    const [reports, appeals] = await Promise.all([
      service.listReports({ status: "pending" }),
      service.listAppeals({ status: "pending" }),
    ]);

    return Response.json({
      ok: true,
      data: {
        reports,
        appeals,
      },
    });
  } catch {
    return identityUnavailableResponse();
  }
}
