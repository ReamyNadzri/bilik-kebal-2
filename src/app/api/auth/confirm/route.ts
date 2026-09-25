import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  confirmPathFor,
  parseEmailLinkInput,
} from "@/modules/identity/delivery/email-link-confirmation";
import { setRecoveryGrantCookie } from "@/modules/identity/delivery/recovery-grant-cookie";

export const dynamic = "force-dynamic";

function redirect(path: string, origin: string): NextResponse {
  // 303 turns the form POST into a GET on the destination.
  const response = NextResponse.redirect(new URL(path, origin), 303);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

/**
 * The only place an emailed confirmation or recovery token is spent. The
 * /auth/confirm page renders a button that posts here, so a link scanner that
 * opens the email link spends nothing. Never logs the token.
 */
export async function POST(request: Request): Promise<Response> {
  const origin = new URL(request.url).origin;
  const form = await request.formData().catch(() => null);
  const input = parseEmailLinkInput({
    tokenHash: form?.get("token_hash"),
    type: form?.get("type"),
    next: form?.get("next"),
  });
  if (!input) return redirect("/verify-email?status=invalid", origin);

  const client = await createSupabaseServerClient();
  const { error } = await client.auth.verifyOtp({ token_hash: input.tokenHash, type: input.type });

  if (error) {
    const { code, status } = error as { code?: string; status?: number };
    if (status === undefined || status >= 500 || status === 429) {
      // The token was not spent; send the person back to press the button again.
      const retry = new URLSearchParams({
        token_hash: input.tokenHash,
        type: input.type,
        status: "unavailable",
      });
      return redirect(`/auth/confirm?${retry.toString()}`, origin);
    }
    return redirect(confirmPathFor(input, code ?? "invalid"), origin);
  }

  const response = redirect(confirmPathFor(input, null), origin);
  if (input.type === "recovery") {
    const { data, error: userError } = await client.auth.getUser();
    if (userError || !data.user) return redirect("/sign-in?error=recovery_failed", origin);
    setRecoveryGrantCookie(response, data.user.id);
  }
  return response;
}
