import type { AuthGateway, AuthGatewayFailureReason, AuthGatewayResult } from "./auth-service";

interface SupabaseAuthErrorLike {
  code: string | undefined;
  message: string;
  status: number | undefined;
}

interface SupabaseAuthResponse {
  error: SupabaseAuthErrorLike | null;
}

export interface SupabaseAuthClient {
  signUp(input: {
    email: string;
    options: { data: { display_name: string }; emailRedirectTo: string };
    password: string;
  }): Promise<SupabaseAuthResponse>;
  signInWithPassword(input: { email: string; password: string }): Promise<SupabaseAuthResponse>;
  resetPasswordForEmail(
    email: string,
    options: { redirectTo: string },
  ): Promise<SupabaseAuthResponse>;
  verifyOtp(input: {
    email: string;
    token: string;
    type: "recovery";
  }): Promise<SupabaseAuthResponse>;
  resend(input: {
    email: string;
    options: { emailRedirectTo: string };
    type: "signup";
  }): Promise<SupabaseAuthResponse>;
  signOut(): Promise<SupabaseAuthResponse>;
  updateUser(input: { password: string }): Promise<SupabaseAuthResponse>;
}

function mapError(error: SupabaseAuthErrorLike): AuthGatewayFailureReason {
  switch (error.code) {
    case "email_not_confirmed":
      return "email_not_verified";
    case "invalid_credentials":
      return "invalid_credentials";
    case "user_not_found":
      return "identity_not_found";
    case "auth_session_missing":
    case "session_not_found":
    case "session_expired":
    case "otp_expired":
    case "bad_jwt":
      return "recovery_invalid";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "rate_limited";
    default:
      return error.status === 429
        ? "rate_limited"
        : error.status === undefined || error.status >= 500
          ? "unavailable"
          : "unexpected";
  }
}

function toResult(response: SupabaseAuthResponse): AuthGatewayResult {
  return response.error ? { ok: false, reason: mapError(response.error) } : { ok: true };
}

export class SupabaseAuthGateway implements AuthGateway {
  constructor(private readonly auth: SupabaseAuthClient) {}

  async register(input: {
    displayName: string;
    email: string;
    emailRedirectTo: string;
    password: string;
  }): Promise<AuthGatewayResult> {
    return toResult(
      await this.auth.signUp({
        email: input.email,
        options: {
          data: { display_name: input.displayName },
          emailRedirectTo: input.emailRedirectTo,
        },
        password: input.password,
      }),
    );
  }

  async signIn(input: { email: string; password: string }): Promise<AuthGatewayResult> {
    return toResult(await this.auth.signInWithPassword(input));
  }

  async sendPasswordRecovery(input: {
    email: string;
    redirectTo: string;
  }): Promise<AuthGatewayResult> {
    return toResult(
      await this.auth.resetPasswordForEmail(input.email, { redirectTo: input.redirectTo }),
    );
  }

  async verifyRecoveryOtp(input: { email: string; token: string }): Promise<AuthGatewayResult> {
    return toResult(
      await this.auth.verifyOtp({
        email: input.email,
        token: input.token,
        type: "recovery",
      }),
    );
  }

  async resendVerification(input: {
    email: string;
    emailRedirectTo: string;
  }): Promise<AuthGatewayResult> {
    return toResult(
      await this.auth.resend({
        email: input.email,
        options: { emailRedirectTo: input.emailRedirectTo },
        type: "signup",
      }),
    );
  }

  async signOut(): Promise<AuthGatewayResult> {
    return toResult(await this.auth.signOut());
  }

  async updatePassword(input: { password: string }): Promise<AuthGatewayResult> {
    return toResult(await this.auth.updateUser({ password: input.password }));
  }
}
