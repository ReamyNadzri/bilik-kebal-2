import { executeMarketplaceJson } from "@/modules/wanted/delivery/marketplace-http";
import { requestCommunityPayout } from "@/modules/wanted/loaders/wanted-operations";

export const dynamic = "force-dynamic";

/** The poster of a paid missing item or discussion names the member who helped. */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return executeMarketplaceJson(request, (input) => requestCommunityPayout(id, input));
}
