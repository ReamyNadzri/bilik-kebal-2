import {
  maskEmail,
  planImport,
  summarise,
  toClerkCreateUserBody,
  type SupabaseAuthExportRow,
} from "./clerk-user-import";

const HASH = "$2a$10$" + "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0".slice(0, 53);

function row(overrides: Partial<SupabaseAuthExportRow> = {}): SupabaseAuthExportRow {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    email: "Aina@Student.UiTM.edu.my",
    encrypted_password: HASH,
    email_confirmed_at: "2026-09-01T00:00:00Z",
    display_name: "Aina",
    created_at: "2026-08-01T08:00:00Z",
    ...overrides,
  };
}

const none = { externalIds: new Set<string>(), emails: new Set<string>() };

describe("toClerkCreateUserBody", () => {
  test("keeps the bcrypt password, links by external id and keeps the join date", () => {
    expect(toClerkCreateUserBody(row())).toEqual({
      external_id: "00000000-0000-4000-8000-000000000001",
      email_address: ["aina@student.uitm.edu.my"],
      first_name: "Aina",
      password_digest: HASH,
      password_hasher: "bcrypt",
      skip_password_checks: true,
      created_at: "2026-08-01T08:00:00.000Z",
    });
  });

  test("creates a password-less account when there is no usable hash", () => {
    const body = toClerkCreateUserBody(row({ encrypted_password: "", display_name: " " }));
    expect(body).not.toHaveProperty("password_digest");
    expect(body).not.toHaveProperty("first_name");
    expect(body.skip_password_requirement).toBe(true);
  });
});

describe("planImport", () => {
  test("creates a verified account with a password", () => {
    const [decision] = planImport([row()], none, { includeUnverified: false });
    expect(decision).toMatchObject({ kind: "create", id: row().id });
  });

  test("never imports twice", () => {
    const existing = { externalIds: new Set([row().id]), emails: new Set<string>() };
    expect(planImport([row()], existing, { includeUnverified: false })).toEqual([
      { kind: "skip", id: row().id, reason: "already_imported" },
    ]);
  });

  test("does not hand an account to whoever already holds its address in Clerk", () => {
    const existing = {
      externalIds: new Set<string>(),
      emails: new Set(["aina@student.uitm.edu.my"]),
    };
    expect(planImport([row()], existing, { includeUnverified: false })[0]).toMatchObject({
      reason: "email_taken",
    });
  });

  test("skips an unverified address unless the Owner opts in", () => {
    const unverified = row({ email_confirmed_at: null });
    expect(planImport([unverified], none, { includeUnverified: false })[0]).toMatchObject({
      reason: "unverified_email",
    });
    expect(planImport([unverified], none, { includeUnverified: true })[0]).toMatchObject({
      kind: "create",
    });
  });

  test("skips rows without an email, with a malformed id, or repeating an address", () => {
    const decisions = planImport(
      [
        row({ email: null }),
        row({ id: "not-a-uuid" }),
        row({ id: "00000000-0000-4000-8000-000000000002" }),
        row({ id: "00000000-0000-4000-8000-000000000003", email: "AINA@student.uitm.edu.my" }),
      ],
      none,
      { includeUnverified: false },
    );
    expect(summarise(decisions)).toEqual({
      create: 1,
      "skip:no_email": 1,
      "skip:invalid_id": 1,
      "skip:duplicate_email": 1,
    });
  });
});

test("masks an address for reports", () => {
  expect(maskEmail("aina@student.uitm.edu.my")).toBe("ai***@student.uitm.edu.my");
  expect(maskEmail(null)).toBe("(none)");
});
