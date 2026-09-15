import { executeMarketplaceJson } from "@/modules/wanted/delivery/marketplace-http";
import { createContributionIntent } from "@/modules/money/loaders/money-operations";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return executeMarketplaceJson(request, (input) => createContributionIntent(id, input));
}
