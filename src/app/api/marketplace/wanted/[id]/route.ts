import { marketplaceResponse } from "@/modules/wanted/delivery/marketplace-http";
import { readPublicWanted } from "@/modules/wanted/loaders/wanted-operations";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return marketplaceResponse(await readPublicWanted(id));
}
