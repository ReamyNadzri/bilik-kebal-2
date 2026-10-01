import type { Metadata } from "next";
import Link from "next/link";
import { MockCheckout } from "@/components/mock-checkout";
import { UiStatus } from "@/components/ui-status";
import type { PayerBill } from "@/contracts/money";
import { readOwnPaymentBill } from "@/modules/money/loaders/money-operations";

export const metadata: Metadata = {
  title: "Checkout | VAULTIX",
};

/** A bill belongs to one payer and changes as it is paid, so this is never cached. */
export const dynamic = "force-dynamic";

/** Pending and not yet expired. The server checks again when the payer presses Pay. */
function isPayable(bill: PayerBill): boolean {
  return bill.status === "pending" && new Date(bill.expiresAt).getTime() > Date.now();
}

interface CheckoutPageProps {
  readonly params: Promise<{ bill: string }>;
}

/**
 * The test gateway's checkout (PAYMENT_MODE=mock). A ToyyibPay bill is paid
 * on ToyyibPay's own page instead; its code never reaches this route.
 */
export default async function CheckoutPage({ params }: CheckoutPageProps) {
  const { bill: billCode } = await params;
  const result = await readOwnPaymentBill(billCode);

  return (
    <div className="stack">
      <h1>Checkout</h1>
      {!result.ok ? (
        result.code === "AUTH_REQUIRED" ? (
          <UiStatus
            kind="restricted"
            heading="Sign in to pay"
            message="This bill belongs to a signed-in member. Nothing has been charged."
            action={<Link href="/sign-in">Sign in</Link>}
          />
        ) : result.code === "PAYMENT_BILL_NOT_FOUND" ? (
          <UiStatus
            kind="error"
            heading="This payment was not found"
            message="There is no bill with this link on your account. Nothing has been charged."
            action={<Link href="/board">Back to the Wanted Board</Link>}
          />
        ) : (
          <UiStatus
            kind="offline"
            heading="Checkout is unavailable"
            message="The bill could not be read. Nothing has been charged. Try again shortly."
          />
        )
      ) : result.data.provider !== "mock" ? (
        <UiStatus
          kind="error"
          heading="This bill is paid on the payment provider's page"
          message="Nothing has been charged here."
          action={<Link href={`/wanted/${result.data.wantedId}`}>Back to the Wanted</Link>}
        />
      ) : isPayable(result.data) ? (
        <MockCheckout bill={result.data} />
      ) : (
        <UiStatus
          kind={result.data.status === "paid" ? "success" : "expired"}
          heading={
            result.data.status === "paid" ? "This bill is already paid" : "This bill is closed"
          }
          message={
            result.data.status === "paid"
              ? "It was paid once and cannot be paid again."
              : "It was cancelled, failed or expired, so it cannot be paid. Nothing was charged."
          }
          action={
            <Link href={`/payment/return?bill=${encodeURIComponent(result.data.billCode)}`}>
              See the payment result
            </Link>
          }
        />
      )}
    </div>
  );
}
