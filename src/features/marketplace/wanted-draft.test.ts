import { aTaxonomy, TAXONOMY_ID } from "./test-support/taxonomy";
import {
  MAX_CONTRIBUTION_SEN,
  MAX_DURATION_DAYS,
  MIN_DURATION_DAYS,
  MIN_CONTRIBUTION_SEN,
  emptyDraft,
  toCommunityInput,
  toDraftInput,
  validateDraft,
  type WantedDraftValues,
} from "./wanted-draft";
import type { MarketplaceTaxonomy } from "@/contracts/marketplace";

function taxonomy(): MarketplaceTaxonomy {
  return aTaxonomy();
}

function aDraft(overrides: Partial<WantedDraftValues> = {}): WantedDraftValues {
  return {
    ...emptyDraft(),
    title: "Final exam notes for the whole syllabus",
    campusId: TAXONOMY_ID.campus,
    facultyId: TAXONOMY_ID.faculty,
    programmeId: TAXONOMY_ID.programme,
    courseId: TAXONOMY_ID.course,
    sessionId: TAXONOMY_ID.session,
    resourceTypeId: TAXONOMY_ID.resourceType,
    languageId: TAXONOMY_ID.language,
    tagIds: [TAXONOMY_ID.tag],
    description:
      "Looking for complete notes covering every chapter, with the key diagrams and worked examples.",
    durationDays: "14",
    contribution: "10",
    policyAccepted: true,
    ...overrides,
  };
}

function errorFor(values: Partial<WantedDraftValues>, fieldId: string): string | undefined {
  const result = validateDraft(aDraft(values), taxonomy());

  return result.errors.find((error) => error.fieldId === fieldId)?.message;
}

describe("a complete draft", () => {
  test("is accepted", () => {
    const result = validateDraft(aDraft(), taxonomy());

    expect(result.errors).toEqual([]);
    expect(result.draft).not.toBeNull();
  });

  test("converts the contribution to integer sen at the edge", () => {
    const result = validateDraft(aDraft({ contribution: "10" }), taxonomy());

    expect(result.draft?.contributionSen).toBe(1000);
  });

  test("keeps sen precision without floating-point arithmetic", () => {
    expect(
      validateDraft(aDraft({ contribution: "10.50" }), taxonomy()).draft?.contributionSen,
    ).toBe(1050);
    expect(validateDraft(aDraft({ contribution: "0.05" }), taxonomy()).errors.length).toBe(1);
    expect(validateDraft(aDraft({ contribution: "1.07" }), taxonomy()).draft?.contributionSen).toBe(
      107,
    );
  });

  test("carries the duration as a number the backend will snapshot", () => {
    expect(validateDraft(aDraft({ durationDays: "30" }), taxonomy()).draft?.durationDays).toBe(30);
  });

  test("trims the title and description rather than storing padding", () => {
    const result = validateDraft(
      aDraft({ title: "   Past year answers   ", description: "  " + "A".repeat(40) + "  " }),
      taxonomy(),
    );

    expect(result.draft?.title).toBe("Past year answers");
    expect(result.draft?.description.startsWith("A")).toBe(true);
  });

  test("resolves the chosen course to its code and name for the review step", () => {
    const result = validateDraft(aDraft(), taxonomy());

    expect(result.draft?.course.code).toBe("CSC510");
    expect(result.draft?.course.label).toBe("Database Systems");
  });
});

describe("required fields", () => {
  test.each([
    ["title", { title: "" }, "wanted-title"],
    ["campus", { campusId: "" }, "wanted-campus"],
    ["faculty", { facultyId: "" }, "wanted-faculty"],
    ["programme", { programmeId: "" }, "wanted-programme"],
    ["course", { courseId: "" }, "wanted-course"],
    ["resource type", { resourceTypeId: "" }, "wanted-resource-type"],
    ["language", { languageId: "" }, "wanted-language"],
    ["description", { description: "" }, "wanted-description"],
    ["duration", { durationDays: "" }, "wanted-duration"],
    ["contribution", { contribution: "" }, "wanted-contribution"],
  ])("refuses a draft with no %s", (_name, values, fieldId) => {
    expect(errorFor(values as Partial<WantedDraftValues>, fieldId)).toBeDefined();
  });

  test("accepts a draft with no session, as covering any session", () => {
    const result = validateDraft(aDraft({ sessionId: "" }), taxonomy());

    expect(result.errors).toEqual([]);
    expect(result.draft?.session).toBeNull();
    expect(toDraftInput(result.draft!).academicSessionId).toBeNull();
  });

  test("refuses a session that is not in the list", () => {
    expect(errorFor({ sessionId: "not-a-session" }, "wanted-session")).toBeDefined();
  });

  test("lets a missing item carry a bounty and validates its first contribution", () => {
    const base = {
      kind: "missing_item" as const,
      title: "Lost blue water bottle",
      description: "Left it in the library study room on level 2 on Monday afternoon.",
    };
    const paid = validateDraft(aDraft({ ...base, free: false, contribution: "15" }), taxonomy());
    expect(paid.community?.contributionSen).toBe(1500);
    expect(toCommunityInput(paid.community!)).toMatchObject({
      free: false,
      initialContributionSen: 1500,
    });

    const free = validateDraft(aDraft({ ...base, free: true }), taxonomy());
    expect(toCommunityInput(free.community!)).toMatchObject({ free: true });
    expect(toCommunityInput(free.community!)).not.toHaveProperty("initialContributionSen");

    expect(
      validateDraft(aDraft({ ...base, free: false, contribution: "80" }), taxonomy()).errors.map(
        (error) => error.fieldId,
      ),
    ).toContain("wanted-contribution");
  });

  test("refuses a draft whose content policy was not accepted", () => {
    expect(errorFor({ policyAccepted: false }, "wanted-policy")).toMatch(/terms/i);
  });

  test("reports every failure at once rather than one at a time", () => {
    const result = validateDraft(emptyDraft(), taxonomy());

    expect(result.errors.length).toBeGreaterThan(8);
    expect(result.draft).toBeNull();
  });

  test("orders the failures the way the fields are read", () => {
    const result = validateDraft(emptyDraft(), taxonomy());

    expect(result.errors[0]?.fieldId).toBe("wanted-title");
    expect(result.errors[result.errors.length - 1]?.fieldId).toBe("wanted-policy");
  });
});

