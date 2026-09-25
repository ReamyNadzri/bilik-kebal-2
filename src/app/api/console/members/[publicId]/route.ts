import { consoleJson } from "@/modules/console/console-http";
import { actOnConsoleMember } from "@/modules/console/loaders/console-operations";

export const dynamic = "force-dynamic";

/** One console action on a member: rename, timeout, verification, Sheriff, badge… */
export async function POST(
  request: Request,
  context: { params: Promise<{ publicId: string }> },
): Promise<Response> {
  const { publicId } = await context.params;
  return consoleJson(request, (input) => actOnConsoleMember(publicId, input));
}
