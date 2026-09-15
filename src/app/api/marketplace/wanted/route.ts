import { marketplaceResponse } from "@/modules/wanted/delivery/marketplace-http";
import { listPublicWanted } from "@/modules/wanted/loaders/wanted-operations";
import type { ListWantedQuery } from "@/contracts/marketplace";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const query: Record<string, string> = {};
  for (const key of [
    "query",
    "campusId",
    "courseId",
    "resourceTypeId",
    "academicSessionId",
    "status",
    "sort",
  ]) {
    const value = url.searchParams.get(key);
    if (value) query[key] = value;
  }
  return marketplaceResponse(await listPublicWanted(query as ListWantedQuery));
}
