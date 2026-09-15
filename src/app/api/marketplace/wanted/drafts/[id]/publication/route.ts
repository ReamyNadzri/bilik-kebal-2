import { executeMarketplaceJson } from "@/modules/wanted/delivery/marketplace-http";
import { prepareWantedPublication } from "@/modules/wanted/loaders/wanted-operations";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return executeMarketplaceJson(request, (input) => prepareWantedPublication(id, input));
}
