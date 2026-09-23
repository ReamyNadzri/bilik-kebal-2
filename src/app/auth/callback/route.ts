import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { safeNextPath } from "@/modules/identity/delivery/auth-http";
import { resolveAuthCallbackPath } from "@/modules/identity/delivery/auth-callback";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getIdentityPendingCookieSecret } from "@/lib/config/server-env";
import { createPasswordRecoveryGrant } from "@/modules/identity/services/password-recovery-grant";

const allowedOtpTypes: ReadonlySet<string> = new Set([
  "email",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
]);

export async function GET(request: Request): Promise<Response> {
  const requestUrl = new URL(request.url);
  const next = safeNextPath(requestUrl.searchParams.get("next"), "/profile");
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const flow = requestUrl.searchParams.get("flow");
  const client = await createSupabaseServerClient();

  const result = code
    ? await client.auth.exchangeCodeForSession(code)
    : tokenHash && type && allowedOtpTypes.has(type)
      ? await client.auth.verifyOtp({ token_hash: tokenHash, type: type as EmailOtpType })
      : { error: new Error("Missing authentication callback parameters") };

  const destination = new URL(
    resolveAuthCallbackPath({
      errorCode: result.error ? ((result.error as { code?: string }).code ?? "invalid") : null,
      flow,
      next,
      otpType: type,
    }),
    requestUrl.origin,
  );
  const response = NextResponse.redirect(destination);
  if (!result.error && flow === "recovery") {
    const {
      data: { user },
      error,
    } = await client.auth.getUser();
    if (error || !user) {
      const failedResponse = NextResponse.redirect(
        new URL("/sign-in?error=recovery_failed", requestUrl.origin),
      );
      failedResponse.headers.set("Cache-Control", "private, no-store");
      return failedResponse;
    }
    response.cookies.set(
      "vaultix_password_recovery",
      createPasswordRecoveryGrant(user.id, getIdentityPendingCookieSecret(process.env)),
      {
        httpOnly: true,
        maxAge: 15 * 60,
        path: "/api/auth/reset-password",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      },
    );
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
