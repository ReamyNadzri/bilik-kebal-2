import { z } from "zod";

import type {
  IdentityOperationCode,
  PasswordRecoveryResult,
  RegistrationResult,
  SignInResult,
  SignOutResult,
} from "@/contracts/identity";
import { failure, success } from "@/contracts/operation-result";

const emailSchema = z.string().trim().toLowerCase().email().max(254);
const passwordSchema = z
  .string()
  .min(8)
  .max(72)
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[0-9]/, "Password must contain a number");

const registrationSchema = z.object({
  displayName: z.string().trim().min(1).max(100),
  email: emailSchema,
  password: passwordSchema,
});

const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(72),
});

const recoverySchema = z.object({ email: emailSchema });

type AuthFailure = {
  ok: false;
  code: IdentityOperationCode;
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export type AuthGatewayFailureReason =
  | "email_not_verified"
  | "identity_not_found"
  | "invalid_credentials"
  | "rate_limited"
  | "unavailable"
  | "unexpected";

export type AuthGatewayResult = { ok: true } | { ok: false; reason: AuthGatewayFailureReason };

export interface AuthGateway {
  register(input: {
    displayName: string;
    email: string;
    emailRedirectTo: string;
    password: string;
  }): Promise<AuthGatewayResult>;
  signIn(input: { email: string; password: string }): Promise<AuthGatewayResult>;
  sendPasswordRecovery(input: { email: string; redirectTo: string }): Promise<AuthGatewayResult>;
  signOut(): Promise<AuthGatewayResult>;
}

export interface RegisterInput {
  displayName: string;
  email: string;
  password: string;
}

export interface SignInInput {
  email: string;
  password: string;
}

export interface RecoverPasswordInput {
  email: string;
}

function validationFailure(error: z.ZodError): AuthFailure {
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    fieldErrors[field] ??= [];
    fieldErrors[field].push(issue.message);
  }

  return failure("VALIDATION_ERROR", "Check the highlighted fields.", fieldErrors);
}

function providerFailure(reason: AuthGatewayFailureReason): AuthFailure {
  switch (reason) {
    case "email_not_verified":
      return failure("EMAIL_NOT_VERIFIED", "Verify your email before signing in.");
    case "invalid_credentials":
    case "identity_not_found":
      return failure("INVALID_CREDENTIALS", "Email or password is incorrect.");
    case "rate_limited":
      return failure("AUTH_RATE_LIMITED", "Too many attempts. Wait and try again.");
    case "unavailable":
      return failure("AUTH_UNAVAILABLE", "Authentication is temporarily unavailable. Try again.");
    case "unexpected":
      return failure("AUTH_UNAVAILABLE", "Authentication could not be completed. Try again.");
  }
}

export class AuthService {
  private readonly appUrl: URL;

  constructor(
    private readonly gateway: AuthGateway,
    appUrl: string,
  ) {
    this.appUrl = new URL(appUrl);
  }

  async register(input: unknown): Promise<RegistrationResult> {
    const parsed = registrationSchema.safeParse(input);

    if (!parsed.success) {
      return validationFailure(parsed.error);
    }

    const callbackUrl = new URL("/auth/callback", this.appUrl);
    callbackUrl.searchParams.set("next", "/profile");
    const result = await this.gateway.register({
      ...parsed.data,
      emailRedirectTo: callbackUrl.toString(),
    });

    if (!result.ok) {
      const mapped = providerFailure(result.reason);
      return mapped.code === "INVALID_CREDENTIALS"
        ? failure("REGISTRATION_FAILED", "Registration could not be completed.")
        : mapped;
    }

    return success({ next: "verify_email" as const });
  }

  async signIn(input: unknown): Promise<SignInResult> {
    const parsed = signInSchema.safeParse(input);

    if (!parsed.success) {
      return validationFailure(parsed.error);
    }

    const result = await this.gateway.signIn(parsed.data);
    return result.ok ? success({ next: "profile" as const }) : providerFailure(result.reason);
  }

  async recoverPassword(input: unknown): Promise<PasswordRecoveryResult> {
    const parsed = recoverySchema.safeParse(input);

    if (!parsed.success) {
      return validationFailure(parsed.error);
    }

    const redirectTo = new URL("/reset-password", this.appUrl).toString();
    const result = await this.gateway.sendPasswordRecovery({ ...parsed.data, redirectTo });

    if (!result.ok && result.reason !== "identity_not_found") {
      return providerFailure(result.reason);
    }

    return success({ accepted: true as const });
  }

  async signOut(): Promise<SignOutResult> {
    const result = await this.gateway.signOut();
    return result.ok
      ? success({ signedOut: true as const })
      : failure("AUTH_UNAVAILABLE", "Sign out could not be completed. Try again.");
  }
}
