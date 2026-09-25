import { marketplaceResponse } from "@/modules/wanted/delivery/marketplace-http";
import { resolveCommunityWanted } from "@/modules/wanted/loaders/wanted-operations";

export const dynamic = "force-dynamic";

/** The poster marks a missing-item or discussion Wanted resolved. */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return marketplaceResponse(await resolveCommunityWanted(id));
}
