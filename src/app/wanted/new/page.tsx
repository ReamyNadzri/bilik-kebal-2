import type { Metadata } from "next";
import Link from "next/link";
import { FixtureNotice } from "@/components/fixture-notice";
import { UiStatus } from "@/components/ui-status";
import { WantedDraftWorkspace } from "@/components/wanted-draft-workspace";
import type { AccountViewModel } from "@/contracts";
import { WANTED } from "@/features/marketplace/fixtures";
import { loadWantedTaxonomy } from "@/features/marketplace/taxonomy-source";
import { readPreviewState } from "@/features/marketplace/wanted-source";
import { loadAccountViewModel } from "@/modules/identity";

export const metadata: Metadata = {
  title: "Post a Wanted | VAULTIX",
};

/**
 * Reads the caller's session, so it is rendered per request and never enters a
 * shared cache (context/code-standards.md).
 */
export const dynamic = "force-dynamic";

interface PostWantedPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

type Outcome =
  | { kind: "account"; account: AccountViewModel }
  | { kind: "unauthenticated" }
  | { kind: "unavailable" };

/**
 * The loader answers `null` for a request it cannot attribute to a signed-in
 * user, and throws when identity itself is unreachable. Those are different
 * situations for the reader — one is "sign in", the other is "this is our
 * fault" — so they are not collapsed into one failure.
 */
async function readAccount(): Promise<Outcome> {
  try {
    const account = await loadAccountViewModel();

    return account === null ? { kind: "unauthenticated" } : { kind: "account", account };
  } catch {
    // The reason belongs in server logs, never in a page a browser reads.
    return { kind: "unavailable" };
  }
}

interface Refusal {
  readonly heading: string;
  readonly message: string;
  readonly action: React.ReactNode;
}

/**
 * Explains why this account cannot publish, in the order the reader can act on.
 *
 * Email verification comes first because nothing else is reachable without it.
 * A restriction outranks institution state: a restricted account is not one
 * verification away from posting, and telling it to verify would waste the
 * reader's time.
 *
 * The decision itself is never made here. `capabilities.transact` is the
 * backend's answer, and this function only chooses the wording for it. The
 * operation and RLS enforce the rule independently, so a refusal rendered here
 * is presentation of a decision already taken (context/architecture.md).
 */
function refusal(account: AccountViewModel): Refusal {
  if (account.trust.email === "unverified") {
    return {
      heading: "Verify your email first",
      message:
        "Publishing a Wanted starts with a verified email address. Verification proves you control the address you signed up with.",
      action: <Link href="/verify-email">Go to email verification</Link>,
    };
  }

  if (account.trust.restricted) {
    return {
      heading: "This account cannot post a Wanted",
      message:
        "This account is restricted, so it cannot publish or fund a request. A Sheriff decides when a restriction is lifted; this screen cannot change it.",
      action: <Link href="/profile">Open your profile</Link>,
    };
  }

  if (account.trust.institution === "pending") {
    return {
      heading: "Verify your institution to post a Wanted",
      message:
        "A Sheriff is reviewing your verification request. Publishing opens once your institution is confirmed.",
      action: <Link href="/profile">Check your verification status</Link>,
    };
  }

  return {
    heading: "Verify your institution to post a Wanted",
    message:
      "Publishing and funding a request is limited to students whose institution has been verified. Email verification alone is not enough.",
    action: <Link href="/profile/institution-verification">Verify your institution</Link>,
  };
}

/**
 * The Wanted creation workspace.
 *
 * Nothing on this screen is persisted. The draft, duplicate-check and
 * publication operations are Phase 3 backend work that has not landed, so the
 * form validates and previews only, and says so plainly.
 *
 * The identity read is real: eligibility comes from the published account view
 * model rather than from a trust state recomputed in the browser.
 */
export default async function PostWantedPage({ searchParams }: PostWantedPageProps) {
  const preview = readPreviewState((await searchParams)["preview"]);
  const outcome = await readAccount();

  if (outcome.kind === "unauthenticated") {
    return (
      <>
        <h1>Post a Wanted</h1>
        <UiStatus
          kind="restricted"
          heading="Sign in to post a Wanted"
          message="A Wanted belongs to the account that publishes it, so you need to be signed in before you can create one."
          action={<Link href="/sign-in">Sign in</Link>}
        />
      </>
    );
  }

  if (outcome.kind === "unavailable") {
    return (
      <>
        <h1>Post a Wanted</h1>
        <UiStatus
          kind="offline"
          heading="Your account could not be loaded"
          message="This is not a problem with your account, and nothing has been created. Try again shortly."
          action={<Link href="/wanted/new">Try again</Link>}
        />
      </>
    );
  }

  if (!outcome.account.capabilities.transact) {
    const { heading, message, action } = refusal(outcome.account);

    return (
      <>
        <h1>Post a Wanted</h1>
        <UiStatus kind="restricted" heading={heading} message={message} action={action} />
        <p className="lede">
          A Wanted is a request your classmates can put money behind. You describe the resource,
          choose how long the request stays open, and make the first contribution of RM1 to RM50.
        </p>
        <p>
          <Link href="/board">Browse the Wanted Board</Link>
        </p>
      </>
    );
  }

  const taxonomy = loadWantedTaxonomy(preview);

  return (
    <>
      <FixtureNotice screen="This creation workspace" />

      <h1>Post a Wanted</h1>

      <p className="lede">
        Describe what your class needs, choose how long the request stays open, and start the bounty
        with your own contribution. A Sheriff reviews every claim before any resource is released or
        any bounty is paid.
      </p>

      {taxonomy.status === "unavailable" ? (
        <UiStatus
          kind="offline"
          heading="The course list could not be loaded"
          message="Campuses and courses are unavailable right now, so the form cannot be filled in accurately. Nothing has been created. Try again shortly."
          action={<Link href="/wanted/new">Try again</Link>}
        />
      ) : taxonomy.data.courses.length === 0 ? (
        <UiStatus
          kind="empty"
          heading="No courses have been published yet"
          message="A request must name a real course, and none has been published for your institution yet. The course list is published from reviewed institutional records."
          action={<Link href="/board">Browse the Wanted Board</Link>}
        />
      ) : (
        <WantedDraftWorkspace taxonomy={taxonomy.data} board={WANTED} />
      )}
    </>
  );
}
