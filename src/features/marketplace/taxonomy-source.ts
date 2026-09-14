import { CAMPUSES, RESOURCE_TYPES, SESSIONS } from "./fixtures";
import type { TaxonomyOption } from "./types";
import type { MarketplaceResult } from "./types";
import type { PreviewState } from "./wanted-source";

/**
 * The controlled vocabularies the Wanted creation form offers.
 *
 * Shaped after the hierarchy the backend enforces with composite foreign keys
 * (`docs/superpowers/specs/2026-09-15-vaultix-phase-3-wanted-money-design.md`
 * §3.1): an institution owns campuses, faculties and academic sessions; a
 * faculty owns programmes; a programme owns courses; resource types, languages
 * and tags are global. The form narrows programme by faculty and course by
 * programme for the same reason the database does — a browser-chosen label
 * must never be able to attach a course to the wrong faculty.
 *
 * Every option here is invented development data. Production taxonomy tables
 * begin empty and are populated only from reviewed institutional records, so
 * nothing in this file may be presented as an approved UiTM catalogue.
 */

export interface ProgrammeOption extends TaxonomyOption {
  readonly facultyId: string;
}

export interface CourseOption {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly programmeId: string;
}

export interface WantedTaxonomy {
  /** Shown beside the selects so nobody mistakes these for reviewed records. */
  readonly provenance: string;
  readonly campuses: readonly TaxonomyOption[];
  readonly faculties: readonly TaxonomyOption[];
  readonly programmes: readonly ProgrammeOption[];
  readonly courses: readonly CourseOption[];
  readonly sessions: readonly TaxonomyOption[];
  readonly resourceTypes: readonly TaxonomyOption[];
  readonly languages: readonly TaxonomyOption[];
  readonly tags: readonly TaxonomyOption[];
}

const FACULTIES: readonly TaxonomyOption[] = [
  { id: "fskm", label: "Faculty of Computer and Mathematical Sciences" },
  { id: "accountancy", label: "Faculty of Accountancy" },
  { id: "law", label: "Faculty of Law" },
  { id: "applied-sciences", label: "Faculty of Applied Sciences" },
  { id: "engineering", label: "Faculty of Engineering" },
  { id: "business", label: "Faculty of Business and Management" },
  { id: "language-studies", label: "Academy of Language Studies" },
  { id: "acis", label: "Academy of Contemporary Islamic Studies" },
] as const;

const PROGRAMMES: readonly ProgrammeOption[] = [
  { id: "cs", label: "Bachelor of Computer Science", facultyId: "fskm" },
  { id: "foundation-science", label: "Foundation in Science", facultyId: "fskm" },
  { id: "bacc", label: "Bachelor of Accountancy", facultyId: "accountancy" },
  { id: "legal-studies", label: "Bachelor of Legal Studies", facultyId: "law" },
  { id: "biology", label: "Bachelor of Biology", facultyId: "applied-sciences" },
  { id: "mechanical", label: "Bachelor of Mechanical Engineering", facultyId: "engineering" },
  { id: "bba", label: "Bachelor of Business Administration", facultyId: "business" },
  {
    id: "dip-english",
    label: "Diploma in English for Professional Communication",
    facultyId: "language-studies",
  },
  { id: "dip-islamic", label: "Diploma in Islamic Studies", facultyId: "acis" },
] as const;

/**
 * Identifiers match the Board's course fixtures, so a request created here
 * would be filterable on the Board and its duplicate suggestions are real.
 */
const COURSES: readonly CourseOption[] = [
  { id: "csc510", code: "CSC510", name: "Database Systems", programmeId: "cs" },
  { id: "csc584", code: "CSC584", name: "Machine Learning", programmeId: "cs" },
  { id: "mat183", code: "MAT183", name: "Calculus I", programmeId: "foundation-science" },
  { id: "acc406", code: "ACC406", name: "Financial Reporting", programmeId: "bacc" },
  { id: "law416", code: "LAW416", name: "Malaysian Legal System", programmeId: "legal-studies" },
  { id: "bio220", code: "BIO220", name: "Cell Biology", programmeId: "biology" },
  { id: "phy210", code: "PHY210", name: "Physics for Engineers", programmeId: "mechanical" },
  { id: "eco415", code: "ECO415", name: "Economic Statistics", programmeId: "bba" },
  {
    id: "bel422",
    code: "BEL422",
    name: "English for Academic Purposes",
    programmeId: "dip-english",
  },
  {
    id: "ctu551",
    code: "CTU551",
    name: "Islamic Thought and Civilisation",
    programmeId: "dip-islamic",
  },
] as const;

const LANGUAGES: readonly TaxonomyOption[] = [
  { id: "english", label: "English" },
  { id: "malay", label: "Malay" },
  { id: "either", label: "English or Malay" },
] as const;

const TAGS: readonly TaxonomyOption[] = [
  { id: "final-exam", label: "Final exam" },
  { id: "midterm", label: "Midterm" },
  { id: "summary-notes", label: "Summary notes" },
  { id: "worked-solutions", label: "Worked solutions" },
  { id: "diagrams", label: "Diagrams" },
  { id: "formula-sheet", label: "Formula sheet" },
  { id: "past-year", label: "Past year" },
] as const;

const PROVENANCE =
  "These options are development fixtures, not a reviewed institutional catalogue. The published taxonomy will replace them.";

const EMPTY: WantedTaxonomy = {
  provenance: PROVENANCE,
  campuses: [],
  faculties: [],
  programmes: [],
  courses: [],
  sessions: [],
  resourceTypes: [],
  languages: [],
  tags: [],
};

const TAXONOMY: WantedTaxonomy = {
  provenance: PROVENANCE,
  campuses: CAMPUSES,
  faculties: FACULTIES,
  programmes: PROGRAMMES,
  courses: COURSES,
  sessions: SESSIONS,
  resourceTypes: RESOURCE_TYPES,
  languages: LANGUAGES,
  tags: TAGS,
};

/**
 * The replaceable seam. `GET /api/marketplace/taxonomy` replaces the body when
 * Codex publishes `ListTaxonomyResult`; no component changes.
 *
 * An unreachable taxonomy answers `unavailable` rather than an empty
 * vocabulary: a form offering no campus because the read failed would look
 * like an institution with no campuses.
 */
export function loadWantedTaxonomy(
  preview: PreviewState | null = null,
): MarketplaceResult<WantedTaxonomy> {
  if (preview === "unavailable") {
    return { status: "unavailable" };
  }

  return { status: "ready", data: preview === "empty" ? EMPTY : TAXONOMY };
}

/** Programmes belonging to one faculty. Nothing until a faculty is chosen. */
export function programmesFor(
  taxonomy: WantedTaxonomy,
  facultyId: string | null,
): readonly ProgrammeOption[] {
  if (facultyId === null) {
    return [];
  }

  return taxonomy.programmes.filter((programme) => programme.facultyId === facultyId);
}

/** Courses belonging to one programme. Nothing until a programme is chosen. */
export function coursesFor(
  taxonomy: WantedTaxonomy,
  programmeId: string | null,
): readonly CourseOption[] {
  if (programmeId === null) {
    return [];
  }

  return taxonomy.courses.filter((course) => course.programmeId === programmeId);
}
