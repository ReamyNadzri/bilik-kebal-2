import type { ListTaxonomyResult } from "@/contracts/marketplace";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SupabaseIdentityReadRepository } from "@/modules/identity/repositories/supabase-identity-read-repository";
import { SupabaseTaxonomyRepository } from "../repositories/supabase-taxonomy-repository";
import { TaxonomyService } from "../services/taxonomy-service";

export async function loadMarketplaceTaxonomy(): Promise<ListTaxonomyResult> {
  const client = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  const service = new TaxonomyService(new SupabaseTaxonomyRepository(client));

  if (error || !user) {
    return service.list({ authenticated: false, emailVerified: false, institutionId: null });
  }

  const account = await new SupabaseIdentityReadRepository(client).readAccount(user);
  return service.list({
    authenticated: true,
    emailVerified: Boolean(user.email_confirmed_at),
    institutionId:
      account?.institutionVerificationState === "verified"
        ? (account.institution?.id ?? null)
        : null,
  });
}
