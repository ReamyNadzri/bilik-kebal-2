import { executeMarketplaceJson } from "@/modules/wanted/delivery/marketplace-http";
import { publishFreeWanted } from "@/modules/wanted/loaders/wanted-operations";

export const dynamic = "force-dynamic";

/** Opens an academic draft with no bounty. Nothing is charged. */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return executeMarketplaceJson(request, (input) => publishFreeWanted(id, input), 201);
}
