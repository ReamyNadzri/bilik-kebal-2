import Link from "next/link";
import { MissingPoster } from "./missing-poster";
import { UiStatus } from "./ui-status";
import type { SampleHuntersResult } from "@/contracts/profiles";

export interface HomeHuntersProps {
  readonly hunters: SampleHuntersResult;
}

/**
 * "Hunters on the Board" on the homepage: a few members picked at random, as
 * the wall's posters on a flat grid, with the way to the whole wall. The
 * wall is for members, so a signed-out or unverified reader sees why the
 * posters are missing, in the same words as Featured Wanted above it. The
 * way to sign in or verify is left to that section, directly above: a second
 * identical link would only repeat it in every list of the page's links.
 */
export function HomeHunters({ hunters }: HomeHuntersProps) {
  const listed = hunters.ok && hunters.data.length > 0;

  return (
    <section aria-labelledby="home-hunters-title">
      <div className="section-head">
        <div>
          <h2 className="on-dark home-hunters__heading" id="home-hunters-title">
            Hunters on the Board
          </h2>
          <p className="section-head__lede on-dark-muted">
            A few of the students hunting and backing bounties right now.
          </p>
        </div>
        {listed ? (
          <Link className="button button--ghost" href="/board?view=hunters">
            See all Hunters
          </Link>
        ) : null}
      </div>

      {hunters.ok ? (
        hunters.data.length > 0 ? (
          <div className="board-surface home-hunters__board">
            <ul className="home-hunters__grid" aria-label="Some Hunters">
              {hunters.data.map((hunter) => (
                <li key={hunter.publicId} className="home-hunters__slot">
                  <MissingPoster hunter={hunter} variant="flat" />
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <UiStatus
            kind="empty"
            heading="No Hunters on the Board yet"
            message="Members appear here once they verify their institution."
          />
        )
      ) : hunters.code === "AUTH_REQUIRED" ? (
        <UiStatus
          kind="restricted"
          heading="Sign in to see the Hunters"
          message="The Hunters are members, so their posters are shown once you are signed in with a verified email address."
        />
      ) : hunters.code === "EMAIL_NOT_VERIFIED" ? (
        <UiStatus
          kind="restricted"
          heading="Verify your email to see the Hunters"
          message="Seeing other members needs a verified email address and nothing more."
        />
      ) : (
        <UiStatus
          kind="offline"
          heading="The Hunters could not be loaded"
          message="This is not a problem with your account. The wall itself is still there."
          action={<Link href="/board?view=hunters">Open the Hunters wall</Link>}
        />
      )}
    </section>
  );
}
