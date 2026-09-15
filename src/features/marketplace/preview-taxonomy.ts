import type { MarketplaceTaxonomy } from "@/contracts/marketplace";
import type { MarketplaceResult } from "./types";
import type { PreviewState } from "./wanted-source";

/**
 * Development-only option lists for the creation-workspace preview harness.
 *
 * `/wanted/new` reads the real `GET /api/marketplace/taxonomy`, which requires
 * an email-verified session. No such account can be seeded for CI, so the
 * preview harness at `/wanted/new/preview` — and only that route — uses these
 * options so the form, its validation, its keyboard behaviour and its 360 px
 * layout remain reviewable in a browser. That route carries a `FixtureNotice`
 * naming exactly this. Delete this module and the harness together once a
 * seeded verified identity can drive the real route.
 *
 * Every option here is invented. Production taxonomy tables begin empty and
 * are populated only from reviewed institutional records, so nothing in this
 * file may be presented as an approved UiTM catalogue.
 *
 * Identifiers are UUIDs because the published contract accepts nothing else.
 * Shaping the preview like production means a draft that passes here would not
 * be refused there for the shape of its identifiers.
 */

/** Stable, literal and unique: a preview must render the same options twice. */
function id(group: string, index: number): string {
  return `0e11${group}-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

const CAMPUSES = ["UiTM Shah Alam", "UiTM Puncak Alam", "UiTM Machang", "UiTM Samarahan"];

const FACULTIES = [
  "Faculty of Computer and Mathematical Sciences",
  "Faculty of Accountancy",
  "Faculty of Law",
];

const PROGRAMMES: readonly (readonly [string, number])[] = [
  ["Bachelor of Computer Science", 0],
  ["Foundation in Science", 0],
  ["Bachelor of Accountancy", 1],
  ["Bachelor of Legal Studies", 2],
];

const COURSES: readonly (readonly [string, string, number])[] = [
  ["CSC510", "Database Systems", 0],
  ["CSC584", "Machine Learning", 0],
  ["MAT183", "Calculus I", 1],
  ["ACC406", "Financial Reporting", 2],
  ["LAW416", "Malaysian Legal System", 3],
];

const SESSIONS = ["Semester 2, 2024/2025", "Semester 1, 2024/2025", "Semester 2, 2023/2024"];

const RESOURCE_TYPES = [
  "Lecture notes",
  "Past year questions",
  "Worked solutions",
  "Lab manual",
  "Revision summary",
];

const LANGUAGES = ["English", "Malay", "English or Malay"];

const TAGS = [
  "Final exam",
  "Midterm",
  "Summary notes",
  "Worked solutions",
  "Diagrams",
  "Formula sheet",
  "Past year",
];

function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-)|(-$)/g, "");
}

function items(group: string, labels: readonly string[]) {
  return labels.map((label, index) => ({ id: id(group, index), slug: slugify(label), label }));
}

const TAXONOMY: MarketplaceTaxonomy = {
  provenance: "reviewed_configuration",
  campuses: items("aaaa", CAMPUSES),
  faculties: items("bbbb", FACULTIES),
  programmes: PROGRAMMES.map(([label, facultyIndex], index) => ({
    id: id("cccc", index),
    slug: slugify(label),
    label,
    facultyId: id("bbbb", facultyIndex),
  })),
  courses: COURSES.map(([code, label, programmeIndex], index) => ({
    id: id("dddd", index),
    slug: code.toLowerCase(),
    label,
    code,
    programmeId: id("cccc", programmeIndex),
  })),
  academicSessions: items("eeee", SESSIONS),
  resourceTypes: items("ffff", RESOURCE_TYPES),
  languages: items("9999", LANGUAGES),
  tags: items("7777", TAGS),
};

const EMPTY: MarketplaceTaxonomy = {
  provenance: "reviewed_configuration",
  campuses: [],
  faculties: [],
  programmes: [],
  courses: [],
  academicSessions: [],
  resourceTypes: [],
  languages: [],
  tags: [],
};

/**
 * The harness's option lists.
 *
 * An unreachable taxonomy answers `unavailable` rather than an empty
 * vocabulary, matching what the real screen does: a form offering no campus
 * because the read failed would look like an institution with no campuses.
 */
export function loadPreviewTaxonomy(
  preview: PreviewState | null = null,
): MarketplaceResult<MarketplaceTaxonomy> {
  if (preview === "unavailable") {
    return { status: "unavailable" };
  }

  return { status: "ready", data: preview === "empty" ? EMPTY : TAXONOMY };
}
