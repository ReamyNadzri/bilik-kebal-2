import { consoleResponse } from "@/modules/console/console-http";
import { searchConsoleMembers } from "@/modules/console/loaders/console-operations";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const search = new URL(request.url).searchParams.get("q");
  return consoleResponse(await searchConsoleMembers(search));
}
