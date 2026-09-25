import { consoleResponse } from "@/modules/console/console-http";
import { restoreConsoleReply } from "@/modules/console/loaders/console-operations";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ replyId: string }> },
): Promise<Response> {
  const { replyId } = await context.params;
  return consoleResponse(await restoreConsoleReply(replyId));
}
