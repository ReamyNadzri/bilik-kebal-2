import { operationResponse } from "@/modules/identity/delivery/auth-http";
import { loadMarketplaceTaxonomy } from "@/modules/taxonomy/loaders/taxonomy-read";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return operationResponse(await loadMarketplaceTaxonomy());
}
