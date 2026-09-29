import { describe, expect, it, vi } from "vitest";

import {
  handleClerkWebhook,
  toClerkUserSyncInput,
  type ClerkUserPayload,
  type ClerkUserSyncInput,
} from "./clerk-user-sync";

function clerkUser(overrides: Partial<ClerkUserPayload> = {}): ClerkUserPayload {
  return {
    id: "user_2Hunter",
    external_id: null,
    primary_email_address_id: "idn_primary",
    email_addresses: [
      { id: "idn_other", email_address: "other@x.test", verification: { status: "verified" } },
      {
        id: "idn_primary",
        email_address: "hunter@student.uitm.edu.my",
        verification: { status: "verified" },
      },
    ],
    first_name: "Aina",
    last_name: "Rahman",
    username: null,
    updated_at: Date.UTC(2026, 8, 29, 12),
    ...overrides,
  };
}

describe("toClerkUserSyncInput", () => {
  it("reads the primary email, its verification and the full name", () => {
    expect(toClerkUserSyncInput(clerkUser())).toEqual({
      clerkUserId: "user_2Hunter",
      externalId: null,
      email: "hunter@student.uitm.edu.my",
      emailVerified: true,
      displayName: "Aina Rahman",
      clerkUpdatedAt: new Date(Date.UTC(2026, 8, 29, 12)),
    });
  });

  it("treats an unverified or missing primary email as unverified", () => {
    const unverified = clerkUser({
      email_addresses: [
        {
          id: "idn_primary",
          email_address: "hunter@x.test",
          verification: { status: "unverified" },
        },
      ],
    });
    expect(toClerkUserSyncInput(unverified).emailVerified).toBe(false);

    const noPrimary = toClerkUserSyncInput(clerkUser({ primary_email_address_id: null }));
    expect(noPrimary).toMatchObject({ email: null, emailVerified: false });

    const noVerification = clerkUser({
      email_addresses: [{ id: "idn_primary", email_address: "a@x.test", verification: null }],
    });
    expect(toClerkUserSyncInput(noVerification).emailVerified).toBe(false);
  });

  it("falls back to the username, then to no name", () => {
    expect(
      toClerkUserSyncInput(clerkUser({ first_name: " ", last_name: null, username: "aina" }))
        .displayName,
    ).toBe("aina");
    expect(
      toClerkUserSyncInput(clerkUser({ first_name: null, last_name: null, username: null }))
        .displayName,
    ).toBeNull();
  });

  it("passes the import link through", () => {
    const linked = clerkUser({ external_id: "00000000-0000-0000-0000-0000000000d1" });
    expect(toClerkUserSyncInput(linked).externalId).toBe("00000000-0000-0000-0000-0000000000d1");
  });
});

describe("handleClerkWebhook", () => {
  it.each(["user.created", "user.updated"] as const)("syncs %s", async (type) => {
    const syncUser = vi.fn<(input: ClerkUserSyncInput) => Promise<void>>().mockResolvedValue();
    await expect(handleClerkWebhook({ type, data: clerkUser() }, { syncUser })).resolves.toBe(
      "synced",
    );
    expect(syncUser).toHaveBeenCalledWith(expect.objectContaining({ clerkUserId: "user_2Hunter" }));
  });

  it.each(["user.deleted", "session.created", "organization.created"])(
    "acknowledges %s without syncing",
    async (type) => {
      const syncUser = vi.fn();
      await expect(handleClerkWebhook({ type, data: {} }, { syncUser })).resolves.toBe("ignored");
      expect(syncUser).not.toHaveBeenCalled();
    },
  );

  it("lets a repository failure propagate so the delivery is retried", async () => {
    const syncUser = vi.fn().mockRejectedValue(new Error("database unavailable"));
    await expect(
      handleClerkWebhook({ type: "user.created", data: clerkUser() }, { syncUser }),
    ).rejects.toThrow("database unavailable");
  });
});
