import type { MarketplaceTaxonomy } from "@/contracts/marketplace";

export interface TaxonomyRepository {
  listActive(institutionId: string | null): Promise<MarketplaceTaxonomy>;
}
