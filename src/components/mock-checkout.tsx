"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { MoneyOperationCode, PayerBill } from "@/contracts/money";
import { formatRinggit } from "@/features/marketplace/money";
import { messageFor } from "@/features/marketplace/marketplace-messages";
import { callOperation } from "@/features/presentation/call-operation";
import { UiStatus } from "./ui-status";

export interface MockCheckoutProps {
  readonly bill: PayerBill;
}

/**
 * The test gateway's checkout page: it stands where the payment provider's
 * page will stand. Paying here sends VAULTIX a signed provider event, which is
 * verified and recorded exactly as a real one, so the bounty, the ledger and
 * the refund and payout queues change for real. No money moves.
 */
export function MockCheckout({ bill }: MockCheckoutProps) {
  const [state, setState] = useState<"idle" | "paying" | "cancelling">("idle");
  const [refusal, setRefusal] = useState<string | null>(null);
  const busy = useRef(false);

  async function finish(outcome: "paid" | "cancelled") {
    if (busy.current) return;
    busy.current = true;
    setState(outcome === "paid" ? "paying" : "cancelling");
    setRefusal(null);
    const result = await callOperation<{ returnUrl: string }, MoneyOperationCode>(
      `/api/payments/mock/${encodeURIComponent(bill.billCode)}`,
      { outcome },
      "MONEY_UNAVAILABLE",
    );
    if (result.ok) {
      window.location.assign(result.data.returnUrl);
      return;
    }
    busy.current = false;
    setState("idle");
    setRefusal(messageFor(result.code, result.message));
  }

  return (
    <section className="panel checkout" aria-labelledby="checkout-heading">
      <p className="checkout__banner" role="note">
        <strong>Test payment gateway.</strong> No real money moves. This page stands in for the
        payment provider until the real gateway is connected; everything after it is real.
      </p>

      <h2 id="checkout-heading">
        {bill.purpose === "publish" ? "Pay to publish your Wanted" : "Pay to back this Wanted"}
      </h2>

      <dl className="money-breakdown" aria-label="What you are paying">
        <div className="money-breakdown__row">
          <dt>For</dt>
          <dd>{bill.wantedTitle}</dd>
        </div>
        <div className="money-breakdown__row">
          <dt>Contribution to the bounty</dt>
          <dd className="numeric">{formatRinggit(bill.amountSen)}</dd>
        </div>
        <div className="money-breakdown__row">
          <dt>Platform fee, on top</dt>
          <dd className="numeric">+{formatRinggit(bill.feeSen)}</dd>
        </div>
        <div className="money-breakdown__row money-breakdown__row--total">
          <dt>Total to pay</dt>
          <dd className="numeric">{formatRinggit(bill.totalSen)}</dd>
        </div>
      </dl>

      <p className="dialog__note">
        The whole contribution goes to the bounty; the fee does not. If the Wanted closes without a
        winner, or is withdrawn, you are refunded the full {formatRinggit(bill.totalSen)} to the
        bank account on your profile.
      </p>

      {refusal ? (
        <UiStatus
          kind="error"
          heading="The payment was not completed"
          message={refusal}
          action={
            <Link className="button button--secondary" href="/board">
              Back to the Wanted Board
            </Link>
          }
        />
      ) : null}

      <div className="checkout__actions">
        <button
          type="button"
          className="button button--primary"
          aria-disabled={state !== "idle" ? true : undefined}
          onClick={() => void finish("paid")}
        >
          {state === "paying" ? "Paying…" : `Pay ${formatRinggit(bill.totalSen)} (test)`}
        </button>
        <button
          type="button"
          className="button button--quiet"
          aria-disabled={state !== "idle" ? true : undefined}
          onClick={() => void finish("cancelled")}
        >
          {state === "cancelling" ? "Cancelling…" : "Cancel payment"}
        </button>
      </div>
    </section>
  );
}
