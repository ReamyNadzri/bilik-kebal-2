import {
  publicationInputSchema,
  wantedDraftInputSchema,
  type WantedDraftInput,
} from "./marketplace";

const IDS = {
  campusId: "10000000-0000-4000-8000-000000000001",
  facultyId: "10000000-0000-4000-8000-000000000002",
  programmeId: "10000000-0000-4000-8000-000000000003",
  courseId: "10000000-0000-4000-8000-000000000004",
  academicSessionId: "10000000-0000-4000-8000-000000000005",
  resourceTypeId: "10000000-0000-4000-8000-000000000006",
  languageId: "10000000-0000-4000-8000-000000000007",
} as const;

function validDraft(overrides: Partial<WantedDraftInput> = {}): WantedDraftInput {
  return {
    ...IDS,
    title: "Final exam notes for every chapter",
    description: "Complete revision notes with diagrams and worked examples.",
    tagIds: ["10000000-0000-4000-8000-000000000008"],
    durationDays: 7,
    policyAccepted: true,
    ...overrides,
  };
}

describe("Wanted draft input", () => {
  test("accepts a complete draft and trims authored text", () => {
    const result = wantedDraftInputSchema.parse(
      validDraft({ title: "  Final exam notes for every chapter  " }),
    );

    expect(result.title).toBe("Final exam notes for every chapter");
    expect(result.durationDays).toBe(7);
  });

  test.each([2, 0, 31])("rejects unsupported duration %s", (durationDays) => {
    expect(() => wantedDraftInputSchema.parse(validDraft({ durationDays } as never))).toThrow();
  });

  test("rejects a draft whose policy acknowledgement is absent", () => {
    expect(() =>
      wantedDraftInputSchema.parse({ ...validDraft(), policyAccepted: false }),
    ).toThrow();
  });

  test("rejects malformed taxonomy identifiers", () => {
    expect(() => wantedDraftInputSchema.parse(validDraft({ courseId: "csc510" }))).toThrow();
  });

  test("does not accept caller-selected authority fields", () => {
    const result = wantedDraftInputSchema.parse({
      ...validDraft(),
      commissionerId: "20000000-0000-4000-8000-000000000001",
      institutionId: "20000000-0000-4000-8000-000000000002",
    });

    expect(result).not.toHaveProperty("commissionerId");
    expect(result).not.toHaveProperty("institutionId");
  });
});

describe("publication input", () => {
  const input = {
    draftId: "30000000-0000-4000-8000-000000000001",
    duplicateCheckToken: "duplicate-check-token-with-enough-entropy",
    initialContributionSen: 1250,
  };

  test("accepts an integer-sen contribution", () => {
    expect(publicationInputSchema.parse(input).initialContributionSen).toBe(1250);
  });

  test.each([99, 5001, 100.5])("rejects invalid contribution %s sen", (amount) => {
    expect(() =>
      publicationInputSchema.parse({ ...input, initialContributionSen: amount }),
    ).toThrow();
  });
});
