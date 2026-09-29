import type { University, UniversityChoice } from "@/contracts/universities";

/**
 * Which university a reader is shown, from the universities on offer.
 *
 * A member verified at a university is shown that one and cannot switch.
 * Anyone else is shown the one they picked, or the first on offer when they
 * have not picked or picked one that is no longer offered. Null only when no
 * university is offered, and then nothing is filtered.
 */
export function chooseUniversity(
  options: readonly University[],
  verifiedInstitutionId: string | null,
  pickedSlug: string | null,
): UniversityChoice | null {
  const first = options[0];
  if (first === undefined) return null;
  const verified = options.find((option) => option.id === verifiedInstitutionId);
  if (verified !== undefined) return { current: verified, options, locked: true };
  const picked = options.find((option) => option.slug === pickedSlug) ?? first;
  return { current: picked, options, locked: false };
}
