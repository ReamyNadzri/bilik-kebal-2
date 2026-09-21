import type { Metadata } from "next";
import Link from "next/link";
import { UiStatus } from "@/components/ui-status";
import type { AccountViewModel } from "@/contracts";
import { readAccount } from "@/features/presentation/auth/require-account";

export const metadata: Metadata = {
  title: "Not available to this account | VAULTIX",
};

/**
 * Reads the caller's trust state, so it is rendered per request and never
 * enters a shared cache (context/code-standards.md).
 */
export const dynamic = "force-dynamic";

interface Refusal {
  readonly heading: string;
  readonly message: string;
  readonly action: { readonly href: string; readonly label: string } | null;
}

/**
 * Says which requirement is missing rather than that "access is denied".
 *
 * A viewer sent here is signed in and has done nothing wrong, so the screen
 * names the one thing standing between them and the request. Email
 * verification and institution verification are deliberately distinct states
 * and are never described in the same words (context/ui-context.md).
 */
function refusalFor(account: AccountViewModel): Refusal {
  if (account.trust.restricted) {
    return {
      heading: "This account is restricted",
      message:
        "A Sheriff has restricted this account, so transactions, Claims and downloads are paused. Contact support if you believe this is a mistake.",
      action: null,
    };
  }

  if (account.trust.email !== "verified") {
    return {
      heading: "Confirm your email address first",
      message:
        "Your email address has not been confirmed yet. Confirming it is what unlocks browsing request details.",
      action: { href: "/verify-email", label: "Resend the verification link" },
    };
  }

  if (account.trust.institution === "pending") {
    return {
      heading: "Your institution verification is still being reviewed",
      message:
        "A Sheriff is reviewing the evidence you submitted. Funding a bounty, submitting a Claim and downloading a resource open up once it is approved.",
      action: { href: "/profile", label: "Check your verification status" },
    };
  }

  if (account.trust.institution === "rejected") {
    return {
      heading: "Your institution verification was not approved",
      message:
        "The evidence submitted was not accepted, so this account cannot transact, claim or download yet. You can submit new evidence for review.",
      action: { href: "/profile/institution-verification", label: "Submit new evidence" },
    };
  }

  if (account.trust.institution !== "verified") {
    return {
      heading: "Institution verification is needed for this",
      message:
        "Funding a bounty, submitting a Claim and downloading a resource are limited to institution-verified students. A Sheriff reviews your evidence before it is granted.",
      action: { href: "/profile/institution-verification", label: "Get verified" },
    };
  }

  return {
    heading: "This screen is not available to your account",
    message:
      "Your account does not have the permission this screen needs. If you believe it should, ask a Sheriff or the Owner to check your role.",
    action: { href: "/board", label: "Back to the Wanted Board" },
  };
}

export default async function ForbiddenPage() {
  const outcome = await readAccount();

  if (outcome.kind === "unavailable") {
    return (
      <>
        <h1>Not available to this account</h1>
        <UiStatus
          kind="offline"
          heading="Your account could not be checked"
          message="Accounts are unavailable right now, so we cannot say what this screen needs. This is not a problem with your account. Try again shortly."
          action={<Link href="/forbidden">Try again</Link>}
        />
      </>
    );
  }

  /**
   * Reachable when a session ends between the guard's redirect and this
   * render. Asking the viewer to sign in is the honest answer; repeating
   * "forbidden" would describe the wrong problem.
   */
  if (outcome.kind === "unauthenticated") {
    return (
      <>
        <h1>Not available to this account</h1>
        <UiStatus
          kind="restricted"
          heading="Sign in to continue"
          message="You are not signed in, so there is no account to check this screen against."
          action={<Link href="/sign-in">Sign in</Link>}
        />
      </>
    );
  }

  const refusal = refusalFor(outcome.account);

  return (
    <>
      <h1>Not available to this account</h1>
      <p>
        You are signed in and nothing has been changed. This screen needs something your account
        does not have yet.
      </p>

      <UiStatus
        kind="restricted"
        heading={refusal.heading}
        message={refusal.message}
        {...(refusal.action === null
          ? {}
          : { action: <Link href={refusal.action.href}>{refusal.action.label}</Link> })}
      />
    </>
  );
}
