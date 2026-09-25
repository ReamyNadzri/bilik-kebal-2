import {
  executeMarketplaceJson,
  marketplaceResponse,
} from "@/modules/wanted/delivery/marketplace-http";
import { listWantedReplies, postWantedReply } from "@/modules/wanted/loaders/wanted-operations";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return marketplaceResponse(await listWantedReplies(id));
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return executeMarketplaceJson(request, (input) => postWantedReply(id, input), 201);
}
