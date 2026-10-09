import { chargeBreakdown, PLATFORM_FEE_BASIS_POINTS } from "@/contracts/money";
import type { PaymentMethodsView, PaymentRequestViewModel } from "./payment-request-view";

/**
 * Development fixtures for the direct payment request screen.
 *
 * The requests, people and amounts are invented. The payment methods are the
 * Owner's real ones (`SUPPLIED_METHODS`), so the preview can be tried with a
 * real app, but nothing here creates a request or records a payment, and the
 * route that renders it is not found in a production build. In the connected
 * slice the methods come from server configuration instead (draft design §4,
 * D8). Amounts use the published fee rule, still the baseline pending D1.
 */

export const PAYMENT_PREVIEW_STATES = [
  "ready",
  "unconfigured",
  "loading",
  "checking",
  "needs-information",
  "rejected",
  "exception",
  "confirmed-publish",
  "confirmed-back",
  "closed",
  "restricted",
  "offline",
] as const;

export type PaymentPreviewState = (typeof PAYMENT_PREVIEW_STATES)[number];

export function isPaymentPreviewState(value: unknown): value is PaymentPreviewState {
  return PAYMENT_PREVIEW_STATES.some((state) => state === value);
}

/**
 * The Owner's supplied methods (user, 2026-10-10): the DuitNow QR image as
 * supplied (cropped only, still decoding to the same static merchant payload)
 * and the Touch 'n Go payment link. These are real destinations: paying
 * through them moves real money, and this preview records nothing.
 */
export const SUPPLIED_METHODS: PaymentMethodsView = {
  recipientName: "AF ECommerce",
  duitNowQr: { imageSrc: "/payments/duitnow-qr.png" },
  tngLink: { href: "https://payment.tngdigital.com.my/sc/bDLn8K4vWL" },
  configVersion: "supplied-2026-10-10",
};

export const UNCONFIGURED_METHODS: PaymentMethodsView = {
  recipientName: null,
  duitNowQr: null,
  tngLink: null,
  configVersion: null,
};

const PUBLISH_REQUEST: PaymentRequestViewModel = {
  id: "00000000-0000-4000-8000-0000000000a1",
  reference: "VX-PAY-7Q2K-4M",
  purpose: "publish",
  status: "awaiting_payment",
  wantedId: "00000000-0000-4000-8000-000000000009",
  wantedTitle: "Past year papers for MAT183",
  charge: chargeBreakdown(1000, PLATFORM_FEE_BASIS_POINTS),
  acceptsPayment: true,
  proofs: [],
  decision: null,
  receipt: null,
};

const BACK_REQUEST: PaymentRequestViewModel = {
  ...PUBLISH_REQUEST,
  id: "00000000-0000-4000-8000-0000000000b2",
  reference: "VX-PAY-3F9D-8T",
  purpose: "back",
  wantedTitle: "Lab report template for CHM256",
  charge: chargeBreakdown(2000, PLATFORM_FEE_BASIS_POINTS),
};

const FIRST_PROOF = {
  id: "proof-1",
  version: 1,
  submittedAt: "2026-10-09T07:42:00.000Z",
} as const;

export interface PaymentPreviewFixture {
  readonly request: PaymentRequestViewModel | null;
  readonly methods: PaymentMethodsView;
  readonly connection: "online" | "offline";
  readonly restricted: boolean;
}

export function paymentPreviewFixture(state: PaymentPreviewState): PaymentPreviewFixture {
  const base = { methods: SUPPLIED_METHODS, connection: "online", restricted: false } as const;

  switch (state) {
    case "ready":
      return { ...base, request: PUBLISH_REQUEST };
    case "unconfigured":
      return { ...base, request: PUBLISH_REQUEST, methods: UNCONFIGURED_METHODS };
    case "loading":
      return { ...base, request: null };
    case "checking":
      return {
        ...base,
        request: {
          ...PUBLISH_REQUEST,
          status: "checking",
          proofs: [{ ...FIRST_PROOF, state: "checking" }],
        },
      };
    case "needs-information":
      return {
        ...base,
        request: {
          ...PUBLISH_REQUEST,
          status: "needs_information",
          proofs: [{ ...FIRST_PROOF, state: "needs_information" }],
          decision: {
            reason: "The payment reference is not readable.",
            nextStep: "Upload a clearer screenshot to this request. You do not need to pay again.",
          },
        },
      };
    case "rejected":
      return {
        ...base,
        request: {
          ...PUBLISH_REQUEST,
          status: "rejected",
          proofs: [
            {
              ...FIRST_PROOF,
              id: "proof-2",
              version: 2,
              submittedAt: "2026-10-09T08:15:00.000Z",
              state: "rejected",
            },
            { ...FIRST_PROOF, state: "needs_information" },
          ],
          decision: {
            reason: "This screenshot does not show a payment to the configured recipient.",
            nextStep:
              "If you transferred money, send the correct screenshot to this request or contact payment support with this request's reference.",
          },
        },
      };
    case "exception":
      return {
        ...base,
        request: {
          ...PUBLISH_REQUEST,
          status: "exception",
          proofs: [{ ...FIRST_PROOF, state: "checking" }],
        },
      };
    case "confirmed-publish":
      return {
        ...base,
        request: {
          ...PUBLISH_REQUEST,
          status: "confirmed",
          acceptsPayment: false,
          proofs: [{ ...FIRST_PROOF, state: "accepted" }],
          receipt: { receiptNumber: "VX-R-000184", confirmedAt: "2026-10-09T07:51:00.000Z" },
        },
      };
    case "confirmed-back":
      return {
        ...base,
        request: {
          ...BACK_REQUEST,
          status: "confirmed",
          acceptsPayment: false,
          proofs: [{ ...FIRST_PROOF, state: "accepted" }],
          receipt: { receiptNumber: "VX-R-000185", confirmedAt: "2026-10-09T07:53:00.000Z" },
        },
      };
    case "closed":
      return { ...base, request: { ...BACK_REQUEST, acceptsPayment: false } };
    case "restricted":
      return { ...base, request: PUBLISH_REQUEST, restricted: true };
    case "offline":
      return { ...base, request: PUBLISH_REQUEST, connection: "offline" };
  }
}
