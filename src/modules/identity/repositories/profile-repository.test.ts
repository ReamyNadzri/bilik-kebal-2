import { describe, expect, test, vi } from "vitest";

import { ProfileRepository, type ProfileReader } from "./profile-repository";

describe("ProfileRepository", () => {
  test("returns null when the profile does not exist", async () => {
    const reader: ProfileReader = {
      findProfileByUserId: vi.fn().mockResolvedValue(null),
    };

    await expect(new ProfileRepository(reader).findByUserId("missing-user")).resolves.toBeNull();
  });

  test("maps separate email and institution verification states", async () => {
    const reader: ProfileReader = {
      findProfileByUserId: vi.fn().mockResolvedValue({
        userId: "user-1",
        displayName: "Aina",
        emailConfirmedAt: "2026-09-14T01:00:00.000Z",
        institutionVerificationState: "pending",
        hasActiveRestriction: false,
      }),
    };

    await expect(new ProfileRepository(reader).findByUserId("user-1")).resolves.toEqual({
      userId: "user-1",
      displayName: "Aina",
      trust: {
        email: "verified",
        institution: "pending",
        restricted: false,
      },
    });
  });

  test("defaults a missing institution membership to unverified", async () => {
    const reader: ProfileReader = {
      findProfileByUserId: vi.fn().mockResolvedValue({
        userId: "user-2",
        displayName: "Danial",
        emailConfirmedAt: null,
        institutionVerificationState: null,
        hasActiveRestriction: true,
      }),
    };

    await expect(new ProfileRepository(reader).findByUserId("user-2")).resolves.toEqual({
      userId: "user-2",
      displayName: "Danial",
      trust: {
        email: "unverified",
        institution: "unverified",
        restricted: true,
      },
    });
  });
});
