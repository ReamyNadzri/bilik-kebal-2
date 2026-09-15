import { MARKETPLACE_MESSAGE, messageFor, toDraftFieldErrors } from "./marketplace-messages";
import type { MarketplaceOperationCode } from "@/contracts/marketplace";

const ALL_CODES: readonly MarketplaceOperationCode[] = [
  "AUTH_REQUIRED",
  "EMAIL_NOT_VERIFIED",
  "INSTITUTION_VERIFICATION_REQUIRED",
  "ACCOUNT_RESTRICTED",
  "NOT_AUTHORIZED",
  "VALIDATION_ERROR",
  "WANTED_NOT_FOUND",
  "DRAFT_NOT_FOUND",
  "DRAFT_NOT_EDITABLE",
  "DUPLICATE_CHECK_REQUIRED",
  "DUPLICATE_CHECK_EXPIRED",
  "PAYMENT_DISABLED",
  "PAYMENT_UNAVAILABLE",
  "AMOUNT_OUT_OF_RANGE",
  "MARKETPLACE_UNAVAILABLE",
];

describe("failure copy", () => {
  test("covers every documented marketplace code", () => {
    for (const code of ALL_CODES) {
      expect(MARKETPLACE_MESSAGE[code]).toEqual(expect.any(String));
      expect(MARKETPLACE_MESSAGE[code].length).toBeGreaterThan(0);
    }
  });

  test("never claims a payment succeeded when payment is refused", () => {
    for (const code of ["PAYMENT_DISABLED", "PAYMENT_UNAVAILABLE"] as const) {
      expect(MARKETPLACE_MESSAGE[code]).not.toMatch(/success|paid|published|open/i);
      expect(MARKETPLACE_MESSAGE[code]).toMatch(/not been (charged|taken)|no payment/i);
    }
  });

  test("prefers the message the operation that made the decision supplied", () => {
    expect(
      messageFor("DRAFT_NOT_EDITABLE", "This Wanted can no longer be edited as a draft."),
    ).toBe("This Wanted can no longer be edited as a draft.");
  });

  test("falls back to its own copy when the operation supplied none", () => {
    expect(messageFor("MARKETPLACE_UNAVAILABLE", "")).toBe(
      MARKETPLACE_MESSAGE.MARKETPLACE_UNAVAILABLE,
    );
    expect(messageFor("MARKETPLACE_UNAVAILABLE", undefined)).toBe(
      MARKETPLACE_MESSAGE.MARKETPLACE_UNAVAILABLE,
    );
  });
});

describe("server field errors", () => {
  test("links each draft field to the control the reader must fix", () => {
    expect(
      toDraftFieldErrors({
        title: ["Too short"],
        courseId: ["Invalid uuid"],
        policyAccepted: ["Invalid input"],
      }),
    ).toEqual([
      { fieldId: "wanted-title", message: "Too short" },
      { fieldId: "wanted-course", message: "Invalid uuid" },
      { fieldId: "wanted-policy", message: "Invalid input" },
    ]);
  });

  test("returns them in the order the form reads, not the order they arrived", () => {
    const ordered = toDraftFieldErrors({
      policyAccepted: ["Accept the policy"],
      title: ["Too short"],
    });

    expect(ordered.map((error) => error.fieldId)).toEqual(["wanted-title", "wanted-policy"]);
  });

  test("maps the academic session and resource type to their own controls", () => {
    expect(
      toDraftFieldErrors({
        academicSessionId: ["Invalid uuid"],
        resourceTypeId: ["Invalid uuid"],
        languageId: ["Invalid uuid"],
        tagIds: ["Too many"],
        durationDays: ["Invalid input"],
        description: ["Too short"],
        campusId: ["Invalid uuid"],
        facultyId: ["Invalid uuid"],
        programmeId: ["Invalid uuid"],
      }).map((error) => error.fieldId),
    ).toEqual([
      "wanted-description",
      "wanted-campus",
      "wanted-faculty",
      "wanted-programme",
      "wanted-session",
      "wanted-resource-type",
      "wanted-language",
      "wanted-tags",
      "wanted-duration",
    ]);
  });

  test("keeps a whole-selection failure it cannot attach to one control", () => {
    expect(
      toDraftFieldErrors({
        taxonomy: ["One or more selections are unavailable or do not belong together."],
      }),
    ).toEqual([
      {
        fieldId: undefined,
        message: "One or more selections are unavailable or do not belong together.",
      },
    ]);
  });

  test("keeps a key it does not recognise rather than hiding the reason", () => {
    expect(toDraftFieldErrors({ somethingNew: ["A rule the form does not know about"] })).toEqual([
      { fieldId: undefined, message: "A rule the form does not know about" },
    ]);
  });

  test("reports every message a field carries", () => {
    expect(toDraftFieldErrors({ title: ["Too short", "Not allowed"] })).toEqual([
      { fieldId: "wanted-title", message: "Too short" },
      { fieldId: "wanted-title", message: "Not allowed" },
    ]);
  });

  test("answers nothing when the failure carried no field errors", () => {
    expect(toDraftFieldErrors(undefined)).toEqual([]);
  });
});
