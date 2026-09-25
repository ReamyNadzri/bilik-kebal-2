import { describe, expect, it } from "vitest";
import type { WantedSummary } from "@/contracts/marketplace";
import { rankDuplicateCandidates, type DuplicateCandidate } from "./duplicate-ranking";

const summary = (id: string, title: string): WantedSummary => ({
  id,
  kind: "academic",
  isFree: false,
  lastSeenLocation: null,
  title,
  courseCode: "CSC510",
  courseName: "Database Systems",
  courseId: "course-a",
  campus: "Main",
  campusId: "campus-a",
  resourceType: "Notes",
  resourceTypeId: "notes",
  session: "2026 S1",
  sessionId: "session-a",
  grossBountySen: 0 as never,
  backerCount: 0,
  status: "open",
  postedAt: "2026-09-01T00:00:00.000Z",
  closesAt: "2026-09-30T00:00:00.000Z",
});

function candidate(
  id: string,
  title: string,
  overrides: Partial<DuplicateCandidate> = {},
): DuplicateCandidate {
  return {
    wanted: summary(id, title),
    courseId: "course-b",
    resourceTypeId: "slides",
    academicSessionId: "session-b",
    ...overrides,
  };
}

describe("rankDuplicateCandidates", () => {
  it("prioritises the same course before weaker metadata matches", () => {
    const ranked = rankDuplicateCandidates(
      {
        title: "CSC510 final exam notes",
        courseId: "course-a",
        resourceTypeId: "notes",
        academicSessionId: "session-a",
      },
      [
        candidate("metadata", "Unrelated material", {
          resourceTypeId: "notes",
          academicSessionId: "session-a",
        }),
        candidate("course", "Another database resource", { courseId: "course-a" }),
      ],
    );
    expect(ranked.map(({ wanted }) => wanted.id)).toEqual(["course", "metadata"]);
  });

  it("normalises punctuation and common casing for title-term overlap", () => {
    const [match] = rankDuplicateCandidates(
      {
        title: "CSC510: FINAL-exam notes!",
        courseId: "x",
        resourceTypeId: "y",
        academicSessionId: "z",
      },
      [candidate("title", "Final Exam Notes for CSC510")],
    );
    expect(match?.reasons).toContain("similar_title");
  });

  it("excludes candidates with no meaningful signal and caps output", () => {
    const candidates = Array.from({ length: 12 }, (_, index) =>
      candidate(String(index), `Unique ${index}`, { courseId: index < 10 ? "course-a" : "other" }),
    );
    expect(
      rankDuplicateCandidates(
        {
          title: "No overlapping words",
          courseId: "course-a",
          resourceTypeId: "none",
          academicSessionId: "none",
        },
        candidates,
      ),
    ).toHaveLength(8);
  });
});
