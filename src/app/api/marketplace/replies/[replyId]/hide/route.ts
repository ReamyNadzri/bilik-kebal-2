import { executeMarketplaceJson } from "@/modules/wanted/delivery/marketplace-http";
import { setWantedReplyHidden } from "@/modules/wanted/loaders/wanted-operations";

export const dynamic = "force-dynamic";

/** A Sheriff or the Owner hides a chat message with a reason code, or restores it. */
export async function POST(
  request: Request,
  context: { params: Promise<{ replyId: string }> },
): Promise<Response> {
  const { replyId } = await context.params;
  return executeMarketplaceJson(request, (input) => setWantedReplyHidden(replyId, input));
}
