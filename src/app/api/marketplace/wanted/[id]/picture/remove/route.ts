import { executeMarketplaceJson } from "@/modules/wanted/delivery/marketplace-http";
import { removeWantedPicture } from "@/modules/wanted-pictures/loaders/wanted-picture-operations";

export const dynamic = "force-dynamic";

/** A Sheriff for this Wanted, or the Owner, removes its picture with a reason code. */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return executeMarketplaceJson(request, (input) => removeWantedPicture(id, input));
}
