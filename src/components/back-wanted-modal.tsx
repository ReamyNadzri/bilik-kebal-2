"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { MoneyOperationCode } from "@/contracts/money";
import type { WantedDetail } from "@/features/marketplace/types";
import { formatRinggit, sen, type Sen } from "@/features/marketplace/money";
import { callOperation } from "@/features/presentation/call-operation";
import { UiStatus, type UiStatusKind } from "./ui-status";

export interface BackWantedModalProps {
  readonly wanted: WantedDetail;
  readonly onClose: () => void;
}

const PRESET_AMOUNTS: readonly { label: string; amountSen: Sen }[] = [
  { label: "RM 1", amountSen: sen(100) },
  { label: "RM 5", amountSen: sen(500) },
  { label: "RM 10", amountSen: sen(1000) },
  { label: "RM 20", amountSen: sen(2000) },
  { label: "RM 50", amountSen: sen(5000) },
];

interface Refusal {
  readonly kind: UiStatusKind;
  readonly heading: string;
  readonly message: string;
  readonly action?: { readonly href: string; readonly label: string };
}

const NO_CHARGE = "No charge was made and the bounty is unchanged.";

/**
 * What a refused contribution tells the Backer. Every branch says plainly that
 * nothing was charged, because the one misreading with a real cost is a
 * student believing they paid when they did not, or the reverse.
 */
function describeRefusal(code: MoneyOperationCode): Refusal {
  switch (code) {
    case "PAYMENT_DISABLED":
    case "PAYMENT_UNAVAILABLE":
      return {
        kind: "offline",
        heading: "Online payment is not open yet",
        message: `The payment gateway is still being connected, so backing a Wanted is not available in this build. ${NO_CHARGE}`,
      };
    case "AUTH_REQUIRED":
      return {
        kind: "restricted",
        heading: "Sign in again to back this Wanted",
        message: `Your session has ended. ${NO_CHARGE}`,
        action: { href: "/sign-in", label: "Sign in" },
      };
    case "EMAIL_NOT_VERIFIED":
    case "INSTITUTION_VERIFICATION_REQUIRED":
      return {
        kind: "restricted",
        heading: "Institution verification is needed",
        message: `Funding a bounty needs a verified institution account. ${NO_CHARGE}`,
        action: { href: "/profile/institution-verification", label: "Verify your institution" },
      };
    case "ACCOUNT_RESTRICTED":
      return {
        kind: "restricted",
        heading: "Your account cannot fund bounties right now",
        message: `A restriction on your account blocks contributions. ${NO_CHARGE}`,
        action: { href: "/profile", label: "View your profile" },
      };
    case "WANTED_NOT_FOUND":
      return {
        kind: "expired",
        heading: "This Wanted is no longer open",
        message: `It may have closed or been fulfilled. ${NO_CHARGE}`,
      };
    case "AMOUNT_OUT_OF_RANGE":
      return {
        kind: "error",
        heading: "Choose an amount from RM1 to RM50",
        message: `Each contribution must be between RM1 and RM50. ${NO_CHARGE}`,
      };
    default:
      return {
        kind: "offline",
        heading: "Payment could not be prepared",
        message: `Something went wrong before checkout started. ${NO_CHARGE} Try again shortly.`,
      };
  }
}

/**
 * Modal dialog for institution-verified students to add a RM1–RM50 backer
 * contribution to an open Wanted request.
 *
 * - Money stays integer sen (100–5,000) end to end.
 * - Nothing here confirms a payment. Success is a redirect to the provider;
 *   only a verified provider callback ever changes the bounty.
 * - Until the gateway is connected, the dialog says so before the Backer
 *   chooses an amount, and every refusal says no charge was made.
 */
export function BackWantedModal({ wanted, onClose }: BackWantedModalProps) {
  const [selectedSen, setSelectedSen] = useState<Sen>(sen(500));
  const [status, setStatus] = useState<"idle" | "submitting">("idle");
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function handleProceed() {
    setStatus("submitting");

    const result = await callOperation<{ paymentUrl?: string }, MoneyOperationCode>(
      `/api/marketplace/wanted/${encodeURIComponent(wanted.id)}/contribution`,
      { amountSen: selectedSen },
      "PAYMENT_UNAVAILABLE",
    );

    if (result.ok && result.data?.paymentUrl) {
      window.location.assign(result.data.paymentUrl);
      return;
    }

    setStatus("idle");
    setRefusal(describeRefusal(result.ok ? "PAYMENT_UNAVAILABLE" : result.code));
  }

  const projectedTotalSen = sen(wanted.grossBountySen + selectedSen);
  const submitting = status === "submitting";

  return (
    <div
      className="dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="back-wanted-title"
      ref={dialogRef}
      tabIndex={-1}
    >
      <div className="dialog">
        <div className="dialog__head">
          <h2 id="back-wanted-title" className="dialog__title">
            Back this Wanted
          </h2>
          <button
            type="button"
            className="button button--quiet dialog__close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        {refusal !== null ? (
          <UiStatus
            kind={refusal.kind}
            heading={refusal.heading}
            message={refusal.message}
            action={
              <span className="dialog__actions">
                {refusal.action ? (
                  <Link className="button button--secondary" href={refusal.action.href}>
                    {refusal.action.label}
                  </Link>
                ) : null}
                <button type="button" className="button button--primary" onClick={onClose}>
                  Close
                </button>
              </span>
            }
          />
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleProceed();
            }}
          >
            <p className="policy-note dialog__lede">
              Add to the bounty for <strong>{wanted.title}</strong> ({wanted.courseCode}). Each
              contribution is RM1 to RM50.
            </p>

            <fieldset className="draft-form__fieldset">
              <legend className="draft-form__legend">Select contribution amount</legend>
              <div className="draft-form__choices">
                {PRESET_AMOUNTS.map(({ label, amountSen }) => (
                  <label key={amountSen} className="draft-form__choice">
                    <input
                      type="radio"
                      name="backer-amount"
                      value={amountSen}
                      checked={selectedSen === amountSen}
                      onChange={() => setSelectedSen(amountSen)}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <dl className="money-breakdown" aria-label="Bounty after your contribution">
              <div className="money-breakdown__row">
                <dt>Current bounty</dt>
                <dd>{formatRinggit(wanted.grossBountySen)}</dd>
              </div>
              <div className="money-breakdown__row">
                <dt>Your contribution</dt>
                <dd>+{formatRinggit(selectedSen)}</dd>
              </div>
              <div className="money-breakdown__row money-breakdown__row--total">
                <dt>New bounty total</dt>
                <dd>{formatRinggit(projectedTotalSen)}</dd>
              </div>
            </dl>

            <p className="dialog__note">
              The payment provider adds its own charge on top of your contribution. The bounty only
              changes after the provider confirms your payment.
            </p>

            <div className="dialog__actions">
              <button
                type="button"
                className="button button--quiet"
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </button>
              <button type="submit" className="button button--primary" disabled={submitting}>
                {submitting
                  ? "Connecting to payment…"
                  : `Proceed to payment of ${formatRinggit(selectedSen)}`}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
