import { describe, expect, test, vi } from "vitest";

import { executeJsonOperation, safeNextPath, withTrustedFields } from "./auth-http";

describe("executeJsonOperation", () => {
  test("correlates and logs an auth result without serialising credentials", async () => {
    const output = vi.spyOn(console, "info").mockImplementation(() => undefined);
    try {
      const response = await executeJsonOperation(
        new Request("https://vaultix.example/api/auth/sign-in", {
          body: JSON.stringify({ email: "private@example.test", password: "private-password" }),
          headers: { "content-type": "application/json" },
          method: "POST",
        }),
        async () => ({
          ok: false,
          code: "INVALID_CREDENTIALS",
          message: "Email or password is incorrect.",
        }),
        200,
        undefined,
        "identity.sign_in",
      );

      const correlationId = response.headers.get("x-correlation-id");
      expect(correlationId).toBeTruthy();
      expect(correlationId ?? "").toMatch(/^[0-9a-f-]{36}$/);
      expect(response.status).toBe(401);
      expect(output).toHaveBeenCalledOnce();
      expect(JSON.parse(String(output.mock.calls[0]?.[0]))).toEqual({
        correlationId,
        operation: "identity.sign_in",
        status: 401,
        outcome: "refused",
        durationMs: expect.any(Number),
      });
      expect(String(output.mock.calls[0]?.[0])).not.toContain("private@example.test");
      expect(String(output.mock.calls[0]?.[0])).not.toContain("private-password");
    } finally {
      output.mockRestore();
    }
  });

  test("correlates malformed authentication JSON without executing the operation", async () => {
    const output = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const operation = vi.fn();
    try {
      const response = await executeJsonOperation(
        new Request("https://vaultix.example/api/auth/sign-in", {
          body: "{",
          headers: { "content-type": "application/json" },
          method: "POST",
        }),
        operation,
        200,
        undefined,
        "identity.sign_in",
      );

      const correlationId = response.headers.get("x-correlation-id");
      expect(correlationId).toBeTruthy();
      expect(correlationId ?? "").toMatch(/^[0-9a-f-]{36}$/);
      expect(response.status).toBe(400);
      expect(operation).not.toHaveBeenCalled();
      expect(JSON.parse(String(output.mock.calls[0]?.[0]))).toMatchObject({
        correlationId,
        operation: "identity.sign_in",
        status: 400,
        outcome: "refused",
      });
    } finally {
      output.mockRestore();
    }
  });

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

  test("runs a server-side result hook without changing the response contract", async () => {
    const onResult = vi.fn();
    const response = await executeJsonOperation(
      new Request("https://vaultix.example/api/auth/sign-up", {
        body: JSON.stringify({ email: "aina@example.com" }),
        method: "POST",
      }),
      vi.fn().mockResolvedValue({ ok: true, data: { next: "verify_email" } }),
      202,
      onResult,
    );

    expect(onResult).toHaveBeenCalledWith(
      { ok: true, data: { next: "verify_email" } },
      { email: "aina@example.com" },
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
