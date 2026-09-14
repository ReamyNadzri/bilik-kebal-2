import { toSen } from "./money";
import type {
  CommissionerPresentation,
  TaxonomyOption,
  WantedDetail,
  WantedSummary,
} from "./types";

/**
 * Development fixture data for the Wanted marketplace.
 *
 * Every record here is invented. No course, campus, request, bounty, backer
 * count or person is real, and nothing is read from or written to a database.
 * Screens backed by this module carry a `FixtureNotice` saying so.
 *
 * Rules this file keeps, from
 * `docs/superpowers/specs/2026-09-14-vaultix-marketplace-visual-direction.md`
 * §13: money is integer sen, identifiers and instants are literal constants,
 * there is no `Math.random()` and no clock read, and no file, storage path or
 * personal datum appears.
 *
 * The institutions are UiTM campuses because release one is UiTM-first
 * (`context/project-overview.md`). The reference images invented other
 * universities; the product rule wins.
 */

/**
 * The instant every relative time on a fixture-backed screen is measured
 * against.
 *
 * Fixed rather than `Date.now()` for two reasons. Determinism is required of
 * fixture data, and a wall-clock read would produce one string on the server
 * and another in the browser — a hydration mismatch on the exact elements that
 * carry deadlines. Real closing times must arrive from the backend with a
 * server-rendered reference instant.
 */
export const FIXTURE_NOW = "2026-09-14T09:00:00.000Z";

export const CAMPUSES: readonly TaxonomyOption[] = [
  { id: "shah-alam", label: "UiTM Shah Alam" },
  { id: "puncak-alam", label: "UiTM Puncak Alam" },
  { id: "segamat", label: "UiTM Segamat" },
  { id: "arau", label: "UiTM Arau" },
  { id: "samarahan", label: "UiTM Kota Samarahan" },
  { id: "permatang-pauh", label: "UiTM Permatang Pauh" },
] as const;

export const COURSES: readonly TaxonomyOption[] = [
  { id: "acc406", label: "ACC406 Financial Reporting" },
  { id: "bel422", label: "BEL422 English for Academic Purposes" },
  { id: "bio220", label: "BIO220 Cell Biology" },
  { id: "csc510", label: "CSC510 Database Systems" },
  { id: "csc584", label: "CSC584 Machine Learning" },
  { id: "ctu551", label: "CTU551 Islamic Thought and Civilisation" },
  { id: "eco415", label: "ECO415 Economic Statistics" },
  { id: "law416", label: "LAW416 Malaysian Legal System" },
  { id: "mat183", label: "MAT183 Calculus I" },
  { id: "phy210", label: "PHY210 Physics for Engineers" },
] as const;

export const RESOURCE_TYPES: readonly TaxonomyOption[] = [
  { id: "past-year-answers", label: "Past year answers" },
  { id: "lecture-notes", label: "Lecture notes" },
  { id: "study-pack", label: "Study pack" },
  { id: "case-notes", label: "Case notes" },
  { id: "revision-set", label: "Revision set" },
  { id: "lab-support-notes", label: "Lab support notes" },
] as const;

export const SESSIONS: readonly TaxonomyOption[] = [
  { id: "2025-2026-sem1", label: "Semester 1, 2025/2026" },
  { id: "2024-2025-sem2", label: "Semester 2, 2024/2025" },
  { id: "2024-2025-sem1", label: "Semester 1, 2024/2025" },
] as const;

