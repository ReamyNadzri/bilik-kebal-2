import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database";

const snapshot = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/lib/supabase/server", () => ({
  currentAccountSnapshot: (userId: string) =>
    (snapshot.current as { user_id: string } | null)?.user_id === userId ? snapshot.current : null,
}));

import { SupabaseIdentityReadRepository } from "./supabase-identity-read-repository";

const user = {
  id: "00000000-0000-4000-8000-0000000000c1",
  email: "hunter@student.uitm.edu.my",
  email_confirmed_at: "2026-09-29T12:00:00.000Z",
  created_at: "2026-09-01T00:00:00.000Z",
};

const from = vi.fn();
const client = { from, storage: { from: vi.fn() } } as unknown as SupabaseClient<Database>;

beforeEach(() => {
  from.mockReset();
  snapshot.current = null;
});

test("builds the account from this request's snapshot without querying again", async () => {
  snapshot.current = {
    user_id: user.id,
    public_id: "11111111-1111-4111-8111-111111111111",
    email: user.email,
    email_verified_at: user.email_confirmed_at,
    created_at: user.created_at,
    display_name: "Aina",
    avatar_object_key: null,
    avatar_preset: null,
    external_avatar_url: "https://img.clerk.com/photo",
    membership: {
      institution_id: "22222222-2222-4222-8222-222222222222",
      verification_state: "verified",
      institution_name: "UiTM",
    },
    restriction: { id: "r1", expires_at: "2026-10-01T00:00:00.000Z" },
    latest_request: {
      id: "q1",
      state: "approved",
      created_at: "2026-09-02T00:00:00.000Z",
      reviewed_at: "2026-09-03T00:00:00.000Z",
      decision_reason_code: null,
      evidence_delete_after: "2026-10-03T00:00:00.000Z",
    },
    has_console_access: true,
  };

  const record = await new SupabaseIdentityReadRepository(client).readAccount(user);

  expect(from).not.toHaveBeenCalled();
  expect(record).toEqual({
    displayName: "Aina",
    publicId: "11111111-1111-4111-8111-111111111111",
    avatarUrl: "https://img.clerk.com/photo",
    avatarPreset: null,
    email: user.email,
    joinedAt: user.created_at,
    emailConfirmedAt: user.email_confirmed_at,
    hasActiveRestriction: true,
    restrictionExpiresAt: "2026-10-01T00:00:00.000Z",
    hasConsoleAccess: true,
    institution: { id: "22222222-2222-4222-8222-222222222222", name: "UiTM" },
    institutionVerificationState: "verified",
    latestVerificationRequest: {
      decidedAt: "2026-09-03T00:00:00.000Z",
      evidenceDeleteAfter: "2026-10-03T00:00:00.000Z",
      reasonCode: null,
      requestId: "q1",
      state: "approved",
      submittedAt: "2026-09-02T00:00:00.000Z",
    },
  });
});

test("reads a pending request as the trust state when there is no membership", async () => {
  snapshot.current = {
    user_id: user.id,
    public_id: "p",
    display_name: "Aina",
    created_at: user.created_at,
    avatar_object_key: null,
    avatar_preset: null,
    external_avatar_url: null,
    membership: null,
    restriction: null,
    latest_request: {
      id: "q1",
      state: "pending",
      created_at: "2026-09-02T00:00:00.000Z",
      reviewed_at: null,
      decision_reason_code: null,
      evidence_delete_after: "2026-10-03T00:00:00.000Z",
    },
    has_console_access: false,
  };

  const record = await new SupabaseIdentityReadRepository(client).readAccount(user);

  expect(record).toMatchObject({
    institution: null,
    institutionVerificationState: "pending",
    hasActiveRestriction: false,
    avatarUrl: null,
  });
});
