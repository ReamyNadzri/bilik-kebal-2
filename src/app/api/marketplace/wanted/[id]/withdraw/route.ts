import { marketplaceResponse } from "@/modules/wanted/delivery/marketplace-http";
import { withdrawOwnWanted } from "@/modules/wanted/loaders/wanted-operations";

export const dynamic = "force-dynamic";

/**
 * The poster withdraws their Wanted within an hour of publishing it, before
 * any claim or reply from someone else. Every contribution is queued for a
 * manual refund by the Owner.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return marketplaceResponse(await withdrawOwnWanted(id));
}
