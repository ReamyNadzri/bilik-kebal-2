import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { safeNextPath } from "@/modules/identity/delivery/auth-http";
import { resolveAuthCallbackPath } from "@/modules/identity/delivery/auth-callback";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
  const client = await createSupabaseServerClient();

  const result = code
    ? await client.auth.exchangeCodeForSession(code)
    : tokenHash && type && allowedOtpTypes.has(type)
      ? await client.auth.verifyOtp({ token_hash: tokenHash, type: type as EmailOtpType })
      : { error: new Error("Missing authentication callback parameters") };

  const destination = new URL(
    resolveAuthCallbackPath({
      errorCode: result.error ? ((result.error as { code?: string }).code ?? "invalid") : null,
      next,
      otpType: type,
    }),
    requestUrl.origin,
  );
  const response = NextResponse.redirect(destination);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
