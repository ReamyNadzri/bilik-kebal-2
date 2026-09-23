import { describe, expect, test, vi } from "vitest";

import { AuthService, type AuthGateway } from "./auth-service";

function createGateway(): AuthGateway {
  return {
    register: vi.fn().mockResolvedValue({ ok: true }),
    signIn: vi.fn().mockResolvedValue({ ok: true }),
    sendPasswordRecovery: vi.fn().mockResolvedValue({ ok: true }),
    resendVerification: vi.fn().mockResolvedValue({ ok: true }),
    updatePassword: vi.fn().mockResolvedValue({ ok: true }),
    signOut: vi.fn().mockResolvedValue({ ok: true }),
  };
}

describe("AuthService", () => {
  test("rejects invalid registration input before calling the provider", async () => {
    const gateway = createGateway();
    const service = new AuthService(gateway, "https://vaultix.example");

    const result = await service.register({
      displayName: "",
      email: "not-an-email",
      password: "weak",
    });

    expect(result).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
    expect(gateway.register).not.toHaveBeenCalled();
  });

  test("registers with normalized identity data and requires email verification", async () => {
    const gateway = createGateway();
    const service = new AuthService(gateway, "https://vaultix.example/");

    const result = await service.register({
      displayName: "  Nur Aina  ",
      email: "  AINA@EXAMPLE.COM ",
      password: "SecurePass123",
    });

    expect(gateway.register).toHaveBeenCalledWith({
      displayName: "Nur Aina",
      email: "aina@example.com",
      emailRedirectTo: "https://vaultix.example/auth/callback?next=%2Fprofile",
      password: "SecurePass123",
    });
    expect(result).toEqual({
      ok: true,
      data: { next: "verify_email" },
    });
  });

  test("maps an unverified sign-in to a stable browser-safe code", async () => {
    const gateway = createGateway();
    vi.mocked(gateway.signIn).mockResolvedValue({
      ok: false,
      reason: "email_not_verified",
    });

    const result = await new AuthService(gateway, "https://vaultix.example").signIn({
      email: "aina@example.com",
      password: "SecurePass123",
    });

    expect(result).toEqual({
      ok: false,
      code: "EMAIL_NOT_VERIFIED",
      message: "Verify your email before signing in.",
    });
  });

  test("does not reveal whether a recovery email belongs to an account", async () => {
    const gateway = createGateway();
    vi.mocked(gateway.sendPasswordRecovery).mockResolvedValue({
      ok: false,
      reason: "identity_not_found",
    });

    const result = await new AuthService(gateway, "https://vaultix.example").recoverPassword({
      email: "unknown@example.com",
    });

    expect(result).toEqual({
      ok: true,
      data: { accepted: true },
    });
  });

  test("routes the recovery email through the server callback with an explicit recovery intent", async () => {
    const gateway = createGateway();
    const service = new AuthService(gateway, "https://vaultix.example");

    await service.recoverPassword({ email: "aina@example.com" });

    expect(gateway.sendPasswordRecovery).toHaveBeenCalledWith({
      email: "aina@example.com",
      redirectTo: "https://vaultix.example/auth/callback?next=%2Freset-password&flow=recovery",
    });
  });

  test("updates the password only after validating the recovery-session request", async () => {
    const gateway = {
      ...createGateway(),
      updatePassword: vi.fn().mockResolvedValue({ ok: true }),
    } as unknown as AuthGateway;

    const result = await new AuthService(gateway, "https://vaultix.example").updatePassword({
      password: "NewSecurePass123",
    });

    expect(gateway.updatePassword).toHaveBeenCalledWith({ password: "NewSecurePass123" });
    expect(result).toEqual({ ok: true, data: { updated: true } });
  });

  test("rejects a weak replacement password without calling Supabase", async () => {
    const gateway = {
      ...createGateway(),
      updatePassword: vi.fn().mockResolvedValue({ ok: true }),
    } as unknown as AuthGateway;

    const result = await new AuthService(gateway, "https://vaultix.example").updatePassword({
      password: "weak",
    });

    expect(result).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
    expect(gateway.updatePassword).not.toHaveBeenCalled();
  });

  test("returns a retryable code when the auth provider is unavailable", async () => {
    const gateway = createGateway();
    vi.mocked(gateway.signIn).mockResolvedValue({ ok: false, reason: "unavailable" });

    const result = await new AuthService(gateway, "https://vaultix.example").signIn({
      email: "aina@example.com",
      password: "SecurePass123",
    });

    expect(result).toEqual({
      ok: false,
      code: "AUTH_UNAVAILABLE",
      message: "Authentication is temporarily unavailable. Try again.",
    });
  });

  test("resends confirmation to the server-resolved pending address", async () => {
    const gateway = createGateway();
    const service = new AuthService(gateway, "https://vaultix.example");

    const result = await service.resendVerification("AINA@example.com");

    expect(gateway.resendVerification).toHaveBeenCalledWith({
      email: "aina@example.com",
      emailRedirectTo: "https://vaultix.example/auth/callback",
    });
    expect(result).toEqual({ ok: true, data: { accepted: true } });
  });
});
