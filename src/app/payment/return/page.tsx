import type { Metadata } from "next";
import Link from "next/link";
import { UiStatus } from "@/components/ui-status";

export const metadata: Metadata = {
  title: "Back from payment | VAULTIX",
};

/** The provider's redirect differs per payment, so this is never cached. */
export const dynamic = "force-dynamic";

interface PaymentReturnPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Where the payment provider sends a Backer after checkout
 * (`TOYYIBPAY_RETURN_URL`).
 *
 * A redirect is UX, never confirmation (context/architecture.md): the query
 * string can be edited by anyone, so nothing here marks a payment as paid or
 * changes a bounty. Only a verified provider callback does that. The page
 * reads the provider's own status hint solely to choose wording, and never
 * echoes the bill code or order reference back onto the page.
 */
export default async function PaymentReturnPage({ searchParams }: PaymentReturnPageProps) {
  const params = await searchParams;
  const statusHint = Array.isArray(params.status_id) ? params.status_id[0] : params.status_id;
  const providerReportedFailure = statusHint === "3";

  return (
    <div className="page-bare">
      <h1>Back from payment</h1>

      {providerReportedFailure ? (
        <UiStatus
          kind="error"
          heading="The payment did not go through"
          message="The payment page reported that checkout was not completed, so the bounty has not changed. You can try again from the Wanted request."
          action={<Link href="/board">Back to the Wanted Board</Link>}
        />
      ) : (
        <UiStatus
          kind="loading"
          heading="Waiting for the payment provider to confirm"
          message="The bounty changes only after the payment provider confirms your payment directly with VAULTIX, which can take a few minutes. You do not need to pay again. Check your notifications for the result."
          action={<Link href="/notifications">Go to notifications</Link>}
        />
      )}

      <p className="policy-note">
        Returning to this page does not confirm a payment. If money left your account but the bounty
        does not change within a day, contact support with your payment receipt.
      </p>
    </div>
  );
}