describe("the title and description", () => {
  test("refuses a title too short to describe a resource", () => {
    expect(errorFor({ title: "notes" }, "wanted-title")).toMatch(/at least/i);
  });

  test("refuses a title longer than the Board can show", () => {
    expect(errorFor({ title: "A".repeat(121) }, "wanted-title")).toMatch(/120 characters/);
  });

  test("refuses a description too short to brief a Hunter", () => {
    expect(errorFor({ description: "Need notes" }, "wanted-description")).toMatch(/at least/i);
  });

  test("refuses a description longer than the limit", () => {
    expect(errorFor({ description: "A".repeat(2001) }, "wanted-description")).toMatch(
      /2,000 characters/,
    );
  });
});

describe("the academic hierarchy", () => {
  test("refuses a programme that does not belong to the chosen faculty", () => {
    expect(
      errorFor(
        { facultyId: TAXONOMY_ID.otherFaculty, programmeId: TAXONOMY_ID.programme },
        "wanted-programme",
      ),
    ).toMatch(/chosen faculty/i);
  });

  test("refuses a course that does not belong to the chosen programme", () => {
    expect(
      errorFor(
        { programmeId: TAXONOMY_ID.programme, courseId: TAXONOMY_ID.otherCourse },
        "wanted-course",
      ),
    ).toMatch(/chosen programme/i);
  });

  test("refuses an option that is not in the taxonomy at all", () => {
    const absent = "00000000-0000-4000-8000-000000000000";

    expect(errorFor({ campusId: absent }, "wanted-campus")).toBeDefined();
    expect(errorFor({ resourceTypeId: absent }, "wanted-resource-type")).toBeDefined();
    expect(errorFor({ languageId: absent }, "wanted-language")).toBeDefined();
  });

  test("refuses a tag that is not in the controlled vocabulary", () => {
    expect(
      errorFor({ tagIds: ["00000000-0000-4000-8000-000000000000"] }, "wanted-tags"),
    ).toBeDefined();
  });

  test("accepts a draft with no tags, because tags are optional", () => {
    expect(validateDraft(aDraft({ tagIds: [] }), taxonomy()).errors).toEqual([]);
  });

  test("refuses more tags than a card can show", () => {
    const tooMany = taxonomy()
      .tags.slice(0, 6)
      .map((tag) => tag.id);

    expect(errorFor({ tagIds: tooMany }, "wanted-tags")).toMatch(/5 tags/);
  });
});

describe("the duration", () => {
  test("accepts any whole number of days from 3 to 30", () => {
    expect([MIN_DURATION_DAYS, MAX_DURATION_DAYS]).toEqual([3, 30]);

    for (const days of [3, 7, 21, 30]) {
      expect(validateDraft(aDraft({ durationDays: String(days) }), taxonomy()).errors).toEqual([]);
    }
  });

  test("refuses a duration outside the range or not a whole day", () => {
    expect(errorFor({ durationDays: "2" }, "wanted-duration")).toBeDefined();
    expect(errorFor({ durationDays: "31" }, "wanted-duration")).toBeDefined();
    expect(errorFor({ durationDays: "7.5" }, "wanted-duration")).toBeDefined();
  });
});

