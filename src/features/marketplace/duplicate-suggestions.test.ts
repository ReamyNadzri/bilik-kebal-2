import { suggestDuplicates } from "./duplicate-suggestions";
import { WANTED } from "./fixtures";
import type { WantedSummary } from "./types";

const BASE = {
  courseId: "csc510",
  resourceTypeId: "lecture-notes",
  sessionId: "2024-2025-sem2",
  title: "Final exam notes for every chapter",
};

function ids(results: readonly WantedSummary[]): string[] {
  return results.map((wanted) => wanted.id);
}

describe("ranking", () => {
  test("puts requests for the same course first", () => {
    const suggestions = suggestDuplicates(WANTED, BASE);

    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0]?.courseId).toBe("csc510");
  });

  test("groups every same-course request ahead of any other match", () => {
    const suggestions = suggestDuplicates(WANTED, BASE);
    const lastSameCourse = suggestions.findLastIndex((wanted) => wanted.courseId === "csc510");
    const firstOther = suggestions.findIndex((wanted) => wanted.courseId !== "csc510");

    expect(firstOther === -1 || firstOther > lastSameCourse).toBe(true);
  });

  test("then offers the same resource type in the same session", () => {
    const suggestions = suggestDuplicates(WANTED, {
      ...BASE,
      courseId: "not-on-the-board",
    });

    expect(
      suggestions.every(
        (wanted) =>
          wanted.resourceTypeId === BASE.resourceTypeId || wanted.sessionId === BASE.sessionId,
      ),
    ).toBe(true);
  });

  test("is deterministic, so the same draft always suggests the same requests", () => {
    expect(ids(suggestDuplicates(WANTED, BASE))).toEqual(ids(suggestDuplicates(WANTED, BASE)));
  });

  test("shows a workable number rather than the whole Board", () => {
    expect(suggestDuplicates(WANTED, BASE).length).toBeLessThanOrEqual(4);
  });
});

describe("what is excluded", () => {
  test("never suggests a closed request, which cannot be backed", () => {
    const suggestions = suggestDuplicates(WANTED, {
      ...BASE,
      courseId: "phy210",
      resourceTypeId: "past-year-answers",
    });

    expect(suggestions.every((wanted) => wanted.status !== "closed")).toBe(true);
  });

  test("suggests nothing when no request resembles the draft", () => {
    expect(
      suggestDuplicates(WANTED, {
        courseId: "nothing",
        resourceTypeId: "nothing",
        sessionId: "nothing",
        title: "zzzz",
      }),
    ).toEqual([]);
  });

  test("suggests nothing from an empty Board", () => {
    expect(suggestDuplicates([], BASE)).toEqual([]);
  });
});

describe("what a suggestion may carry", () => {
  test("returns public Board metadata only", () => {
    const [first] = suggestDuplicates(WANTED, BASE);

    expect(first).toBeDefined();
    expect(Object.keys(first!)).toEqual(
      expect.arrayContaining(["id", "title", "courseCode", "campus", "grossBountySen", "status"]),
    );
    expect(JSON.stringify(first)).not.toMatch(/objectKey|bucket|claim|evidence|email/i);
  });

  test("carries an identifier that addresses an existing Wanted page", () => {
    for (const suggestion of suggestDuplicates(WANTED, BASE)) {
      expect(WANTED.some((wanted) => wanted.id === suggestion.id)).toBe(true);
    }
  });
});
