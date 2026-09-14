import { toSen } from "../money";
import type { HuntOpportunity, WantedSummary } from "../types";

/**
 * Builders for the marketplace view models.
 *
 * Test support only. Production code must never import this module
 * (`context/code-standards.md`).
 *
 * Built from the view-model types, so a field added to `WantedSummary` fails
 * these builders to compile rather than letting a card silently stop rendering
 * it.
 */
export function aWanted(overrides: Partial<WantedSummary> = {}): WantedSummary {
  return {
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
    ...overrides,
  };
}

export function aHunt(overrides: Partial<HuntOpportunity> = {}): HuntOpportunity {
  return {
    ...aWanted(overrides),
    activeClaimCount: 3,
    eligibility: "institution-verified",
    ...overrides,
  };
}
