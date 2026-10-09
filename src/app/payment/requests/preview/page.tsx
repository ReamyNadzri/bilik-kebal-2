import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FixtureNotice } from "@/components/fixture-notice";
import { PaymentRequestScreen } from "@/components/payments/payment-request-screen";
import {
  isPaymentPreviewState,
  PAYMENT_PREVIEW_STATES,
  paymentPreviewFixture,
  type PaymentPreviewState,
} from "@/features/presentation/payments/payment-request-fixtures";

export const metadata: Metadata = {
  title: "Payment request preview | VAULTIX",
};

/** Rendered per request so the production guard runs per request (see `/wanted/new/preview`). */
export const dynamic = "force-dynamic";

interface PaymentRequestPreviewPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const STATE_LABEL: Record<PaymentPreviewState, string> = {
  ready: "Ready to pay",
  unconfigured: "Methods not set up",
  loading: "Loading",
  checking: "Proof sent, checking",
  "needs-information": "Needs information",
  rejected: "Not confirmed",
  exception: "Funds under review",
  "confirmed-publish": "Confirmed, published",
  "confirmed-back": "Confirmed, backed",
  closed: "Closed to payment",
  restricted: "Account restricted",
  offline: "Offline",
};

/**
 * Development-only harness for the direct payment request screen of the draft
 * design (`docs/superpowers/specs/2026-10-09-vaultix-direct-payment-draft-design.md`).
 *
 * The design and its contracts are not approved or published, so there is no
 * live `/payment/requests/[requestId]` route yet. This page renders every
 * screen state from fixtures. It creates no request, uploads nothing and
 * records nothing, and its only payment method is a labelled sample whose link
 * cannot resolve: no real QR code or payment link is in this code. The `state`
 * parameter picks a fixture; on the live screen nothing is read from the
 * address bar. In a production build it renders the not-found page.
 */
export default async function PaymentRequestPreviewPage({
  searchParams,
}: PaymentRequestPreviewPageProps) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const requested = (await searchParams).state;
  const state: PaymentPreviewState = isPaymentPreviewState(requested) ? requested : "ready";
  const fixture = paymentPreviewFixture(state);

  return (
    <div className="stack">
      <FixtureNotice screen="The payment request on this development preview" />

      <nav className="pay-preview-states" aria-label="Preview states">
        <ul>
          {PAYMENT_PREVIEW_STATES.map((option) => (
            <li key={option}>
              <Link
                href={`/payment/requests/preview?state=${option}`}
                aria-current={option === state ? "page" : undefined}
              >
                {STATE_LABEL[option]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <PaymentRequestScreen
        request={fixture.request}
        methods={fixture.methods}
        connection={fixture.connection}
        restricted={fixture.restricted}
        retryHref={`/payment/requests/preview?state=${state}`}
        mode="preview"
      />
    </div>
  );
}
