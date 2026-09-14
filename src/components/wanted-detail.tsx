import Link from "next/link";
import { BountyPlate } from "./bounty-plate";
import { StatusStamp } from "./status-stamp";
import { WantedCard } from "./wanted-card";
import { wantedStatusPresentation } from "@/features/marketplace/status";
import { formatClosing, formatPostedAge } from "@/features/marketplace/time";
import type { WantedDetail as Detail, WantedSummary } from "@/features/marketplace/types";

export interface WantedDetailProps {
  readonly wanted: Detail;
  readonly similar: readonly WantedSummary[];
  readonly now: string;
}

function describeBackers(count: number): string {
  if (count === 0) {
    return "No backers yet";
  }

  return `${count} backer${count === 1 ? "" : "s"}`;
}

/**
 * One Wanted request in full: the case file on the left, the ledger on the
 * right.
 *
 * Nothing about any submitted file appears here. Claims are quarantined until
 * a Sheriff approves one, so this page describes what is *wanted*, never what
 * has been supplied (`context/architecture.md`). There is no preview, no file
 * name, no object key and no download.
 *
 * The two protected actions link to institution verification rather than to a
 * form. Contributing and claiming both require institution verification, and
 * payment is disabled in this build; a control that looked live and did
 * nothing would be worse than one that says what it needs. The rule itself is
 * enforced server-side and by RLS — this is signposting, not a gate.
 */
export function WantedDetail({ wanted, similar, now }: WantedDetailProps) {
  const closing = formatClosing(wanted.closesAt, now, { detail: true });
  const feePercent = wanted.feeRateBasisPoints / 100;

  return (
    <div className="wanted-detail">
      <header className="wanted-detail__header">
        <p className="wanted-detail__masthead">
          <StatusStamp
            presentation={wantedStatusPresentation(wanted.status)}
            context="This Wanted"
          />
          <time className="wanted-detail__posted" dateTime={wanted.postedAt}>
            {formatPostedAge(wanted.postedAt, now)}
          </time>
        </p>

        <h1 className="wanted-detail__title" id="wanted-title">
          {wanted.title}
        </h1>
      </header>

      {/* Before the case file in the DOM, not merely repositioned by `order`.
          At 360 px the bounty and the two actions must sit under the title
          rather than below the whole description, and reordering visually
          would leave the tab order disagreeing with what is on screen. Grid
          placement puts this column on the right at desktop. */}
      <aside className="wanted-detail__ledger" aria-label="Bounty and actions">
        <div className="ledger-panel">
          <BountyPlate amountSen={wanted.grossBountySen} size="large" />
          <p className="ledger-panel__backers numeric">{describeBackers(wanted.backerCount)}</p>
          <p className="ledger-panel__closing">
            <time dateTime={wanted.closesAt}>{closing.label}</time>
          </p>
        </div>

        <div className="ledger-panel">
          <Link
            className="button button--primary ledger-panel__action"
            href="/profile/institution-verification"
          >
            Back this Wanted
          </Link>
          <Link
            className="button button--secondary ledger-panel__action"
            href="/profile/institution-verification"
          >
            Submit a Claim
          </Link>
          <p className="ledger-panel__note">
            Both actions need institution verification. Contributions are RM1 to RM50 per Backer,
            and payment is disabled in this build until the launch gate passes.
          </p>
        </div>

        <div className="ledger-panel">
          <h2 className="ledger-panel__heading">Fees</h2>
          <p className="ledger-panel__body">
            A {feePercent}% platform fee is taken from the bounty when a claim is approved. The rate
            was fixed when this Wanted was published and does not change afterwards.
          </p>
          <p className="ledger-panel__body">
            The payment provider adds its own charge to a Backer&rsquo;s checkout total. It is paid
            on top of the contribution, so the bounty rises by the full amount contributed.
          </p>
        </div>

        <div className="ledger-panel">
          <h2 className="ledger-panel__heading">Who posted this</h2>
          <p className="ledger-panel__commissioner">{wanted.commissioner.displayName}</p>
          <dl className="index-grid ledger-panel__trust">
            <dt>Email verified</dt>
            <dd>
              {wanted.commissioner.emailVerified ? "Yes" : "No"}. This proves control of an email
              address and nothing more.
            </dd>
            <dt>Institution verified</dt>
            <dd>
              {wanted.commissioner.institutionVerified ? "Yes" : "No"}. This permits funding a
              bounty, submitting a claim and downloading an approved resource. It confirms
              affiliation only and does not guarantee the quality of any resource.
            </dd>
          </dl>
          <p className="ledger-panel__body">
            No automated check can approve a claim. A human Sheriff decides, and only then is access
            granted or a bounty paid.
          </p>
        </div>
      </aside>

      {/* Named by its own title so the case file is addressable next to the
          similar-request cards, which are also articles. */}
      <article className="wanted-detail__case" aria-labelledby="wanted-title">
        <p className="wanted-detail__description">{wanted.description}</p>

        <dl
          className="index-grid wanted-detail__facts"
          role="group"
          aria-label="Full request details"
        >
          <dt>Course</dt>
          <dd>{`${wanted.courseCode} ${wanted.courseName}`}</dd>
          <dt>Campus</dt>
          <dd>{wanted.campus}</dd>
          <dt>Faculty</dt>
          <dd>{wanted.faculty}</dd>
          <dt>Programme</dt>
          <dd>{wanted.programme}</dd>
          <dt>Session</dt>
          <dd>{wanted.session}</dd>
          <dt>Resource</dt>
          <dd>{wanted.resourceType}</dd>
          <dt>Language</dt>
          <dd>{wanted.language}</dd>
        </dl>

        {wanted.tags.length === 0 ? null : (
          <ul className="tag-row" aria-label="Tags">
            {wanted.tags.map((tag) => (
              <li className="tag-row__tag" key={tag}>
                {tag}
              </li>
            ))}
          </ul>
        )}

        <section className="wanted-detail__section">
          <h2>What may be submitted</h2>
          <p className="policy-note">
            A claim may contain only material the Hunter is allowed to share. Publisher textbooks,
            paid tutorial material, leaked papers and institution-restricted documents are not
            permitted. A Sheriff must approve a claim before any resource is released or any bounty
            is paid.
          </p>
        </section>

        <section className="wanted-detail__section">
          <h2>Activity</h2>
          <ol className="activity" aria-label="Activity on this Wanted">
            {wanted.activity.map((event) => (
              <li className="activity__event" key={event.id}>
                <time className="activity__when" dateTime={event.at}>
                  {formatPostedAge(event.at, now).replace("Posted ", "")}
                </time>
                <span className="activity__what">{event.summary}</span>
              </li>
            ))}
          </ol>
        </section>
      </article>

      {/* Deliberately outside the case file: these are other people's requests,
          and nesting them in this request's article would make every card's
          status and counts read as part of it. */}
      {similar.length === 0 ? null : (
        <section className="wanted-detail__similar">
          <h2>Similar requests</h2>
          <p className="wanted-detail__similar-note">
            Backing an existing request builds one larger bounty instead of splitting the class
            across two.
          </p>
          <ul className="wanted-grid" aria-label="Similar Wanted requests">
            {similar.map((other) => (
              <WantedCard key={other.id} wanted={other} now={now} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
