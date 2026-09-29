import type { Metadata } from "next";
import { ClerkEmailVerification } from "@/components/clerk-email-verification";

export const metadata: Metadata = {
  title: "Verify your email | VAULTIX",
};

/** Per-account state, so it is rendered per request (context/code-standards.md). */
export const dynamic = "force-dynamic";

export default function VerifyEmailPage() {
  return (
    <>
      <h1>Verify your email</h1>

      <ClerkEmailVerification />
    </>
  );
}