/** Ordered newest first, which is the Board's default sort. */
export const WANTED: readonly WantedSummary[] = [
  {
    id: "csc584-tutorial-solutions",
    title: "Tutorial solutions for sets 1 to 6",
    courseCode: "CSC584",
    courseName: "Machine Learning",
    courseId: "csc584",
    campus: "UiTM Shah Alam",
    campusId: "shah-alam",
    resourceType: "Study pack",
    resourceTypeId: "study-pack",
    session: "Semester 1, 2025/2026",
    sessionId: "2025-2026-sem1",
    grossBountySen: toSen(60),
    backerCount: 9,
    status: "open",
    postedAt: "2026-09-14T07:00:00.000Z",
    closesAt: "2026-09-20T09:00:00.000Z",
  },
  {
    id: "law416-case-summaries",
    title: "Case summary pack for the whole syllabus",
    courseCode: "LAW416",
    courseName: "Malaysian Legal System",
    courseId: "law416",
    campus: "UiTM Shah Alam",
    campusId: "shah-alam",
    resourceType: "Case notes",
    resourceTypeId: "case-notes",
    session: "Semester 2, 2024/2025",
    sessionId: "2024-2025-sem2",
    grossBountySen: toSen(30),
    backerCount: 15,
    status: "well-funded",
    postedAt: "2026-09-13T09:00:00.000Z",
    closesAt: "2026-09-18T09:00:00.000Z",
  },
  {
    id: "ctu551-lecture-notes",
    title: "Lecture notes for weeks 1 to 14",
    courseCode: "CTU551",
    courseName: "Islamic Thought and Civilisation",
    courseId: "ctu551",
    campus: "UiTM Segamat",
    campusId: "segamat",
    resourceType: "Lecture notes",
    resourceTypeId: "lecture-notes",
    session: "Semester 1, 2025/2026",
    sessionId: "2025-2026-sem1",
    grossBountySen: toSen(25),
    backerCount: 6,
    status: "open",
    postedAt: "2026-09-13T02:00:00.000Z",
    closesAt: "2026-09-22T09:00:00.000Z",
  },
  {
    id: "csc510-final-exam-notes",
    title: "Final exam notes and summary for chapters 1 to 12",
    courseCode: "CSC510",
    courseName: "Database Systems",
    courseId: "csc510",
    campus: "UiTM Shah Alam",
    campusId: "shah-alam",
    resourceType: "Lecture notes",
    resourceTypeId: "lecture-notes",
    session: "Semester 2, 2024/2025",
    sessionId: "2024-2025-sem2",
    grossBountySen: toSen(85),
    backerCount: 6,
    status: "open",
    postedAt: "2026-09-11T09:00:00.000Z",
    closesAt: "2026-09-17T00:00:00.000Z",
  },
  {
    id: "bio220-lab-report-guide",
    title: "Lab report structure and marking guide",
    courseCode: "BIO220",
    courseName: "Cell Biology",
    courseId: "bio220",
    campus: "UiTM Puncak Alam",
    campusId: "puncak-alam",
    resourceType: "Lab support notes",
    resourceTypeId: "lab-support-notes",
    session: "Semester 2, 2024/2025",
    sessionId: "2024-2025-sem2",
    grossBountySen: toSen(32),
    backerCount: 4,
    status: "open",
    postedAt: "2026-09-11T04:00:00.000Z",
    closesAt: "2026-09-23T09:00:00.000Z",
  },
  {
    id: "bel422-writing-samples",
    title: "Academic writing samples with lecturer feedback",
    courseCode: "BEL422",
    courseName: "English for Academic Purposes",
    courseId: "bel422",
    campus: "UiTM Kota Samarahan",
    campusId: "samarahan",
    resourceType: "Study pack",
    resourceTypeId: "study-pack",
    session: "Semester 2, 2024/2025",
    sessionId: "2024-2025-sem2",
    grossBountySen: toSen(12),
    backerCount: 3,
    status: "open",
    postedAt: "2026-09-10T09:00:00.000Z",
    closesAt: "2026-09-24T09:00:00.000Z",
  },
  {
    id: "csc510-past-year-questions",
    title: "Past year questions from 2019 to 2024",
    courseCode: "CSC510",
    courseName: "Database Systems",
    courseId: "csc510",
    campus: "UiTM Shah Alam",
    campusId: "shah-alam",
    resourceType: "Past year answers",
    resourceTypeId: "past-year-answers",
    session: "Semester 2, 2024/2025",
    sessionId: "2024-2025-sem2",
    grossBountySen: toSen(40),
    backerCount: 7,
    status: "open",
    postedAt: "2026-09-10T01:00:00.000Z",
    closesAt: "2026-09-19T09:00:00.000Z",
  },
  {
    id: "mat183-revision-set",
    title: "Revision set with fully worked solutions",
    courseCode: "MAT183",
    courseName: "Calculus I",
    courseId: "mat183",
    campus: "UiTM Arau",
    campusId: "arau",
    resourceType: "Revision set",
    resourceTypeId: "revision-set",
    session: "Semester 1, 2024/2025",
    sessionId: "2024-2025-sem1",
    grossBountySen: toSen(38),
    backerCount: 11,
    status: "ending-soon",
    postedAt: "2026-09-09T09:00:00.000Z",
    closesAt: "2026-09-15T05:00:00.000Z",
  },
  {
    id: "acc406-past-year-scheme",
    title: "Past year answer scheme from 2022 to 2024",
    courseCode: "ACC406",
    courseName: "Financial Reporting",
    courseId: "acc406",
    campus: "UiTM Puncak Alam",
    campusId: "puncak-alam",
    resourceType: "Past year answers",
    resourceTypeId: "past-year-answers",
    session: "Semester 1, 2025/2026",
    sessionId: "2025-2026-sem1",
    grossBountySen: toSen(45),
    backerCount: 12,
    status: "reviewing",
    postedAt: "2026-09-08T09:00:00.000Z",
    closesAt: "2026-09-15T03:00:00.000Z",
  },
  {
    id: "csc510-midterm-revision",
    title: "Midterm revision notes for chapters 1 to 6",
    courseCode: "CSC510",
    courseName: "Database Systems",
    courseId: "csc510",
    campus: "UiTM Shah Alam",
    campusId: "shah-alam",
    resourceType: "Revision set",
    resourceTypeId: "revision-set",
    session: "Semester 2, 2024/2025",
    sessionId: "2024-2025-sem2",
    grossBountySen: toSen(25),
    backerCount: 4,
    status: "open",
    postedAt: "2026-09-07T09:00:00.000Z",
    closesAt: "2026-09-21T09:00:00.000Z",
  },
  {
    id: "eco415-formula-sheet",
    title: "Formula sheet and worked examples",
    courseCode: "ECO415",
    courseName: "Economic Statistics",
    courseId: "eco415",
    campus: "UiTM Permatang Pauh",
    campusId: "permatang-pauh",
    resourceType: "Study pack",
    resourceTypeId: "study-pack",
    session: "Semester 1, 2025/2026",
    sessionId: "2025-2026-sem1",
    grossBountySen: toSen(35),
    backerCount: 7,
    status: "ending-soon",
    postedAt: "2026-09-06T09:00:00.000Z",
    closesAt: "2026-09-14T14:00:00.000Z",
  },
  {
    id: "phy210-past-year-answers",
    title: "Past year questions and answers from 2021 to 2025",
    courseCode: "PHY210",
    courseName: "Physics for Engineers",
    courseId: "phy210",
    campus: "UiTM Arau",
    campusId: "arau",
    resourceType: "Past year answers",
    resourceTypeId: "past-year-answers",
    session: "Semester 1, 2024/2025",
    sessionId: "2024-2025-sem1",
    grossBountySen: toSen(50),
    backerCount: 8,
    status: "closed",
    postedAt: "2026-08-25T09:00:00.000Z",
    closesAt: "2026-09-13T09:00:00.000Z",
  },
] as const;

