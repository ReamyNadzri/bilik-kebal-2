import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import type { Metadata } from "next";

import { UiStatus } from "@/components/ui-status";

export const metadata: Metadata = { title: "Signing you in | VAULTIX" };

/** Where Google returns to; Clerk completes the sign-in and moves on. */
export default function SsoCallbackPage() {
  return (
    <>
      <UiStatus kind="loading" heading="Signing you in" />
      <AuthenticateWithRedirectCallback
        signInFallbackRedirectUrl="/profile"
        signUpFallbackRedirectUrl="/profile"
      />
    </>
  );
}
