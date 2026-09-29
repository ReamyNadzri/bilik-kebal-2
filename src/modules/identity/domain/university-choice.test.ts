import { chooseUniversity } from "./university-choice";

const UITM = {
  id: "u1",
  slug: "uitm",
  name: "Universiti Teknologi MARA (UiTM)",
  shortName: "UiTM",
};
const UMPSA = {
  id: "u2",
  slug: "umpsa",
  name: "Universiti Malaysia Pahang Al-Sultan Abdullah (UMPSA)",
  shortName: "UMPSA",
};
const BOTH = [UITM, UMPSA];

describe("chooseUniversity", () => {
  test("shows a verified member their own university, whatever they picked", () => {
    expect(chooseUniversity(BOTH, "u2", "uitm")).toEqual({
      current: UMPSA,
      options: BOTH,
      locked: true,
    });
  });

  test("shows anyone else the university they picked", () => {
    expect(chooseUniversity(BOTH, null, "umpsa")).toMatchObject({ current: UMPSA, locked: false });
  });

  test("shows the first university when nothing, or something unknown, was picked", () => {
    expect(chooseUniversity(BOTH, null, null)).toMatchObject({ current: UITM, locked: false });
    expect(chooseUniversity(BOTH, null, "unknown")).toMatchObject({ current: UITM, locked: false });
  });

  test("lets a member whose university is no longer offered pick", () => {
    expect(chooseUniversity(BOTH, "gone", "umpsa")).toMatchObject({
      current: UMPSA,
      locked: false,
    });
  });

  test("filters nothing when no university is offered", () => {
    expect(chooseUniversity([], null, "uitm")).toBeNull();
  });
});
