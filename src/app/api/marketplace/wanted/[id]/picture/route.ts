import { executeMarketplaceJson } from "@/modules/wanted/delivery/marketplace-http";
import { setWantedPicture } from "@/modules/wanted-pictures/loaders/wanted-picture-operations";

export const dynamic = "force-dynamic";

/** The poster sets their Wanted's picture (a drawing or an upload), or clears it. */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return executeMarketplaceJson(request, (input) => setWantedPicture(id, input));
}
