import type { Metadata } from "next";
import Link from "next/link";
import { InstitutionVerification } from "@/components/institution-verification";
import { UiStatus } from "@/components/ui-status";
import type { AccountViewModel, InstitutionOption } from "@/contracts";
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

  return (
    <>
      <h1>Institution verification</h1>

      {outcome.kind === "unauthenticated" ? (
        <UiStatus
          kind="restricted"
          heading="Sign in to verify your institution"
          message="Verification is tied to your account, so you need to be signed in before you can request it."
          action={<Link href="/sign-in">Sign in</Link>}
        />
      ) : null}

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
    </>
  );
}
