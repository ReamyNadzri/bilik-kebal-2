import { reportJson } from "@/modules/wanted/delivery/report-http";
import { reportWanted } from "@/modules/wanted/loaders/wanted-report-operations";

export const dynamic = "force-dynamic";

/** Reports a Wanted (`id` is its public id) to the Sheriffs and the Owner. */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return reportJson(request, (input) => reportWanted(id, input));
}
