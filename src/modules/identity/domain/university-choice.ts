import { ALL_UNIVERSITIES, type University, type UniversityChoice } from "@/contracts/universities";

/**
 * Which university a reader is shown, from the universities on offer.
 *
 * A pick is honoured for everyone, including "All". Without one, a member
 * verified at a university sees all of them at once (their own actionable,
 * the others greyed out); anyone else sees the first on offer. A pick that is
 * no longer offered counts as none. Null only when no university is offered,
 * and then nothing is filtered.
 */
export function chooseUniversity(
  options: readonly University[],
  verifiedInstitutionId: string | null,
  pickedSlug: string | null,
): UniversityChoice | null {
  const first = options[0];
  if (first === undefined) return null;
  const own = options.find((option) => option.id === verifiedInstitutionId) ?? null;
  const home = own ?? first;
  if (pickedSlug === ALL_UNIVERSITIES) return { current: home, options, all: true, own };
  const picked = options.find((option) => option.slug === pickedSlug);
  if (picked !== undefined) return { current: picked, options, all: false, own };
  return own !== null
    ? { current: own, options, all: true, own }
    : { current: first, options, all: false, own: null };
}
