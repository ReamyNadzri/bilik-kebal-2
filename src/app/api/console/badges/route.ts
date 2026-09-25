import { consoleJson } from "@/modules/console/console-http";
import { createConsoleBadge } from "@/modules/console/loaders/console-operations";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return consoleJson(request, createConsoleBadge);
}
