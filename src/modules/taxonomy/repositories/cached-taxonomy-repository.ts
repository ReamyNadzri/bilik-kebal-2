import { unstable_cache } from "next/cache";
import type { MarketplaceTaxonomy } from "@/contracts/marketplace";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { SupabaseTaxonomyRepository } from "./supabase-taxonomy-repository";
import type { TaxonomyRepository } from "./taxonomy-repository";

/**
 * Active taxonomy for one university (or all), shared across requests for a
 * minute. Every Board and "Post a Wanted" render read eight tables for lists
 * that change only when a Sheriff adds an entry.
 *
 * Read with the service client because a cached value cannot belong to one
 * viewer. It returns exactly what the browse policies give any member with a
 * verified email (active rows), and `TaxonomyService` refuses everyone else
 * before this is reached.
 */
const listActiveCached = unstable_cache(
  (institutionId: string | null): Promise<MarketplaceTaxonomy> =>
    new SupabaseTaxonomyRepository(createSupabaseAdminClient()).listActive(institutionId),
  ["marketplace-taxonomy"],
  { revalidate: 60 },
);

export class CachedTaxonomyRepository implements TaxonomyRepository {
  listActive(institutionId: string | null): Promise<MarketplaceTaxonomy> {
    return listActiveCached(institutionId);
  }
}