/**
 * The parts of a Wanted that only its own page shows.
 *
 * Held separately from the summaries so a Board read never carries detail it
 * does not render. Requests without an entry fall back to a composed default,
 * so every card on the Board links to a page that works.
 */
type DetailExtras = Omit<WantedDetail, keyof WantedSummary | "similarIds">;

const DEFAULT_COMMISSIONER: CommissionerPresentation = {
  displayName: "A verified student",
  emailVerified: true,
  institutionVerified: true,
};

/** 10% platform fee, snapshotted at publication (context/project-overview.md). */
const FEE_RATE_BASIS_POINTS = 1000;

const POLICY_VERSION = "2026-09-01";

const DETAIL: Readonly<Record<string, DetailExtras>> = {
  "csc510-final-exam-notes": {
    description:
      "Looking for complete notes or a summary covering every chapter, with the key formulas, the ER and normalisation diagrams, and the points that keep coming up in past papers. Handwritten or typed is fine as long as it is legible and covers the whole syllabus.",
    faculty: "Faculty of Computer and Mathematical Sciences",
    programme: "Bachelor of Computer Science",
    language: "English",
    tags: ["Final exam", "Summary notes", "Diagrams"],
    commissioner: DEFAULT_COMMISSIONER,
    feeRateBasisPoints: FEE_RATE_BASIS_POINTS,
    policyVersion: POLICY_VERSION,
    activity: [
      {
        id: "a1",
        at: "2026-09-11T09:00:00.000Z",
        summary: "Wanted published with the first contribution",
      },
      { id: "a2", at: "2026-09-12T04:30:00.000Z", summary: "A Backer joined the bounty" },
      { id: "a3", at: "2026-09-13T10:15:00.000Z", summary: "Three Backers joined the bounty" },
      { id: "a4", at: "2026-09-14T04:00:00.000Z", summary: "A Backer joined the bounty" },
    ],
  },
  "acc406-past-year-scheme": {
    description:
      "Answer schemes for the past three years, ideally with the working shown rather than final figures alone. Lecturer-released schemes only. Please do not submit anything taken from a paid tutorial centre.",
    faculty: "Faculty of Accountancy",
    programme: "Bachelor of Accountancy",
    language: "English",
    tags: ["Past year", "Answer scheme"],
    commissioner: DEFAULT_COMMISSIONER,
    feeRateBasisPoints: FEE_RATE_BASIS_POINTS,
    policyVersion: POLICY_VERSION,
    activity: [
      {
        id: "a1",
        at: "2026-09-08T09:00:00.000Z",
        summary: "Wanted published with the first contribution",
      },
      { id: "a2", at: "2026-09-10T02:00:00.000Z", summary: "Eleven Backers joined the bounty" },
      {
        id: "a3",
        at: "2026-09-13T06:00:00.000Z",
        summary: "A claim was submitted and entered screening",
      },
    ],
  },
  "mat183-revision-set": {
    description:
      "A revision set covering limits, differentiation and integration, with worked solutions rather than answers only. Tutorial questions with full working would help more than a formula list.",
    faculty: "Faculty of Computer and Mathematical Sciences",
    programme: "Foundation in Science",
    language: "English",
    tags: ["Revision", "Worked solutions"],
    commissioner: DEFAULT_COMMISSIONER,
    feeRateBasisPoints: FEE_RATE_BASIS_POINTS,
    policyVersion: POLICY_VERSION,
    activity: [
      {
        id: "a1",
        at: "2026-09-09T09:00:00.000Z",
        summary: "Wanted published with the first contribution",
      },
      { id: "a2", at: "2026-09-11T08:00:00.000Z", summary: "Ten Backers joined the bounty" },
    ],
  },
};

