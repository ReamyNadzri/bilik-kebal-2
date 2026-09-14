import { cookies } from "next/headers";

import { getIdentityPendingCookieSecret } from "@/lib/config/server-env";

import { decodePendingEmail, encodePendingEmail } from "../services/pending-verification-cookie";

const COOKIE_NAME = "vaultix_pending_verification";

export async function rememberPendingVerificationEmail(email: string): Promise<void> {
  const store = await cookies();
  store.set(
    COOKIE_NAME,
    await encodePendingEmail(email, getIdentityPendingCookieSecret(process.env)),
    {
      httpOnly: true,
      maxAge: 60 * 60,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  );
}

export async function readPendingVerificationEmail(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(COOKIE_NAME)?.value;
  return value ? decodePendingEmail(value, getIdentityPendingCookieSecret(process.env)) : null;
}
