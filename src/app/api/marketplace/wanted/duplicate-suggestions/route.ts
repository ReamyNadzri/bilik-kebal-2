import { executeMarketplaceJson } from "@/modules/wanted/delivery/marketplace-http";
import { suggestWantedDuplicates } from "@/modules/wanted/loaders/wanted-operations";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return executeMarketplaceJson(request, suggestWantedDuplicates);
}
