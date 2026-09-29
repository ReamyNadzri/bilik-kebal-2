import type { ListTaxonomyResult } from "@/contracts/marketplace";
import { getRequestSupabaseClient } from "@/lib/supabase/server";
import { loadAccountContext, loadUniversityChoice } from "@/modules/identity";
import { SupabaseTaxonomyRepository } from "../repositories/supabase-taxonomy-repository";
import { TaxonomyService } from "../services/taxonomy-service";

/**
 * The catalogue of the university the viewer is shown: their verified
 * institution's, or for anyone not yet verified, the one they chose.
 *
 * The viewer comes from the identity module's account read, which a page
 * render shares with its layout and guard. The catalogue itself is read per
 * request through the viewer's own client, so RLS still decides what it holds.
 */
export async function loadMarketplaceTaxonomy(): Promise<ListTaxonomyResult> {
  const client = await getRequestSupabaseClient();
  const service = new TaxonomyService(new SupabaseTaxonomyRepository(client));
  const signedIn = await loadAccountContext();

  if (!signedIn) {
    return service.list({ authenticated: false, emailVerified: false, institutionId: null });
  }

  const { record: account, user } = signedIn;
  const verifiedInstitutionId =
    account?.institutionVerificationState === "verified" ? (account.institution?.id ?? null) : null;
  return service.list({
    authenticated: true,
    emailVerified: Boolean(user.email_confirmed_at),
    institutionId: verifiedInstitutionId ?? (await loadUniversityChoice())?.current.id ?? null,
  });
}
