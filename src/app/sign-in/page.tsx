import type { Metadata } from "next";
import { SignInForm } from "@/components/sign-in-form";
import { UiStatus } from "@/components/ui-status";
import { readNextPath } from "@/features/presentation/auth/redirect-target";
import { requireGuest } from "@/features/presentation/auth/require-account";

export const metadata: Metadata = {
  title: "Sign in | VAULTIX",
};

/**
 * Reads the caller's session to keep a signed-in viewer off this screen, so it
 * is rendered per request (context/code-standards.md).
 */
export const dynamic = "force-dynamic";

interface SignInPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Connected to the identity operation; no fixture remains. */
export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;
  const next = readNextPath(params["next"]);

  /**
   * Guest-only. Someone already signed in is sent where they were going rather
   * than shown a form that would sign them into the session they already have.
   */
  await requireGuest(next);

  return (
    <>
      <h1>Sign in</h1>

      {params["expired"] === undefined ? null : (
        <UiStatus
          kind="expired"
          heading="Your session ended"
          message="You were signed out because your session expired. Sign in again and you will be returned to what you were doing."
        />
      )}

      {params["idle"] === undefined ? null : (
        <UiStatus
          kind="expired"
          heading="Signed out after inactivity"
          message="You were signed out because this account was idle: 30 minutes for Sheriffs and the Owner, 7 days for members. Sign in again to continue."
        />
      )}

      <SignInForm next={next} />
    </>
  );
}
