import { executeMarketplaceJson } from "@/modules/wanted/delivery/marketplace-http";
import { decideCommunityPayout } from "@/modules/wanted/loaders/wanted-operations";

export const dynamic = "force-dynamic";

/** A Sheriff approves or rejects a bounty release on a missing item or discussion. */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return executeMarketplaceJson(request, (input) => decideCommunityPayout(id, input));
}
