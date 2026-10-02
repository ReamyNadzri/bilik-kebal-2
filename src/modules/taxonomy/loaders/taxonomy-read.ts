import type { ListTaxonomyResult } from "@/contracts/marketplace";
import { loadAccountContext, loadUniversityChoice } from "@/modules/identity";
import { CachedTaxonomyRepository } from "../repositories/cached-taxonomy-repository";
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
  const service = new TaxonomyService(new CachedTaxonomyRepository());
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

/**
 * The catalogue of one named university, for a screen about something that
 * belongs to it: the edit dialog of a published Wanted offers its own
 * university's campuses and programmes, whichever university the viewer is
 * shown elsewhere. The database refuses a value from any other university.
 */
export async function loadMarketplaceTaxonomyAt(
  institutionId: string,
): Promise<ListTaxonomyResult> {
  const service = new TaxonomyService(new CachedTaxonomyRepository());
  const signedIn = await loadAccountContext();
  return service.list({
    authenticated: signedIn !== null,
    emailVerified: Boolean(signedIn?.user.email_confirmed_at),
    institutionId,
  });
}
