import type { NextResponse } from "next/server";
import { getIdentityPendingCookieSecret } from "@/lib/config/server-env";
import { createPasswordRecoveryGrant } from "@/modules/identity/services/password-recovery-grant";

/** Binds a short-lived password-reset grant to the user who spent the recovery link. */
export function setRecoveryGrantCookie(response: NextResponse, userId: string): void {
  response.cookies.set(
    "vaultix_password_recovery",
    createPasswordRecoveryGrant(userId, getIdentityPendingCookieSecret(process.env)),
    {
      httpOnly: true,
      maxAge: 15 * 60,
      path: "/api/auth/reset-password",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  );
}
