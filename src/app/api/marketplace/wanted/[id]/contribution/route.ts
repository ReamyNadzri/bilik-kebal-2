import { executeMarketplaceJson } from "@/modules/wanted/delivery/marketplace-http";
import { createBackingIntent } from "@/modules/money/loaders/money-operations";

export const dynamic = "force-dynamic";

/** Backing an open Wanted (`id` is its public id). Success is a bill, never a payment. */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return executeMarketplaceJson(request, (input) => createBackingIntent(id, input));
}
