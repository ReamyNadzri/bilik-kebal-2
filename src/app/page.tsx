import type { Metadata } from "next";
import Image from "next/image";
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
    title: "Post the need",
    body: "A verified student publishes a structured request with course, campus and resource type.",
    role: "Commissioner",
  },
  {
    id: "back",
    title: "Back the bounty",
    body: "Coursemates contribute RM1 to RM50 each. Demand and the gross bounty stay visible.",
    role: "Backers",
  },
  {
    id: "claim",
    title: "Submit a claim",
    body: "A Hunter uploads an authorised file. It stays in private quarantine while it is screened.",
    role: "Hunter",
  },
  {
    id: "decide",
    title: "Human decision",
    body: "A Sheriff approves one winning claim. Access and the reward are released only after that.",
    role: "Sheriff",
  },
] as const;

const SUBMISSION_RULES = [
  "Original, lawful academic material only.",
  "No publisher textbooks or paid content.",
  "It must be your own work, or shared with permission.",
  "PDF, DOCX, PPTX, XLSX, JPG, PNG or WEBP, up to 50 MB.",
  "Every claim is reviewed by a human Sheriff before any payout.",
] as const;

/**
 * The VAULTIX homepage.
 *
 * A marketplace, not a door. The loop — post, back, claim, review — has to be
 * legible before anyone is asked to sign in, so the fold carries the
 * proposition, both actions, the title search and what each verification
 * unlocks, and authentication appears nowhere on it.
 *
 * The requests shown are real, read through the published public Wanted
 * operation. No figure on this page is a claim about the platform beyond them:
 * the design's live totals ("active requests", "gross bounty", "campuses live")
 * are left out because no operation counts them, and inventing them would be a
 * lie told on the most-read screen.
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
    <div className="page-bare">
      <section className="home-hero" aria-labelledby="home-title">
        <Image
          className="home-hero__art"
          src="/brand/hero-frontier.webp"
          alt=""
          fill
          priority
          sizes="(min-width: 90rem) 90rem, 100vw"
        />

        <div className="home-hero__inner">
          <div className="home-hero__pitch">
            <p className="pixel-label pixel-label--on-dark">Post · Back · Claim</p>
            <h1 className="home-hero__heading" id="home-title">
              Ask for it. Back it. Claim it.
            </h1>
            <p className="home-hero__lede">
              Post what your class needs, let classmates back it together, and reward the authorised
              resource a Sheriff approves.
            </p>

            <p className="home-hero__actions">
              <Link className="button button--primary button--on-light-edge" href="/wanted/new">
                Post a Wanted <span aria-hidden="true">→</span>
              </Link>
              <Link className="button button--ghost" href="/board">
                Browse the Board
              </Link>
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
                  className="button button--brass"
                  type="submit"
                  aria-label="Search the Board"
                >
                  Search
                </button>
              </div>
            </form>
          </div>

          <div className="panel trust-ladder">
            <p className="pixel-label">Before you start</p>
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
      </section>

      <section className="home-steps" aria-labelledby="home-steps-title">
        <div className="home-steps__head">
          <h2 className="home-steps__heading plank-sign" id="home-steps-title">
            How the hunt works
          </h2>
          <p className="pixel-label pixel-label--on-dark">Four stations · one winning claim</p>
        </div>

        <ol className="home-steps__list" aria-label="How the hunt works">
          {STEPS.map((step) => (
            <li className="home-steps__step" key={step.id}>
              <div className="home-steps__note poster-paper pin pin--green">
                <h3 className="home-steps__step-title">{step.title}</h3>
                <p>{step.body}</p>
                <span className="role-tag">{step.role}</span>
              </div>
            </li>
          ))}
        </ol>

        <div className="home-steps__foot">
          <p>
            An unfulfilled bounty expires at the end of its duration, and every contribution is
            refunded.
          </p>
          <Link className="button button--brass" href="/wanted/new">
            Start a hunt <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      <section aria-labelledby="home-featured-title">
        <div className="section-head">
          <div>
            <h2 className="on-dark" id="home-featured-title">
              Featured Wanted
            </h2>
            <p className="section-head__lede on-dark-muted">
              The newest open requests students have posted on the Board.
            </p>
          </div>
          {featured.status === "ready" && featured.data.length > 0 ? (
            <Link className="button button--ghost" href="/board">
              See every open Wanted on the Board <span aria-hidden="true">→</span>
            </Link>
          ) : null}
        </div>

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
          <div className="board-surface">
            <ul className="wanted-grid" aria-label="Open Wanted requests">
              {featured.data.map((wanted) => (
                <WantedCard key={wanted.id} wanted={wanted} now={now} />
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="home-lower" aria-label="Explore and rules">
        <div className="map-teaser">
          <Image
            className="map-teaser__art"
            src="/brand/map-malaysia.webp"
            alt=""
            fill
            sizes="(min-width: 56rem) 45rem, 100vw"
          />
          <h2>Where is knowledge needed?</h2>
          <p>Open the map to see where students are asking for resources, campus by campus.</p>
          <Link className="button button--brass" href="/map">
            Explore the map <span aria-hidden="true">→</span>
          </Link>
        </div>

        <div className="panel">
          <h2>Submission rules</h2>
          <ul className="rule-list">
            {SUBMISSION_RULES.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
          <p className="panel__note">
            Institution verification confirms affiliation only. It does not guarantee resource
            quality.
          </p>
        </div>
      </section>
    </div>
  );
}
