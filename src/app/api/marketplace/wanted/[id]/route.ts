import {
  executeMarketplaceJson,
  marketplaceResponse,
} from "@/modules/wanted/delivery/marketplace-http";
import { editPublishedWanted, readPublicWanted } from "@/modules/wanted/loaders/wanted-operations";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return marketplaceResponse(await readPublicWanted(id));
}

/** The poster corrects the title and description within an hour of publishing. */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return executeMarketplaceJson(request, (input) => editPublishedWanted(id, input));
}
