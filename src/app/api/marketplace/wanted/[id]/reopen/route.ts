import { marketplaceResponse } from "@/modules/wanted/delivery/marketplace-http";
import { reopenCommunityWanted } from "@/modules/wanted/loaders/wanted-operations";

export const dynamic = "force-dynamic";

/** The poster reopens a missing-item or discussion Wanted within 7 days of closing it. */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return marketplaceResponse(await reopenCommunityWanted(id));
}
