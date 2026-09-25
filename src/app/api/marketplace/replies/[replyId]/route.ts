import { executeMarketplaceJson } from "@/modules/wanted/delivery/marketplace-http";
import { editWantedReply } from "@/modules/wanted/loaders/wanted-operations";

export const dynamic = "force-dynamic";

/** The author edits their own chat message within 15 minutes of posting it. */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ replyId: string }> },
): Promise<Response> {
  const { replyId } = await context.params;
  return executeMarketplaceJson(request, (input) => editWantedReply(replyId, input));
}
