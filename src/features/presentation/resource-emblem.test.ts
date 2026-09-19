import { emblemFor } from "./resource-emblem";

test.each([
  ["Past year paper", "exam"],
  ["Final exam answer scheme", "exam"],
  ["Lecture slides", "slides"],
  ["Formula sheet", "formula"],
  ["Lab report sample", "lab"],
  ["Worked example", "worked"],
  ["Tutorial solutions", "worked"],
  ["Summary notes", "notes"],
  ["Case notes", "notes"],
] as const)("draws %s as %s", (resourceType, kind) => {
  expect(emblemFor(resourceType)).toBe(kind);
});

test("matches whole words, so an example is not an exam and a syllabus is not a lab", () => {
  expect(emblemFor("Worked example")).toBe("worked");
  expect(emblemFor("Syllabus summary")).toBe("notes");
});

test("matches regardless of letter case", () => {
  expect(emblemFor("LECTURE SLIDES")).toBe("slides");
});

test("falls back to the notebook for a type it does not recognise", () => {
  expect(emblemFor("Study pack")).toBe("notes");
  expect(emblemFor("")).toBe("notes");
});
