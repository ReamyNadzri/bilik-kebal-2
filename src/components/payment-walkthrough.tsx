"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatRinggit, sen, type Sen } from "@/features/marketplace/money";
import { CapturePoster, pickCaptureWord, type CaptureWord } from "./motion/capture-poster";
import { UiStatus } from "./ui-status";

/**
 * What the walkthrough is about: a real Wanted being backed, or a draft being
 * published with its first contribution. Only labels and amounts; nothing is
 * sent anywhere.
 */
export interface WalkthroughSeed {
  readonly mode: "publish" | "back";
  readonly title: string;
  readonly courseCode: string;
  readonly courseName: string;
  /** The bounty before this contribution (zero when publishing). */
  readonly startingBountySen: Sen;
  readonly amountSen: Sen;
  readonly feeRateBasisPoints: number;
  readonly durationDays: number;
  /** The real Wanted to return to, when there is one. */
  readonly wantedId: string | null;
}

type Outcome = "paid" | "failed" | "pending";

interface Step {
  readonly id: string;
  readonly label: string;
}

const STEPS: readonly Step[] = [
  { id: "checkout", label: "Checkout" },
  { id: "return", label: "Back from payment" },
  { id: "confirm", label: "Provider confirms" },
  { id: "window", label: "First hour" },
  { id: "claims", label: "Backers and claims" },
  { id: "review", label: "Sheriff review" },
  { id: "payout", label: "Payout" },
  { id: "refund", label: "If nobody delivers" },
];

/** Integer sen, rounded down, exactly as approve_winning_claim_and_fulfill does. */
function platformFeeSen(grossSen: number, basisPoints: number): Sen {
  return sen(Math.floor((grossSen * basisPoints) / 10_000));
}

/**
 * A guided run through the whole money path with nothing real behind it.
 *
 * Payment is disabled in this build, and the one database is shared with the
 * live site, so the walkthrough writes nothing: no bill, no provider event, no
 * ledger row, no open Wanted. Every figure is computed here from the rules
 * the server applies, and every screen says it is a simulation.
 */
