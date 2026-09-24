import { marketplaceResponse } from "@/modules/wanted/delivery/marketplace-http";
import { listCampusRegions } from "@/modules/wanted/loaders/wanted-operations";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return marketplaceResponse(await listCampusRegions());
}
