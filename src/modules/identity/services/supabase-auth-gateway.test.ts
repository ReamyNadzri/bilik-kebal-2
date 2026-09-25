import { describe, expect, test, vi } from "vitest";

import { SupabaseAuthGateway, type SupabaseAuthClient } from "./supabase-auth-gateway";

function createClient(): SupabaseAuthClient {
  return {
    resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
    verifyOtp: vi.fn().mockResolvedValue({ error: null }),
    resend: vi.fn().mockResolvedValue({ error: null }),
    signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    signUp: vi.fn().mockResolvedValue({ error: null }),
    updateUser: vi.fn().mockResolvedValue({ error: null }),
  };
}

describe("SupabaseAuthGateway", () => {
  test("passes registration metadata and redirect to Supabase Auth", async () => {
    const client = createClient();
    const gateway = new SupabaseAuthGateway(client);

    await expect(
      gateway.register({
        displayName: "Aina",
        email: "aina@example.com",
        emailRedirectTo: "https://vaultix.example/auth/callback",
        password: "SecurePass123",
      }),
    ).resolves.toEqual({ ok: true, signedIn: false });

    expect(client.signUp).toHaveBeenCalledWith({
      email: "aina@example.com",
      options: {
        data: { display_name: "Aina" },
        emailRedirectTo: "https://vaultix.example/auth/callback",
      },
      password: "SecurePass123",
    });
  });

  test("reports a signed-in account when Supabase skips email confirmation", async () => {
    const client = createClient();
    vi.mocked(client.signUp).mockResolvedValue({ data: { session: {} }, error: null });
    const gateway = new SupabaseAuthGateway(client);

    await expect(
      gateway.register({
        displayName: "Aina",
        email: "aina@example.com",
        emailRedirectTo: "https://vaultix.example/auth/callback",
        password: "SecurePass123",
      }),
    ).resolves.toEqual({ ok: true, signedIn: true });
  });

  test("maps provider codes without returning raw provider messages", async () => {
    const client = createClient();
    vi.mocked(client.signInWithPassword).mockResolvedValue({
      error: {
        code: "email_not_confirmed",
        message: "raw provider detail",
        status: 400,
      },
    });

    await expect(
      new SupabaseAuthGateway(client).signIn({
        email: "aina@example.com",
        password: "SecurePass123",
      }),
    ).resolves.toEqual({ ok: false, reason: "email_not_verified" });
  });

  test("treats provider rate limits as retryable", async () => {
    const client = createClient();
    vi.mocked(client.resetPasswordForEmail).mockResolvedValue({
      error: {
        code: "over_email_send_rate_limit",
        message: "raw provider detail",
        status: 429,
      },
    });

    await expect(
      new SupabaseAuthGateway(client).sendPasswordRecovery({
        email: "aina@example.com",
        redirectTo: "https://vaultix.example/reset-password",
      }),
    ).resolves.toEqual({ ok: false, reason: "rate_limited" });
  });

  test("uses Supabase signup resend without exposing provider output", async () => {
    const client = createClient();
    const gateway = new SupabaseAuthGateway(client);

    await expect(
      gateway.resendVerification({
        email: "aina@example.com",
        emailRedirectTo: "https://vaultix.example/auth/callback",
      }),
    ).resolves.toEqual({ ok: true });
    expect(client.resend).toHaveBeenCalledWith({
      email: "aina@example.com",
      options: { emailRedirectTo: "https://vaultix.example/auth/callback" },
      type: "signup",
    });
  });

  test("updates a password only through the authenticated Supabase user session", async () => {
    const client = createClient();

    await expect(
      new SupabaseAuthGateway(client).updatePassword({ password: "NewSecurePass123" }),
    ).resolves.toEqual({ ok: true });
    expect(client.updateUser).toHaveBeenCalledWith({ password: "NewSecurePass123" });
  });

  test("maps an expired auth session to a safe recovery-link failure", async () => {
    const client = createClient();
    vi.mocked(client.updateUser).mockResolvedValue({
      error: { code: "session_not_found", message: "raw session token", status: 400 },
    });

    await expect(
      new SupabaseAuthGateway(client).updatePassword({ password: "NewSecurePass123" }),
    ).resolves.toEqual({ ok: false, reason: "recovery_invalid" });
  });

  test("delegates OTP verification to Supabase recovery type", async () => {
    const client = createClient();

    await expect(
      new SupabaseAuthGateway(client).verifyRecoveryOtp({
        email: "aina@example.com",
        token: "123456",
      }),
    ).resolves.toEqual({ ok: true });
    expect(client.verifyOtp).toHaveBeenCalledWith({
      email: "aina@example.com",
      token: "123456",
      type: "recovery",
    });
  });
});
