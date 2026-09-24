import { executeMarketplaceJson } from "@/modules/wanted/delivery/marketplace-http";
import { publishCommunityWanted } from "@/modules/wanted/loaders/wanted-operations";

export const dynamic = "force-dynamic";

/** Opens a missing-item or discussion Wanted. Always free. */
export async function POST(request: Request): Promise<Response> {
  return executeMarketplaceJson(request, publishCommunityWanted, 201);
}