/**
 * Requests a reader should check before funding this one.
 *
 * Same course first, then the same kind of resource. Duplicate suggestions are
 * a product requirement before publishing (context/project-overview.md); the
 * same list is useful to a Backer deciding where their RM10 does most good.
 */
function similarTo(wanted: WantedSummary): readonly string[] {
  const sameCourse = WANTED.filter(
    (other) => other.id !== wanted.id && other.courseId === wanted.courseId,
  );
  const sameType = WANTED.filter(
    (other) =>
      other.id !== wanted.id &&
      other.courseId !== wanted.courseId &&
      other.resourceTypeId === wanted.resourceTypeId,
  );

  return [...sameCourse, ...sameType].slice(0, 3).map((other) => other.id);
}

export function findWantedDetail(id: string): WantedDetail | null {
  const summary = WANTED.find((wanted) => wanted.id === id);

  if (summary === undefined) {
    return null;
  }

  const extras: DetailExtras = DETAIL[id] ?? {
    description: `A request for ${summary.resourceType.toLowerCase()} covering ${summary.courseCode} ${summary.courseName}. The Commissioner has not added further detail.`,
    faculty: "Not stated",
    programme: "Not stated",
    language: "English",
    tags: [],
    commissioner: DEFAULT_COMMISSIONER,
    feeRateBasisPoints: FEE_RATE_BASIS_POINTS,
    policyVersion: POLICY_VERSION,
    activity: [
      {
        id: `${summary.id}-published`,
        at: summary.postedAt,
        summary: "Wanted published with the first contribution",
      },
    ],
  };

  return { ...summary, ...extras, similarIds: similarTo(summary) };
}
