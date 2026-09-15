import type { Metadata } from "next";
import Link from "next/link";
import { UiStatus } from "@/components/ui-status";
import { WantedCard } from "@/components/wanted-card";
import { listFeaturedWanted, marketplaceNow } from "@/features/marketplace/wanted-source";

export const metadata: Metadata = {
  title: "VAULTIX — academic resource bounties",
  description:
    "Post what your class needs, build a shared bounty, and reward an authorised resource after review.",
};

/**
 * Reads the caller's session through the public Wanted operation, so it is
 * rendered per request and never enters a shared cache
 * (context/code-standards.md).
 */
export const dynamic = "force-dynamic";

const STEPS = [
  {
    id: "post",
    title: "Post or back a Wanted",
    body: "Tell your class what you need, or add RM1 to RM50 to a request someone else already made.",
  },
  {
    id: "submit",
    title: "Hunters submit authorised resources",
    body: "A student who has the material submits it privately, declaring that they are allowed to share it.",
  },
  {
    id: "review",
    title: "A Sheriff decides before access and reward",
    body: "A Sheriff reviews the claims and chooses one winner. Only then is access granted and the bounty paid.",
  },
] as const;

/**
 * The VAULTIX homepage.
 *
 * A marketplace, not a door. The loop — post, back, claim, review — has to be
 * legible before anyone is asked to sign in, so the fold carries the
 * proposition, the search, both actions and live requests, and authentication
 * appears nowhere on it.
 *
 * The requests shown are real, read through the published public Wanted
 * operation. No figure on this page is a claim about the platform beyond them:
 * there are no user counts, payout totals or success rates, because none of
 * them exist yet and inventing them would be a lie told on the most-read
 * screen.
 *
 * Browsing needs a verified email and nothing more, so an unverified viewer is
 * sent to email verification and never asked for an institution they do not
 * need. The proposition and the explanation of the loop are shown in every
 * state: a refusal is a reason the list is missing, not a reason to hide what
 * VAULTIX is.
 */
export default async function HomePage() {
  const featured = await listFeaturedWanted();
  const now = marketplaceNow();

  return (
    <>
      <section className="home-hero">
        <div className="home-hero__pitch">
          <h1 className="home-hero__heading">Find the notes worth hunting for.</h1>
          <p className="home-hero__lede">
            Post what your class needs, build a shared bounty, and reward an authorised resource
            after review.
          </p>

          <form className="home-search" action="/board" method="get" role="search">
            <label className="home-search__label" htmlFor="home-search-query">
              Search Wanted requests
            </label>
            <div className="home-search__row">
              <input
                className="home-search__input"
                id="home-search-query"
                name="q"
                type="search"
                placeholder="Search request titles"
              />
              {/* The visible word starts the accessible name, so voice control
                  still works while the shorter label leaves the placeholder
                  room to be read (WCAG 2.5.3, Label in Name). */}
              <button
                className="button button--secondary"
                type="submit"
                aria-label="Search the Board"
              >
                Search
              </button>
            </div>
          </form>

          <p className="home-hero__actions">
            <Link className="button button--primary" href="/board">
              Browse the Board
            </Link>
            <Link className="button button--quiet" href="/wanted/new">
              Post a Wanted
            </Link>
          </p>

          <div className="trust-ladder">
            <h2 className="trust-ladder__heading">What each verification unlocks</h2>
            <dl className="index-grid">
              <dt>Email verified</dt>
              <dd>Verify your email to browse the Board and read what other students need.</dd>
              <dt>Institution verified</dt>
              <dd>
                Verify your institution to fund a bounty, claim a request or download an approved
                resource.
              </dd>
            </dl>
            <p className="trust-ladder__note">
              A Sheriff reviews every claim. Nothing is released and nobody is paid before that
              decision.
            </p>
          </div>
        </div>

        <div className="home-hero__board">
          <h2 className="home-hero__board-heading">Open on the Board now</h2>

          {featured.status === "signed-out" ? (
            <UiStatus
              kind="restricted"
              heading="Sign in to see open requests"
              message="Reading what other students need takes a verified email address, so the requests are shown once you are signed in."
              action={<Link href="/sign-in">Sign in</Link>}
            />
          ) : featured.status === "email-unverified" ? (
            <UiStatus
              kind="restricted"
              heading="Verify your email to browse"
              message="Browsing the Board needs a verified email address. Funding a bounty or claiming a request needs institution verification as well, but not for reading."
              action={<Link href="/verify-email">Go to email verification</Link>}
            />
          ) : featured.status !== "ready" ? (
            <UiStatus
              kind="offline"
              heading="Open requests could not be loaded"
              message="This is not a problem with your account. The Board itself is still there."
              action={<Link href="/board">Open the Wanted Board</Link>}
            />
          ) : featured.data.length === 0 ? (
            <UiStatus
              kind="empty"
              heading="No open requests yet"
              message="Nothing is waiting on the Board. The first request can be yours."
              action={<Link href="/wanted/new">Post a Wanted</Link>}
            />
          ) : (
            <>
              <ul className="wanted-grid wanted-grid--preview" aria-label="Open Wanted requests">
                {featured.data.map((wanted) => (
                  <WantedCard key={wanted.id} wanted={wanted} now={now} />
                ))}
              </ul>
              <p className="home-hero__board-more">
                <Link href="/board">See every open Wanted on the Board</Link>
              </p>
            </>
          )}
        </div>
      </section>

      <section className="home-steps">
        <h2 className="home-steps__heading">How VAULTIX works</h2>
        <ol className="home-steps__list" aria-label="How VAULTIX works">
          {STEPS.map((step) => (
            <li className="home-steps__step" key={step.id}>
              <h3 className="home-steps__step-title">{step.title}</h3>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
