import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ConsoleDashboard } from "@/components/console-dashboard";
import { ConsoleLanding } from "@/components/console-landing";
import { ConsoleNav } from "@/components/console-nav";
import { ReviewConsole } from "@/components/review-console";
import { UiStatus } from "@/components/ui-status";
import type { VerificationQueueItem } from "@/contracts";
import { signInPathFor } from "@/features/presentation/auth/redirect-target";
import { loadVerificationReviewQueue } from "@/modules/identity";

export const metadata: Metadata = {
  title: "Sheriff Console | VAULTIX",
};

/**
 * Reads the caller's roles and a scoped queue, so it is rendered per request
 * and never enters a shared cache (context/code-standards.md).
 */
export const dynamic = "force-dynamic";

type Outcome =
  | { kind: "ready"; items: VerificationQueueItem[] }
  | { kind: "unauthenticated" }
  | { kind: "refused" }
  | { kind: "unavailable" };

/**
 * The loader decides authorisation, not this page.
 *
 * Role and institution scope are enforced server-side and repeated by RLS on
 * every operation the console calls, and the queue arrives already scoped to
 * the reviewer's institutions. Rendering a refusal here is presentation of a
 * decision that was already made, not the decision itself.
 */
async function readQueue(): Promise<Outcome> {
  try {
    const result = await loadVerificationReviewQueue();

    /**
     * Narrowed on "ready" rather than on each refusal: the loader groups both
     * refusals into one union member, so only the positive case discriminates.
     */
    if (result.status !== "ready") {
      return result.status === "auth_required" ? { kind: "unauthenticated" } : { kind: "refused" };
    }

    return { items: result.items, kind: "ready" };
  } catch {
    // The reason belongs in server logs, never in a page a browser reads.
    return { kind: "unavailable" };
  }
}

export default async function ConsolePage() {
  const outcome = await readQueue();

  /**
   * Protected: sign-in is the one refusal a viewer can act on immediately, so
   * it is a redirect rather than a notice. A refusal on role grounds stays in
   * place — the viewer is signed in, and sending them back to a sign-in form
   * would suggest a different account is the answer when it is not.
   */
  if (outcome.kind === "unauthenticated") {
    redirect(signInPathFor("/console"));
  }

  return (
    <>
      <h1>Sheriff Console</h1>
      {outcome.kind === "refused" ? null : <ConsoleNav current="overview" />}
      {outcome.kind === "ready" ? (
        <ConsoleDashboard verificationCount={outcome.items.length} />
      ) : null}

      {outcome.kind === "refused" ? <ConsoleLanding /> : null}

      {outcome.kind === "unavailable" ? (
        <UiStatus
          kind="offline"
          heading="The review queue could not be loaded"
          message="This is not a problem with your account. No request has been changed. Try again shortly."
          action={<Link href="/console">Try again</Link>}
        />
      ) : null}

      {outcome.kind === "ready" ? (
        <section id="verification-queue" aria-label="Institution verification queue">
          <ReviewConsole items={outcome.items} />
        </section>
      ) : null}
    </>
  );
}
