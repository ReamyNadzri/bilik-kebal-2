import { marketplaceResponse } from "@/modules/wanted/delivery/marketplace-http";
import { listPublicWanted } from "@/modules/wanted/loaders/wanted-operations";
import { parseWantedListQuery } from "@/modules/wanted/domain/wanted-read-query";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const parsed = parseWantedListQuery(url.searchParams);
  if (!parsed.ok) return marketplaceResponse(parsed);
  return marketplaceResponse(await listPublicWanted(parsed.data));
}
