import { describe, expect, it } from "vitest";
import { claimSubmissionSchema } from "./claims";

const valid = {
  wantedId: "74000000-0000-4000-8000-000000000001",
  fileName: "week 4 notes.pdf",
  mimeType: "application/pdf",
  sizeBytes: 1024,
  sha256: "a".repeat(64),
  rightsConfirmed: true,
  freeReleaseOptIn: false,
};

describe("claim submission contract", () => {
  it("accepts supported quarantined file metadata", () => {
    expect(claimSubmissionSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects oversized, unsupported, and malformed checksum input", () => {
    expect(
      claimSubmissionSchema.safeParse({ ...valid, sizeBytes: 50 * 1024 * 1024 + 1 }).success,
    ).toBe(false);
    expect(claimSubmissionSchema.safeParse({ ...valid, mimeType: "application/zip" }).success).toBe(
      false,
    );
    expect(claimSubmissionSchema.safeParse({ ...valid, sha256: "not-a-checksum" }).success).toBe(
      false,
    );
  });

  it("requires the claimant to confirm sharing rights", () => {
    expect(claimSubmissionSchema.safeParse({ ...valid, rightsConfirmed: false }).success).toBe(
      false,
    );
  });
});
