import { chooseUniversity } from "./university-choice";
import {
  scopedInstitutionId,
  universityLabel,
  viewOnlyUniversities,
} from "@/contracts/universities";

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
  test("shows a verified member every university by default, theirs as their own", () => {
    expect(chooseUniversity(BOTH, "u2", null)).toEqual({
      current: UMPSA,
      options: BOTH,
      all: true,
      own: UMPSA,
    });
  });

  test("lets a verified member pick one university, keeping their own", () => {
    expect(chooseUniversity(BOTH, "u2", "uitm")).toEqual({
      current: UITM,
      options: BOTH,
      all: false,
      own: UMPSA,
    });
  });

  test("shows anyone else the university they picked", () => {
    expect(chooseUniversity(BOTH, null, "umpsa")).toMatchObject({
      current: UMPSA,
      all: false,
      own: null,
    });
  });

  test("honours All for anyone", () => {
    expect(chooseUniversity(BOTH, null, "all")).toMatchObject({ current: UITM, all: true });
  });

  test("shows the first university when nothing, or something unknown, was picked", () => {
    expect(chooseUniversity(BOTH, null, null)).toMatchObject({ current: UITM, all: false });
    expect(chooseUniversity(BOTH, null, "unknown")).toMatchObject({ current: UITM, all: false });
  });

  test("treats a member whose university is no longer offered as not verified", () => {
    expect(chooseUniversity(BOTH, "gone", "umpsa")).toMatchObject({ current: UMPSA, own: null });
  });

  test("filters nothing when no university is offered", () => {
    expect(chooseUniversity([], null, "uitm")).toBeNull();
  });
});

describe("helpers", () => {
  test("scopes a list to one university, or to none under All", () => {
    expect(scopedInstitutionId(chooseUniversity(BOTH, null, "umpsa"))).toBe("u2");
    expect(scopedInstitutionId(chooseUniversity(BOTH, null, "all"))).toBeNull();
    expect(scopedInstitutionId(null)).toBeNull();
  });

  test("names the universities shown", () => {
    expect(universityLabel(chooseUniversity(BOTH, null, "umpsa")!)).toBe("UMPSA");
    expect(universityLabel(chooseUniversity(BOTH, null, "all")!)).toBe("UiTM and UMPSA");
  });

  test("marks every other university view only for a verified member, none otherwise", () => {
    expect(viewOnlyUniversities(chooseUniversity(BOTH, "u1", null))).toEqual({ u2: "UMPSA" });
    expect(viewOnlyUniversities(chooseUniversity(BOTH, null, "all"))).toEqual({});
  });
});
