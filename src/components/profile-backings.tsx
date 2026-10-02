import Link from "next/link";
import type { ReactNode } from "react";
import type { ClosedBacking, OwnBackings } from "@/contracts/marketplace";
import { formatRinggit } from "@/features/marketplace/money";
import { WantedCard } from "./wanted-card";

export interface ProfileBackingsProps {
  readonly backings: OwnBackings;
  readonly now: string;
  readonly empty: ReactNode;
}

const HEADING = "Wanteds you backed";
const HEADING_ID = "profile-backed-heading";

const REASON: Readonly<Record<ClosedBacking["reason"], string>> = {
  withdrawn: "Withdrawn by the poster",
  removed: "Removed by the Owner",
  expired: "Expired without a winner",
  closed: "Closed before your payment arrived",
};

/** The status line, in plain English beside the themed card wall. */
export function closedBackingLine(item: ClosedBacking): string {
  const amount = formatRinggit(item.refundSen, { cents: "always" });
  const refund =
    item.refundState === "pending"
      ? `Refund of ${amount} pending`
      : item.refundState === "refunded"
        ? `Refunded ${amount}`
        : "No refund queued yet";
  return `${REASON[item.reason]} · ${refund}`;
}

function RefundStamp({ state }: { readonly state: ClosedBacking["refundState"] }) {
  if (state === "none") return null;
  return (
    <span
      className={`status-stamp ${state === "refunded" ? "status-stamp--success" : "status-stamp--warning"}`}
    >
      {state === "refunded" ? "Refunded" : "Refund pending"}
    </span>
  );
}

/**
 * The member's own backings. Live Wanteds are cards; closed ones stay listed
 * under them with why they closed and where the refund stands. A withdrawn or
 * removed Wanted has no page left for its Backers, so only an expired one links.
 */
export function ProfileBackings({ backings, now, empty }: ProfileBackingsProps) {
  const { live, closed } = backings;
  return (
    <section className="board-surface profile-grid" aria-labelledby={HEADING_ID}>
      <h2 id={HEADING_ID} className="board-surface__heading">
        {HEADING}
      </h2>
      {live.length === 0 && closed.length === 0 ? <div className="panel">{empty}</div> : null}
      {live.length > 0 ? (
        <ul className="wanted-grid" aria-label={HEADING}>
          {live.map((item) => (
            <WantedCard key={item.id} wanted={item} now={now} />
          ))}
        </ul>
      ) : null}
      {closed.length > 0 ? (
        <div className="panel profile-backings__closed">
          <ul className="entry-list" aria-label={`Closed ${HEADING}`}>
            {closed.map((item) => (
              <li className="entry-list__item" key={item.publicId}>
                <div>
                  <p className="trust-row__title">
                    {item.reason === "expired" ? (
                      <Link href={`/wanted/${item.publicId}`} prefetch={false}>
                        {item.title}
                      </Link>
                    ) : (
                      item.title
                    )}
                  </p>
                  <p className="trust-row__body">{closedBackingLine(item)}</p>
                </div>
                <RefundStamp state={item.refundState} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
