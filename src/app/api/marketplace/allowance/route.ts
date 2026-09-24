import { marketplaceResponse } from "@/modules/wanted/delivery/marketplace-http";
import { readFreeAllowance } from "@/modules/wanted/loaders/wanted-operations";

export const dynamic = "force-dynamic";

/** The signed-in member's remaining free requests. */
export async function GET(): Promise<Response> {
  return marketplaceResponse(await readFreeAllowance());
}
