import { consoleResponse } from "@/modules/console/console-http";
import { retireConsoleBadge } from "@/modules/console/loaders/console-operations";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ badgeId: string }> },
): Promise<Response> {
  const { badgeId } = await context.params;
  return consoleResponse(await retireConsoleBadge(badgeId));
}
