import { describe, expect, test, vi } from "vitest";

import { executeJsonOperation, safeNextPath, withTrustedFields } from "./auth-http";

describe("executeJsonOperation", () => {
  test("returns a stable validation response for malformed JSON", async () => {
    const operation = vi.fn();
    const request = new Request("https://vaultix.example/api/auth/sign-in", {
      body: "{",
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    const response = await executeJsonOperation(request, operation);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Request body must be valid JSON.",
    });
    expect(operation).not.toHaveBeenCalled();
  });

  test("maps operation failures to an appropriate HTTP status", async () => {
    const response = await executeJsonOperation(
      new Request("https://vaultix.example/api/auth/sign-in", {
        body: "{}",
        method: "POST",
      }),
      vi.fn().mockResolvedValue({
        ok: false,
        code: "INVALID_CREDENTIALS",
        message: "Email or password is incorrect.",
      }),
    );

    expect(response.status).toBe(401);
  });

  test("supports an explicit success status", async () => {
    const response = await executeJsonOperation(
      new Request("https://vaultix.example/api/auth/sign-up", {
        body: "{}",
        method: "POST",
      }),
      vi.fn().mockResolvedValue({ ok: true, data: { next: "verify_email" } }),
      202,
    );

    expect(response.status).toBe(202);
  });
});

describe("safeNextPath", () => {
  test("rejects external and protocol-relative redirects", () => {
    expect(safeNextPath("https://attacker.example", "/profile")).toBe("/profile");
    expect(safeNextPath("//attacker.example", "/profile")).toBe("/profile");
  });

  test("accepts an application-relative path", () => {
    expect(safeNextPath("/profile?email=verified", "/profile")).toBe("/profile?email=verified");
  });
});

test("trusted request context overrides identity fields supplied by the browser", () => {
  expect(
    withTrustedFields(
      { institutionId: "institution-1", userId: "attacker-selected-user" },
      { emailVerified: true, userId: "authenticated-user" },
    ),
  ).toEqual({
    emailVerified: true,
    institutionId: "institution-1",
    userId: "authenticated-user",
  });
});