describe("the first contribution", () => {
  test("holds the approved range in sen", () => {
    expect(MIN_CONTRIBUTION_SEN).toBe(100);
    expect(MAX_CONTRIBUTION_SEN).toBe(5000);
  });

  test("accepts both ends of the range", () => {
    expect(validateDraft(aDraft({ contribution: "1" }), taxonomy()).draft?.contributionSen).toBe(
      100,
    );
    expect(validateDraft(aDraft({ contribution: "50" }), taxonomy()).draft?.contributionSen).toBe(
      5000,
    );
  });

  test("refuses less than the minimum", () => {
    expect(errorFor({ contribution: "0.99" }, "wanted-contribution")).toMatch(/RM1 and RM50/);
  });

  test("refuses more than the maximum", () => {
    expect(errorFor({ contribution: "50.01" }, "wanted-contribution")).toMatch(/RM1 and RM50/);
    expect(errorFor({ contribution: "500" }, "wanted-contribution")).toBeDefined();
  });

  test("refuses an amount that is not a number", () => {
    expect(errorFor({ contribution: "ten" }, "wanted-contribution")).toMatch(/amount/i);
  });

  test("refuses fractions of a sen rather than rounding someone's money", () => {
    expect(errorFor({ contribution: "10.005" }, "wanted-contribution")).toMatch(/sen/i);
  });

  test("refuses a negative amount", () => {
    expect(errorFor({ contribution: "-5" }, "wanted-contribution")).toBeDefined();
  });
});

describe("the body sent to the draft operation", () => {
  test("carries exactly the fields the published contract accepts", () => {
    const draft = validateDraft(aDraft(), taxonomy()).draft!;

    expect(toDraftInput(draft)).toEqual({
      campusId: TAXONOMY_ID.campus,
      facultyId: TAXONOMY_ID.faculty,
      programmeId: TAXONOMY_ID.programme,
      courseId: TAXONOMY_ID.course,
      academicSessionId: TAXONOMY_ID.session,
      resourceTypeId: TAXONOMY_ID.resourceType,
      languageId: TAXONOMY_ID.language,
      tagIds: [TAXONOMY_ID.tag],
      title: "Final exam notes for the whole syllabus",
      description:
        "Looking for complete notes covering every chapter, with the key diagrams and worked examples.",
      durationDays: 14,
      policyAccepted: true,
    });
  });

  test("sends no money, because a draft holds none", () => {
    const draft = validateDraft(aDraft(), taxonomy()).draft!;

    expect(toDraftInput(draft)).not.toHaveProperty("contributionSen");
    expect(toDraftInput(draft)).not.toHaveProperty("initialContributionSen");
  });

  test("sends no identity the server derives from the session", () => {
    const body: Record<string, unknown> = toDraftInput(
      validateDraft(aDraft(), taxonomy()).draft!,
    ) as unknown as Record<string, unknown>;

    expect(body).not.toHaveProperty("commissionerUserId");
    expect(body).not.toHaveProperty("institutionId");
  });

  test("sends the identifiers, never the labels a browser could have edited", () => {
    const body = toDraftInput(validateDraft(aDraft(), taxonomy()).draft!);

    expect(JSON.stringify(body)).not.toMatch(/Faculty of Computing|Database Systems|CSC510/);
  });
});

describe("a free request", () => {
  test("needs no contribution and carries none", () => {
    const result = validateDraft(aDraft({ free: true, contribution: "" }), taxonomy());

    expect(result.errors).toEqual([]);
    expect(result.draft?.contributionSen).toBeNull();
  });
});

describe("the campus region", () => {
  test("refuses a campus whose region is not open yet", () => {
    expect(errorFor({ campusId: TAXONOMY_ID.otherCampus }, "wanted-campus")).toMatch(
      /not open for new requests/i,
    );
  });
});

describe("missing-item and discussion requests", () => {
  const community = (overrides: Partial<WantedDraftValues> = {}) =>
    validateDraft(
      aDraft({
        kind: "missing_item",
        free: true,
        title: "Lost blue water bottle",
        description: "Left it in the library study room on level 2 on Monday afternoon.",
        lastSeenLocation: "Library level 2",
        facultyId: "",
        programmeId: "",
        courseId: "",
        sessionId: "",
        resourceTypeId: "",
        languageId: "",
        tagIds: [],
        contribution: "",
        ...overrides,
      }),
      taxonomy(),
    );

  test("need only a title, description, campus, duration and the terms", () => {
    const result = community();

    expect(result.errors).toEqual([]);
    expect(result.draft).toBeNull();
    expect(result.community).toMatchObject({
      kind: "missing_item",
      lastSeenLocation: "Library level 2",
    });
  });

  test("send no location with a discussion", () => {
    const result = community({ kind: "discussion" });

    expect(result.community?.lastSeenLocation).toBeNull();
    expect(toCommunityInput(result.community!)).not.toHaveProperty("lastSeenLocation");
  });

  test("still require the terms", () => {
    expect(community({ policyAccepted: false }).errors.map((e) => e.fieldId)).toContain(
      "wanted-policy",
    );
  });
});