export function PaymentWalkthrough({ seed }: { readonly seed: WalkthroughSeed }) {
  const [index, setIndex] = useState(0);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [capture, setCapture] = useState<CaptureWord | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Focus follows the reader's own navigation only, never the first render.
  const navigated = useRef(false);

  useEffect(() => {
    if (navigated.current) headingRef.current?.focus();
  }, [index]);

  function go(next: number | ((value: number) => number)) {
    navigated.current = true;
    setIndex(next);
  }

  const step = STEPS[index]!;
  const bountySen = sen(seed.startingBountySen + (outcome === "paid" ? seed.amountSen : 0));
  const extraBackerSen = sen(1000);
  const finalBountySen = sen(bountySen + extraBackerSen);
  const feeSen = platformFeeSen(finalBountySen, seed.feeRateBasisPoints);
  const netSen = sen(finalBountySen - feeSen);
  const feePercent = seed.feeRateBasisPoints / 100;
  const blocked = index >= 1 && outcome === null;
  const stopped = outcome === "failed" || outcome === "pending";
  const lastIndex = stopped ? 1 : STEPS.length - 1;

  function restart() {
    setOutcome(null);
    go(0);
  }

  return (
    <div className="walkthrough">
      <p className="walkthrough__banner" role="note">
        <strong>Simulation.</strong> No money moves and nothing is saved. Payment is switched off in
        this build; this shows what will happen once the payment provider is connected.
      </p>

      <ol className="walkthrough__steps" aria-label="Payment walkthrough steps">
        {STEPS.map((item, position) => (
          <li
            key={item.id}
            className="walkthrough__step"
            aria-current={position === index ? "step" : undefined}
            data-done={position < index ? "" : undefined}
          >
            <span className="walkthrough__step-number numeric">{position + 1}</span>
            <span>{item.label}</span>
          </li>
        ))}
      </ol>

      <section className="panel walkthrough__panel" aria-labelledby="walkthrough-heading">
        <h2 id="walkthrough-heading" ref={headingRef} tabIndex={-1}>
          {index + 1}. {step.label}
        </h2>

        {step.id === "checkout" ? (
          <>
            <p>
              {seed.mode === "publish"
                ? "Publishing a paid Wanted starts with your own first contribution. VAULTIX creates a bill with the payment provider and sends you to its checkout page."
                : "Backing a Wanted creates a bill with the payment provider and sends you to its checkout page."}
            </p>
            <div className="walkthrough__checkout" aria-label="Simulated checkout page">
              <p className="walkthrough__checkout-provider">Payment provider · simulated</p>
              <dl className="money-breakdown">
                <div className="money-breakdown__row">
                  <dt>For</dt>
                  <dd>{seed.title}</dd>
                </div>
                <div className="money-breakdown__row">
                  <dt>Contribution</dt>
                  <dd className="numeric">{formatRinggit(seed.amountSen)}</dd>
                </div>
                <div className="money-breakdown__row">
                  <dt>Provider charge</dt>
                  <dd>Added by the provider on top; not part of the bounty</dd>
                </div>
              </dl>
              <p className="dialog__note">
                The bill is valid for 30 minutes. Choose what the payer does:
              </p>
              <div className="walkthrough__choices">
                <button
                  type="button"
                  className="button button--primary"
                  onClick={() => {
                    setOutcome("paid");
                    go(1);
                  }}
                >
                  Pay {formatRinggit(seed.amountSen)} (simulated)
                </button>
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => {
                    setOutcome("failed");
                    go(1);
                  }}
                >
                  Payment fails
                </button>
                <button
                  type="button"
                  className="button button--quiet"
                  onClick={() => {
                    setOutcome("pending");
                    go(1);
                  }}
                >
                  Close the tab before paying
                </button>
              </div>
            </div>
          </>
        ) : null}

        {step.id === "return" && outcome === "paid" ? (
          <>
            <UiStatus
              kind="loading"
              heading="Waiting for the payment provider to confirm"
              message="This is the page the payer lands on. A redirect is not proof of payment: anyone can edit its address, so nothing changes yet."
            />
            <p>
              The bounty changes only in the next step, when the provider tells VAULTIX directly.
            </p>
          </>
        ) : null}
        {step.id === "return" && outcome === "failed" ? (
          <UiStatus
            kind="error"
            heading="The payment did not go through"
            message={`No charge was made and ${seed.mode === "publish" ? "no Wanted was opened. The draft stays saved and editable." : "the bounty is unchanged."} The provider's failed-payment event marks the bill failed, exactly once.`}
            action={
              <button type="button" className="button button--secondary" onClick={restart}>
                Start again
              </button>
            }
          />
        ) : null}
        {step.id === "return" && outcome === "pending" ? (
          <UiStatus
            kind="expired"
            heading="Nothing happens until the provider says so"
            message={`The bill stays pending and expires after 30 minutes. ${seed.mode === "publish" ? "The draft waits for payment and no Wanted opens." : "The bounty is unchanged."} If the payer did pay late, the provider's callback is still recorded when it arrives.`}
            action={
              <button type="button" className="button button--secondary" onClick={restart}>
                Start again
              </button>
            }
          />
        ) : null}

        {step.id === "confirm" ? (
          <>
            <p>
              The provider calls VAULTIX&rsquo;s callback. The signature and amount are checked, and
              the event is processed exactly once: a repeated callback changes nothing.
            </p>
            <table className="walkthrough__ledger">
              <caption>Ledger transaction: contribution (balanced)</caption>
              <thead>
                <tr>
                  <th scope="col">Account</th>
                  <th scope="col">Debit</th>
                  <th scope="col">Credit</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Platform cash</th>
                  <td className="numeric">{formatRinggit(seed.amountSen)}</td>
                  <td />
                </tr>
                <tr>
                  <th scope="row">Wanted escrow</th>
                  <td />
                  <td className="numeric">{formatRinggit(seed.amountSen)}</td>
                </tr>
              </tbody>
            </table>
            <p>
              {seed.mode === "publish"
                ? `The Wanted opens on the Board with a bounty of ${formatRinggit(bountySen)}. It closes in ${seed.durationDays} days, and the ${feePercent}% platform fee is fixed now and never changes for this Wanted.`
                : `The bounty rises from ${formatRinggit(seed.startingBountySen)} to ${formatRinggit(bountySen)}. The platform fee stays at the ${feePercent}% fixed when it was published.`}
            </p>
          </>
        ) : null}

        {step.id === "window" ? (
          <>
            <p>
              For one hour after publishing, the poster can correct the title and description or
              withdraw the Wanted. The window closes early when a Hunter submits a claim or someone
              else replies.
            </p>
            <p>
              Withdrawing hides the Wanted and puts every contribution, the poster&rsquo;s own
              included, in the refund queue. The platform refunds each one in full, by hand, and
              records a compensating ledger entry. No fee is taken.
            </p>
          </>
        ) : null}

        {step.id === "claims" ? (
          <>
            <p>
              Other students back it with RM1 to RM50 each. Say one more Backer adds{" "}
              {formatRinggit(extraBackerSen)}: the bounty becomes{" "}
              <strong className="numeric">{formatRinggit(finalBountySen)}</strong>.
            </p>
            <p>
              A Hunter submits a file. It goes into private quarantine; nobody else can see it, and
              automated screening only prepares evidence for a Sheriff.
            </p>
            <p>
              <button
                type="button"
                className="button button--secondary"
                onClick={() => setCapture(pickCaptureWord())}
              >
                Play the claim animation
              </button>
            </p>
          </>
        ) : null}

        {step.id === "review" ? (
          <p>
            A human Sheriff reviews the claims and approves exactly one winner; submission time only
            breaks a tie. Nothing is released or paid without that recorded approval.
          </p>
        ) : null}

        {step.id === "payout" ? (
          <>
            <p>
              Every contributor gets access to the approved resource. The Hunter&rsquo;s payout is
              the bounty less the fee, rounded down to the sen:
            </p>
            <dl className="money-breakdown" aria-label="Payout calculation">
              <div className="money-breakdown__row">
                <dt>Bounty</dt>
                <dd className="numeric">{formatRinggit(finalBountySen)}</dd>
              </div>
              <div className="money-breakdown__row">
                <dt>Platform fee ({feePercent}%)</dt>
                <dd className="numeric">−{formatRinggit(feeSen)}</dd>
              </div>
              <div className="money-breakdown__row money-breakdown__row--total">
                <dt>Paid to the Hunter</dt>
                <dd className="numeric">{formatRinggit(netSen)}</dd>
              </div>
            </dl>
            <p>
              The Owner pays the Hunter by hand and records it. That posts a balanced ledger
              transaction: escrow debited {formatRinggit(finalBountySen)}, payout credited{" "}
              {formatRinggit(netSen)}, fee revenue credited {formatRinggit(feeSen)}.
            </p>
          </>
        ) : null}

        {step.id === "refund" ? (
          <p>
            If the Wanted expires with no approved claim, every contribution goes to the refund
            queue, as with a withdrawal. The Owner refunds each Backer in full and records it, and
            the escrow is cleared by a compensating ledger entry. Nothing is ever edited or deleted.
          </p>
        ) : null}

        <div className="walkthrough__nav">
          <button
            type="button"
            className="button button--quiet"
            onClick={() => go((value) => Math.max(0, value - 1))}
            disabled={index === 0}
          >
            Back
          </button>
          {index < lastIndex ? (
            <button
              type="button"
              className="button button--primary"
              onClick={() => go((value) => value + 1)}
              disabled={blocked || index === 0}
            >
              Next
            </button>
          ) : (
            <button type="button" className="button button--secondary" onClick={restart}>
              Start again
            </button>
          )}
        </div>
      </section>

      <p className="walkthrough__exit">
        {seed.wantedId ? (
          <Link
            className="button button--ghost"
            href={`/wanted/${encodeURIComponent(seed.wantedId)}`}
          >
            <span aria-hidden="true">←</span> Back to the Wanted
          </Link>
        ) : (
          <Link className="button button--ghost" href="/board">
            <span aria-hidden="true">←</span> Back to the Wanted Board
          </Link>
        )}
      </p>

      {capture ? (
        <CapturePoster
          courseCode={seed.courseCode}
          courseName={seed.courseName}
          title={seed.title}
          bountyLabel={formatRinggit(finalBountySen)}
          hunterName="A Hunter (simulation)"
          word={capture}
          onClose={() => setCapture(null)}
          huntHref="#walkthrough-heading"
        />
      ) : null}
    </div>
  );
}
