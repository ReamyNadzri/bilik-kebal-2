import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { formatRinggit } from "@/features/marketplace/money";
import type { StatusPresentation } from "@/features/marketplace/status";
import {
  PAYMENT_DRAWINGS,
  type PaymentDrawingName,
} from "@/features/presentation/payments/payment-drawings";
import type {
  PaymentMethodsView,
  PaymentRequestViewModel,
  ProofVersionView,
} from "@/features/presentation/payments/payment-request-view";
import { PIXEL_PALETTE } from "@/features/presentation/pixel-drawings";
import { PixelArt } from "../pixel-art";
import { PixelIcon } from "../pixel-icon";
import { StatusStamp } from "../status-stamp";
import { UiStatus } from "../ui-status";
import { CopyAmountButton } from "./copy-amount-button";
import { PaymentProofForm } from "./payment-proof-form";

const DATE = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kuala_Lumpur",
});

export interface PaymentRequestScreenProps {
  /** Null while the saved request is being read. */
  readonly request: PaymentRequestViewModel | null;
  readonly methods: PaymentMethodsView;
  readonly connection: "online" | "offline";
  /** The member may not start new payments; what they already sent stays visible. */
  readonly restricted: boolean;
  /** Re-reads the same saved request. */
  readonly retryHref: string;
  readonly mode: "preview";
}

function requestStamp(request: PaymentRequestViewModel): StatusPresentation {
  switch (request.status) {
    case "awaiting_payment":
      return request.acceptsPayment
        ? { label: "Awaiting payment", tone: "info", emphasis: "dashed" }
        : { label: "Closed to new payments", tone: "muted", emphasis: "solid" };
    case "checking":
      return { label: "Checking", tone: "info", emphasis: "dashed" };
    case "needs_information":
      return { label: "Needs information", tone: "warning", emphasis: "doubled" };
    case "rejected":
      return { label: "Not confirmed", tone: "danger", emphasis: "solid" };
    case "exception":
      return { label: "Under review", tone: "warning", emphasis: "doubled" };
    case "confirmed":
      return { label: "Confirmed", tone: "success", emphasis: "solid" };
  }
}

const PROOF_STAMP: Record<ProofVersionView["state"], StatusPresentation> = {
  checking: { label: "Being checked", tone: "info", emphasis: "dashed" },
  needs_information: { label: "More needed", tone: "warning", emphasis: "doubled" },
  rejected: { label: "Not accepted", tone: "danger", emphasis: "solid" },
  accepted: { label: "Accepted", tone: "success", emphasis: "solid" },
};

/**
 * A state banner in the `UiStatus` treatment with the payment's own label:
 * "Checking" or "Under review" says more here than a generic "Loading".
 */
function PayNotice({
  look,
  label,
  heading,
  children,
  urgent = false,
}: {
  readonly look: "loading" | "offline" | "restricted" | "error" | "expired" | "success";
  readonly label: string;
  readonly heading: string;
  readonly children: ReactNode;
  readonly urgent?: boolean;
}) {
  return (
    <section
      className={`ui-status ui-status--${look} pay-notice`}
      role={urgent ? "alert" : "status"}
    >
      <p className="ui-status__label">{label}</p>
      <h2 className="ui-status__heading">{heading}</h2>
      <div className="ui-status__message">{children}</div>
    </section>
  );
}

function StepHead({
  drawing,
  number,
  id,
  title,
}: {
  readonly drawing: PaymentDrawingName;
  readonly number: number;
  readonly id: string;
  readonly title: string;
}) {
  return (
    <div className="pay-step__head">
      <PixelArt
        rows={PAYMENT_DRAWINGS[drawing]}
        palette={PIXEL_PALETTE}
        className="pay-step__art"
      />
      <h2 id={id} className="pay-step__title">
        <span className="pay-step__number">{number}</span>
        {title}
      </h2>
    </div>
  );
}

