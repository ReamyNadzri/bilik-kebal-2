import { toSen } from "./money";
import type { ClaimSummary, HuntOpportunity, WantedSummary } from "./types";

/**
 * Development fixture data for the Hunt workspace.
 *
 * `/`, `/board` and `/wanted/[id]` read the published public Wanted
 * operations, so nothing here feeds them any more. What remains backs
 * `/claims`, which is Phase 4 Claims and moderation work with no contract to
 * consume yet, and that route says so with a `FixtureNotice`.
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

/** Ordered newest first, which is the Board's default sort. */
const WANTED: readonly WantedSummary[] = [
  {
    id: "csc584-tutorial-solutions",
    kind: "academic",
    isFree: false,
    lastSeenLocation: null,
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
    kind: "academic",
    isFree: false,
    lastSeenLocation: null,
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
    kind: "academic",
    isFree: false,
    lastSeenLocation: null,
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
    kind: "academic",
    isFree: false,
    lastSeenLocation: null,
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
    kind: "academic",
    isFree: false,
    lastSeenLocation: null,
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
    kind: "academic",
    isFree: false,
    lastSeenLocation: null,
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
    kind: "academic",
    isFree: false,
    lastSeenLocation: null,
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
    kind: "academic",
    isFree: false,
    lastSeenLocation: null,
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
    kind: "academic",
    isFree: false,
    lastSeenLocation: null,
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
    kind: "academic",
    isFree: false,
    lastSeenLocation: null,
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
    kind: "academic",
    isFree: false,
    lastSeenLocation: null,
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
    kind: "academic",
    isFree: false,
    lastSeenLocation: null,
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

function wantedFixture(id: string): WantedSummary {
  const wanted = WANTED.find((item) => item.id === id);

  if (wanted === undefined) {
    throw new Error(`Hunt fixture refers to an unknown Wanted: ${id}`);
  }

  return wanted;
}

export const HUNTS: readonly HuntOpportunity[] = [
  {
    ...wantedFixture("csc584-tutorial-solutions"),
    activeClaimCount: 3,
    eligibility: "institution-verified",
  },
  {
    ...wantedFixture("law416-case-summaries"),
    activeClaimCount: 5,
    eligibility: "faculty-match-preferred",
  },
  {
    ...wantedFixture("ctu551-lecture-notes"),
    activeClaimCount: 1,
    eligibility: "institution-verified",
  },
  {
    ...wantedFixture("mat183-revision-set"),
    activeClaimCount: 7,
    eligibility: "faculty-match-preferred",
  },
] as const;

export const CLAIMS: readonly ClaimSummary[] = [
  {
    id: "claim-draft",
    wantedId: "csc584-tutorial-solutions",
    wantedTitle: "Tutorial solutions for sets 1 to 6",
    courseCode: "CSC584",
    courseName: "Machine Learning",
    status: "draft",
    submittedAt: null,
  },
  {
    id: "claim-screening",
    wantedId: "csc510-final-exam-notes",
    wantedTitle: "Final exam notes and summary for chapters 1 to 12",
    courseCode: "CSC510",
    courseName: "Database Systems",
    status: "screening",
    submittedAt: "2026-09-14T08:00:00.000Z",
  },
  {
    id: "claim-needs-information",
    wantedId: "bio220-lab-report-guide",
    wantedTitle: "Lab report structure and marking guide",
    courseCode: "BIO220",
    courseName: "Cell Biology",
    status: "needs-information",
    submittedAt: "2026-09-13T09:00:00.000Z",
  },
  {
    id: "claim-under-review",
    wantedId: "law416-case-summaries",
    wantedTitle: "Case summary pack for the whole syllabus",
    courseCode: "LAW416",
    courseName: "Malaysian Legal System",
    status: "under-review",
    submittedAt: "2026-09-12T09:00:00.000Z",
  },
  {
    id: "claim-not-selected",
    wantedId: "csc510-midterm-revision",
    wantedTitle: "Midterm revision notes for chapters 1 to 6",
    courseCode: "CSC510",
    courseName: "Database Systems",
    status: "not-selected",
    submittedAt: "2026-09-10T09:00:00.000Z",
  },
  {
    id: "claim-approved",
    wantedId: "bel422-writing-samples",
    wantedTitle: "Academic writing samples with lecturer feedback",
    courseCode: "BEL422",
    courseName: "English for Academic Purposes",
    status: "approved",
    submittedAt: "2026-09-09T09:00:00.000Z",
  },
  {
    id: "claim-rejected",
    wantedId: "acc406-past-year-scheme",
    wantedTitle: "Past year answer scheme from 2022 to 2024",
    courseCode: "ACC406",
    courseName: "Financial Reporting",
    status: "rejected",
    submittedAt: "2026-09-08T09:00:00.000Z",
  },
  {
    id: "claim-quarantined",
    wantedId: "phy210-past-year-answers",
    wantedTitle: "Past year questions and answers from 2021 to 2025",
    courseCode: "PHY210",
    courseName: "Physics for Engineers",
    status: "quarantined",
    submittedAt: "2026-09-07T09:00:00.000Z",
  },
] as const;
