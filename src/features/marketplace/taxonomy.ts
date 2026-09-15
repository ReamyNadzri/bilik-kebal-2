import type { CourseOption, MarketplaceTaxonomy, ProgrammeOption } from "@/contracts/marketplace";

/**
 * Narrowing helpers over the published marketplace taxonomy.
 *
 * The form narrows programme by faculty and course by programme for the same
 * reason the database does: the server verifies the whole faculty → programme
 * → course hierarchy and refuses inactive or cross-institution selections
 * (docs/integration/marketplace-http-contract.md). Offering a course that
 * cannot belong to the chosen programme would only produce a refusal the
 * reader could have been spared.
 *
 * These are presentation conveniences and no kind of authority. The server
 * checks the hierarchy again on every create and update.
 */

/** Programmes under one faculty. Nothing until a faculty is chosen. */
export function programmesFor(
  taxonomy: MarketplaceTaxonomy,
  facultyId: string | null,
): readonly ProgrammeOption[] {
  if (facultyId === null || facultyId === "") {
    return [];
  }

  return taxonomy.programmes.filter((programme) => programme.facultyId === facultyId);
}

/** Courses under one programme. Nothing until a programme is chosen. */
export function coursesFor(
  taxonomy: MarketplaceTaxonomy,
  programmeId: string | null,
): readonly CourseOption[] {
  if (programmeId === null || programmeId === "") {
    return [];
  }

  return taxonomy.courses.filter((course) => course.programmeId === programmeId);
}

/** Course code first, because that is what a student searches by. */
export function courseLabel(course: CourseOption): string {
  return `${course.code} ${course.label}`;
}