function StatusNotice({
  request,
  methods,
}: {
  readonly request: PaymentRequestViewModel;
  readonly methods: PaymentMethodsView;
}) {
  const unconfigured = methods.duitNowQr === null && methods.tngLink === null;

  switch (request.status) {
    case "awaiting_payment":
      if (!request.acceptsPayment) {
        return (
          <PayNotice
            look="expired"
            label="Closed"
            heading="This request no longer takes new payments"
          >
            Do not pay for it now. If you already paid, send your proof below so the payment can be
            traced to this request.
          </PayNotice>
        );
      }
      return unconfigured ? (
        <PayNotice look="restricted" label="Not available" heading="Payment is not available yet">
          The recipient&rsquo;s QR code and payment link have not been set up. Do not pay anyone for
          this request until they appear on this page.
        </PayNotice>
      ) : null;
    case "checking":
      return (
        <PayNotice look="loading" label="Checking" heading="Waiting for payment verification">
          Proof received; payment not yet confirmed. <strong>Do not pay again.</strong> This request
          stays here while it is checked, and you will be notified of the result.
        </PayNotice>
      );
    case "needs_information":
      return (
        <PayNotice look="restricted" label="Action needed" heading="More information needed" urgent>
          {request.decision?.reason} {request.decision?.nextStep}
        </PayNotice>
      );
    case "rejected":
      return (
        <PayNotice look="error" label="Not confirmed" heading="Payment not confirmed" urgent>
          {request.decision?.reason} {request.decision?.nextStep}
        </PayNotice>
      );
    case "exception":
      return (
        <PayNotice look="restricted" label="Under review" heading="Your payment needs resolving">
          A payment for this request needs a manual check before it can be credited, so it is not
          credited yet. <strong>You do not need to pay again.</strong> This request stays here and
          you will be told the outcome.
        </PayNotice>
      );
    case "confirmed":
      return (
        <PayNotice
          look="success"
          label="Confirmed"
          heading={
            request.purpose === "publish"
              ? "Payment confirmed. Your Wanted is published."
              : "Contribution confirmed."
          }
        >
          {request.purpose === "publish"
            ? `“${request.wantedTitle}” is on the Board with a bounty of ${formatRinggit(request.charge.amountSen)}.`
            : `${formatRinggit(request.charge.amountSen)} was added to the bounty of “${request.wantedTitle}”.`}
        </PayNotice>
      );
  }
}

function AmountStep({
  request,
  number,
  open,
  canCopy,
}: {
  readonly request: PaymentRequestViewModel;
  readonly number: number;
  /** Whether the request still takes payment: only then is this an instruction. */
  readonly open: boolean;
  readonly canCopy: boolean;
}) {
  const { charge } = request;

  return (
    <section className="pay-step" aria-labelledby="pay-amount-heading">
      <StepHead
        drawing="coins"
        number={number}
        id="pay-amount-heading"
        title={open ? "Amount to enter" : "Amount requested"}
      />

      <div className="pay-amount">
        <div className="pay-amount__plate">
          <p className="pay-amount__label">{open ? "Type exactly" : "Requested"}</p>
          <p className="pay-amount__total">{formatRinggit(charge.totalSen, { cents: "always" })}</p>
        </div>
        {canCopy ? <CopyAmountButton amount={charge.totalSen} /> : null}
      </div>

      <dl className="money-breakdown" aria-label="How the amount is made up">
        <div className="money-breakdown__row">
          <dt>Contribution to the bounty</dt>
          <dd className="numeric">{formatRinggit(charge.amountSen, { cents: "always" })}</dd>
        </div>
        <div className="money-breakdown__row">
          <dt>Platform fee, on top</dt>
          <dd className="numeric">+{formatRinggit(charge.feeSen, { cents: "always" })}</dd>
        </div>
        <div className="money-breakdown__row money-breakdown__row--total">
          <dt>{open ? "Amount to enter" : "Total requested"}</dt>
          <dd className="numeric">{formatRinggit(charge.totalSen, { cents: "always" })}</dd>
        </div>
      </dl>

      {open ? (
        <p className="pay-step__note">
          The QR code and the payment link do not fill in the amount or this request&rsquo;s
          reference. Type the amount yourself. A different amount cannot be confirmed automatically.
        </p>
      ) : null}
    </section>
  );
}

