import { reportJson } from "@/modules/wanted/delivery/report-http";
import { dismissWantedReport } from "@/modules/wanted/loaders/wanted-report-operations";

export const dynamic = "force-dynamic";

/** A Sheriff or the Owner dismisses a report that needs no action. */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return reportJson(request, () => dismissWantedReport(id));
}
