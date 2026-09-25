import type { MarketplaceTaxonomy } from "@/contracts/marketplace";

/**
 * A `MarketplaceTaxonomy` shaped exactly as `GET /api/marketplace/taxonomy`
 * returns one.
 *
 * Test support only. Production code must never import this module
 * (`context/code-standards.md`).
 *
 * Identifiers are UUIDs because the published contract accepts nothing else,
 * so a test cannot accidentally prove a draft valid that the server would
 * refuse. Labels are invented and name no real course.
 */
const ID = {
  campus: "11111111-1111-4111-8111-111111111111",
  otherCampus: "11111111-1111-4111-8111-111111111112",
  faculty: "22222222-2222-4222-8222-222222222222",
  otherFaculty: "22222222-2222-4222-8222-222222222223",
  programme: "33333333-3333-4333-8333-333333333333",
  otherProgramme: "33333333-3333-4333-8333-333333333334",
  course: "44444444-4444-4444-8444-444444444444",
  otherCourse: "44444444-4444-4444-8444-444444444445",
  session: "55555555-5555-4555-8555-555555555555",
  resourceType: "66666666-6666-4666-8666-666666666666",
  language: "77777777-7777-4777-8777-777777777777",
  tag: "88888888-8888-4888-8888-888888888888",
  otherTag: "88888888-8888-4888-8888-888888888889",
} as const;

/** Six, so a test can offer more than the five a draft may carry. */
const TAGS = [
  { id: ID.tag, slug: "final-exam", label: "Final exam" },
  { id: ID.otherTag, slug: "midterm", label: "Midterm" },
  { id: "88888888-8888-4888-8888-88888888888a", slug: "summary-notes", label: "Summary notes" },
  {
    id: "88888888-8888-4888-8888-88888888888b",
    slug: "worked-solutions",
    label: "Worked solutions",
  },
  { id: "88888888-8888-4888-8888-88888888888c", slug: "diagrams", label: "Diagrams" },
  { id: "88888888-8888-4888-8888-88888888888d", slug: "past-year", label: "Past year" },
];

export const TAXONOMY_ID = ID;

export function aTaxonomy(overrides: Partial<MarketplaceTaxonomy> = {}): MarketplaceTaxonomy {
  return {
    provenance: "reviewed_configuration",
    campuses: [
      { id: ID.campus, slug: "main-campus", label: "Main Campus", regionOpen: true },
      { id: ID.otherCampus, slug: "branch-campus", label: "Branch Campus", regionOpen: false },
    ],
    faculties: [
      { id: ID.faculty, slug: "computing", label: "Faculty of Computing" },
      { id: ID.otherFaculty, slug: "law", label: "Faculty of Law" },
    ],
    programmes: [
      {
        id: ID.programme,
        slug: "computer-science",
        label: "Bachelor of Computer Science",
        facultyId: ID.faculty,
      },
      {
        id: ID.otherProgramme,
        slug: "legal-studies",
        label: "Bachelor of Legal Studies",
        facultyId: ID.otherFaculty,
      },
    ],
    courses: [
      {
        id: ID.course,
        slug: "csc510",
        label: "Database Systems",
        code: "CSC510",
        programmeId: ID.programme,
      },
      {
        id: ID.otherCourse,
        slug: "law416",
        label: "Legal System",
        code: "LAW416",
        programmeId: ID.otherProgramme,
      },
    ],
    academicSessions: [{ id: ID.session, slug: "2024-2025-sem2", label: "Semester 2, 2024/2025" }],
    resourceTypes: [{ id: ID.resourceType, slug: "lecture-notes", label: "Lecture notes" }],
    languages: [{ id: ID.language, slug: "english", label: "English" }],
    tags: TAGS,
    ...overrides,
  };
}
