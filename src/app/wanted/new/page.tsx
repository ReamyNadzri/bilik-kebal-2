import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Post a Wanted | VAULTIX",
};

/**
 * What publishing a Wanted requires, and where to go to meet it.
 *
 * Deliberately not a creation form. Publishing is a Phase 3 operation that
 * snapshots the fee rate and policy version and takes the Commissioner's first
 * contribution; none of that exists yet, and a form that cannot submit would
 * be a more confusing dead end than an honest explanation.
 *
 * This screen is signposting, never a gate. Whether an account may publish is
 * decided by the identity module and enforced server-side and through RLS —
 * showing or hiding a link changes nothing (context/architecture.md).
 */
export default function PostWantedPage() {
  return (
    <>
      <h1>Post a Wanted</h1>

      <p className="lede">
        A Wanted is a request your classmates can put money behind. You describe the resource,
        choose how long the request stays open, and make the first contribution of RM1 to RM50.
      </p>

      <section className="requirement-panel">
        <h2>What you need before you can publish</h2>
        <ol className="requirement-panel__list">
          <li>
            <strong>A verified email address.</strong> This proves you control the address you
            signed up with. It lets you browse the Board.
          </li>
          <li>
            <strong>Institution verification.</strong> Publishing and funding a bounty is limited to
            students whose institution has been verified. Email verification alone is not enough.
          </li>
          <li>
            <strong>Your first contribution.</strong> A Wanted becomes visible once its first
            contribution is confirmed by the payment provider.
          </li>
        </ol>
        <p className="requirement-panel__actions">
          <Link className="button button--primary" href="/profile/institution-verification">
            Verify your institution
          </Link>
          <Link className="button button--quiet" href="/sign-in">
            Sign in
          </Link>
        </p>
      </section>

      <section>
        <h2>Before creating a request</h2>
        <p>
          Check the Board first. If someone has already asked for the same resource, backing their
          request builds one larger bounty instead of splitting the class across two.
        </p>
        <p>
          <Link href="/board">Browse the Wanted Board</Link>
        </p>
      </section>

      <p className="policy-note">
        Only request material that a student is allowed to share. Publisher textbooks, leaked papers
        and institution-restricted documents are not permitted, and a Sheriff reviews every claim
        before any resource is released or any bounty is paid.
      </p>
    </>
  );
}