function MethodsStep({
  methods,
  number,
}: {
  readonly methods: PaymentMethodsView;
  readonly number: number;
}) {
  const recipient = methods.recipientName;

  return (
    <section className="pay-step" aria-labelledby="pay-methods-heading">
      <StepHead
        drawing="phone"
        number={number}
        id="pay-methods-heading"
        title="Choose how to pay"
      />

      {recipient === null ? null : (
        <p className="pay-recipient">
          Recipient: <strong>{recipient}</strong>. Check this name in your app before you confirm.
        </p>
      )}

      <div className="pay-methods">
        <article className="pay-method" aria-labelledby="pay-method-duitnow">
          <Image
            className="pay-method__logo"
            src="/payments/duitnow-qr-logo.png"
            alt=""
            width={60}
            height={65}
          />
          <h3 id="pay-method-duitnow" className="pay-method__title">
            Scan the DuitNow QR
          </h3>
          {methods.duitNowQr === null ? (
            <p className="pay-method__missing">Merchant QR not supplied</p>
          ) : (
            <figure className="pay-qr">
              <div className="pay-qr__frame">
                {/* eslint-disable-next-line @next/next/no-img-element -- the Owner's payment code, served as supplied: never resampled or recompressed */}
                <img
                  className="pay-qr__image"
                  src={methods.duitNowQr.imageSrc}
                  alt={`DuitNow QR code for ${recipient ?? "the recipient"}`}
                  width={240}
                  height={240}
                />
              </div>
              {recipient === null ? null : (
                <figcaption className="pay-qr__caption">{recipient}</figcaption>
              )}
            </figure>
          )}
          <p className="pay-method__hint">
            Scan it with a banking or e-wallet app that accepts DuitNow QR. On this phone? Use the
            payment link instead.
          </p>
        </article>

        <article className="pay-method" aria-labelledby="pay-method-tng">
          <Image
            className="pay-method__logo"
            src="/payments/tng-ewallet-logo.png"
            alt=""
            width={56}
            height={56}
          />
          <h3 id="pay-method-tng" className="pay-method__title">
            Pay with Touch &rsquo;n Go eWallet
          </h3>
          {methods.tngLink === null ? (
            <p className="pay-method__missing">Payment link not configured</p>
          ) : (
            <a
              className="button button--primary button--block"
              href={methods.tngLink.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open payment link
              <PixelIcon name="link" className="pay-icon" />
              <span className="visually-hidden"> (opens in a new tab)</span>
            </a>
          )}
          <p className="pay-method__hint">
            Opens Touch &rsquo;n Go&rsquo;s payment page. Enter the amount above, then come back
            here to send your proof.
          </p>
        </article>
      </div>

      <p className="pay-step__note">
        Opening the app or coming back to this page does not confirm a payment.
      </p>
    </section>
  );
}

function ProofHistory({ proofs }: { readonly proofs: readonly ProofVersionView[] }) {
  return (
    <section className="pay-history" aria-labelledby="pay-history-heading">
      <h2 id="pay-history-heading" className="pay-history__heading">
        Your screenshots
      </h2>
      <ol className="pay-history__list">
        {proofs.map((proof) => (
          <li key={proof.id} className="pay-history__item">
            <span>
              Version {proof.version}, sent{" "}
              <time dateTime={proof.submittedAt}>{DATE.format(new Date(proof.submittedAt))}</time>
            </span>
            <StatusStamp presentation={PROOF_STAMP[proof.state]} context="Screenshot" />
          </li>
        ))}
      </ol>
    </section>
  );
}

function Receipt({ request }: { readonly request: PaymentRequestViewModel }) {
  const { receipt, charge } = request;
  if (receipt === null) return null;

  return (
    <section className="pay-step pay-receipt" aria-labelledby="pay-receipt-heading">
      <div className="pay-step__head">
        <PixelArt
          rows={PAYMENT_DRAWINGS.receipt}
          palette={PIXEL_PALETTE}
          className="pay-step__art"
        />
        <h2 id="pay-receipt-heading" className="pay-step__title">
          Receipt {receipt.receiptNumber}
        </h2>
      </div>

      <dl className="money-breakdown" aria-label="Receipt">
        <div className="money-breakdown__row">
          <dt>Confirmed</dt>
          <dd>
            <time dateTime={receipt.confirmedAt}>{DATE.format(new Date(receipt.confirmedAt))}</time>
          </dd>
        </div>
        <div className="money-breakdown__row">
          <dt>Request</dt>
          <dd>{request.reference}</dd>
        </div>
        <div className="money-breakdown__row">
          <dt>Contribution to the bounty</dt>
          <dd className="numeric">{formatRinggit(charge.amountSen, { cents: "always" })}</dd>
        </div>
        <div className="money-breakdown__row">
          <dt>Platform fee</dt>
          <dd className="numeric">{formatRinggit(charge.feeSen, { cents: "always" })}</dd>
        </div>
        <div className="money-breakdown__row money-breakdown__row--total">
          <dt>Total paid</dt>
          <dd className="numeric">{formatRinggit(charge.totalSen, { cents: "always" })}</dd>
        </div>
      </dl>

      <Link className="button button--secondary" href={`/wanted/${request.wantedId}`}>
        Open the Wanted
      </Link>
    </section>
  );
}

function proofHeading(request: PaymentRequestViewModel): string {
  if (request.status === "needs_information") return "Send a clearer screenshot";
  if (request.status === "rejected") return "Send the correct screenshot";
  if (!request.acceptsPayment) return "Already paid? Send your proof";
  return "Send your proof";
}

/**
 * One saved payment request: what to pay, where, and what has happened since.
 *
 * Presentation only. Every amount, status and decision comes from the saved
 * request; nothing here is read from the address bar, and no state on this
 * screen can confirm, credit or publish anything (draft design §4 and §5).
 * Payment instructions appear only while the request is open to payment, so a
 * member who has already paid is never asked to pay again.
 */
export function PaymentRequestScreen({
  request,
  methods,
  connection,
  restricted,
  retryHref,
  mode,
}: PaymentRequestScreenProps) {
  if (request === null) {
    return (
      <div className="pay" aria-busy="true">
        <UiStatus
          kind="loading"
          heading="Loading your payment request"
          message="Reading the saved request. If you already paid, you do not need to pay again."
        />
      </div>
    );
  }

  const offline = connection === "offline";
  const open = request.status === "awaiting_payment" && request.acceptsPayment;
  const configured = methods.duitNowQr !== null || methods.tngLink !== null;
  const showMethods = open && !restricted;
  const showProof =
    request.status === "awaiting_payment" ||
    request.status === "needs_information" ||
    request.status === "rejected";
  const nextVersion = Math.max(0, ...request.proofs.map((proof) => proof.version)) + 1;

  let step = 0;

  return (
    <article className="pay" aria-labelledby="pay-heading">
      <header className="pay__head">
        <p className="pay__eyebrow">Payment request {request.reference}</p>
        <h1 id="pay-heading" className="pay__title">
          {request.status === "confirmed"
            ? request.purpose === "publish"
              ? "Payment for your Wanted"
              : "Your contribution"
            : request.purpose === "publish"
              ? "Pay to publish your Wanted"
              : "Back this Wanted"}
        </h1>
        <p className="pay__for">
          For <strong>{request.wantedTitle}</strong>
        </p>
        <StatusStamp presentation={requestStamp(request)} context="Payment" />
      </header>

      {offline ? (
        <PayNotice look="offline" label="Offline" heading="You are offline">
          This request is saved. Nothing has been confirmed or cancelled because the connection
          dropped. <Link href={retryHref}>Check again</Link> when you are back online.
        </PayNotice>
      ) : null}

      {restricted ? (
        <PayNotice
          look="restricted"
          label="Restricted"
          heading="New payments are paused on your account"
          urgent
        >
          You cannot start a new payment. Anything you already sent for this request stays here, and
          you can still send its proof.
        </PayNotice>
      ) : null}

      <StatusNotice request={request} methods={methods} />

      {request.status === "confirmed" ? (
        <Receipt request={request} />
      ) : (
        <AmountStep
          request={request}
          number={++step}
          open={showMethods}
          canCopy={showMethods && configured}
        />
      )}

      {showMethods ? <MethodsStep methods={methods} number={++step} /> : null}

      {showProof ? (
        <section className="pay-step" aria-labelledby="pay-proof-step-heading">
          <StepHead
            drawing="proof"
            number={++step}
            id="pay-proof-step-heading"
            title="Proof of payment"
          />
          <PaymentProofForm
            heading={proofHeading(request)}
            nextVersion={nextVersion}
            offline={offline}
            mode={mode}
          />
        </section>
      ) : null}

      {request.proofs.length > 0 ? <ProofHistory proofs={request.proofs} /> : null}

      <p className="policy-note">
        Keep this request&rsquo;s reference, <strong>{request.reference}</strong>, for support. You
        can close this page and come back to the same request; money you already sent never needs a
        new one.
      </p>
    </article>
  );
}
