import { reportJson } from "@/modules/wanted/delivery/report-http";
import { ownerRemoveWanted } from "@/modules/wanted/loaders/wanted-report-operations";

export const dynamic = "force-dynamic";

/** The Owner removes a Wanted (`id` is its public id); the poster forfeits, Backers are refunded. */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return reportJson(request, (input) => ownerRemoveWanted(id, input));
}
