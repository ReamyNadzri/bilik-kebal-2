import { marketplaceResponse } from "@/modules/wanted/delivery/marketplace-http";
import { deleteWantedReply } from "@/modules/wanted/loaders/wanted-operations";

export const dynamic = "force-dynamic";

/** The author deletes their own chat message; its text is erased. */
export async function POST(
  _request: Request,
  context: { params: Promise<{ replyId: string }> },
): Promise<Response> {
  const { replyId } = await context.params;
  return marketplaceResponse(await deleteWantedReply(replyId));
}
