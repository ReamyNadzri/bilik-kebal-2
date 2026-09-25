import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { InstitutionVerification } from "@/components/institution-verification";
import { UiStatus } from "@/components/ui-status";
import type { AccountViewModel, InstitutionOption } from "@/contracts";
import { signInPathFor } from "@/features/presentation/auth/redirect-target";
import { loadAccountViewModel, loadSelectableInstitutions } from "@/modules/identity";

export const metadata: Metadata = {
  title: "Institution verification | VAULTIX",
};

/**
 * Reads the caller's session, so it is rendered per request and never enters a
 * shared cache (context/code-standards.md).
 */
export const dynamic = "force-dynamic";

type Outcome =
  | { kind: "ready"; account: AccountViewModel; institutions: InstitutionOption[] }
  | { kind: "email-not-verified" }
  | { kind: "unauthenticated" }
  | { kind: "unavailable" };

async function readScreen(): Promise<Outcome> {
  try {
    const [account, institutions] = await Promise.all([
      loadAccountViewModel(),
      loadSelectableInstitutions(),
    ]);

    if (account === null || institutions.status === "auth_required") {
      return { kind: "unauthenticated" };
    }

    /**
     * Institution verification requires a confirmed address first: the two
     * trust states are separate, and the operation refuses without the first
     * one. Saying so here saves an attempt that could not succeed.
     */
    if (institutions.status === "email_not_verified") {
      return { kind: "email-not-verified" };
    }

    return { account, institutions: institutions.institutions, kind: "ready" };
  } catch {
    // The reason belongs in server logs, never in a page that a browser reads.
    return { kind: "unavailable" };
  }
}

export default async function InstitutionVerificationPage() {
  const outcome = await readScreen();

  /**
   * Protected: verification is tied to an account, so there is nothing to show
   * a signed-out viewer. An unconfirmed email is a different matter and stays
   * in place — the two trust states are deliberately separate, and sign-in
   * would not resolve the second one (context/ui-context.md).
   */
  if (outcome.kind === "unauthenticated") {
    redirect(signInPathFor("/profile/institution-verification"));
  }

  return (
    <div className="page-bare institution-verification-page">
      <header className="panel page-heading">
        <div>
          <h1>Institution verification</h1>
          <p className="page-heading__lede">
            Institution verification lets you back requests, submit claims and download resources.
            It is separate from confirming your email.
          </p>
        </div>
      </header>

      {outcome.kind === "email-not-verified" ? (
        <UiStatus
          kind="restricted"
          heading="Confirm your email address first"
          message="Email verification and institution verification are separate. Confirm the address on your account before requesting institution verification."
          action={<Link href="/verify-email">Confirm your email address</Link>}
        />
      ) : null}

      {outcome.kind === "unavailable" ? (
        <UiStatus
          kind="offline"
          heading="Verification is unavailable"
          message="This is not a problem with your account or your evidence. Try again shortly."
          action={<Link href="/profile/institution-verification">Try again</Link>}
        />
      ) : null}

      {outcome.kind === "ready" ? (
        <InstitutionVerification
          state={outcome.account.trust.institution}
          institutions={outcome.institutions}
          latestRequest={outcome.account.latestVerificationRequest}
        />
      ) : null}
    </div>
  );
}
