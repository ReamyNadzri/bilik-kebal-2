import type { Metadata } from "next";
import Link from "next/link";
import { UiStatus } from "@/components/ui-status";
import type { PayerBill } from "@/contracts/money";
import { formatRinggit } from "@/features/marketplace/money";
import { readOwnPaymentBill } from "@/modules/money/loaders/money-operations";

export const metadata: Metadata = {
  title: "Back from payment | VAULTIX",
};

/** The provider's redirect differs per payment, so this is never cached. */
export const dynamic = "force-dynamic";

interface PaymentReturnPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** The payer's own bill as the database records it, or null when it cannot be read. */
async function readBill(billCode: string | undefined): Promise<PayerBill | null> {
  if (!billCode) return null;
  try {
    const result = await readOwnPaymentBill(billCode);
    return result.ok ? result.data : null;
  } catch {
    return null;
  }
}

function PaidBill({ bill }: { readonly bill: PayerBill }) {
  return (
    <UiStatus
      kind="success"
      heading={
        bill.purpose === "publish" ? "Paid: your Wanted is on the Board" : "Paid: the bounty rose"
      }
      message={`The payment was confirmed and recorded. ${formatRinggit(bill.amountSen)} went to the bounty of “${bill.wantedTitle}”; you paid ${formatRinggit(bill.totalSen)} including the ${formatRinggit(bill.feeSen)} platform fee.${bill.provider === "mock" ? " This was a test payment: no real money moved." : ""}`}
      action={<Link href={`/wanted/${bill.wantedId}`}>Open the Wanted</Link>}
    />
  );
}

function UnpaidBill({ bill }: { readonly bill: PayerBill }) {
  return (
    <UiStatus
      kind="error"
      heading="The payment did not go through"
      message={
        bill.purpose === "publish"
          ? "Nothing was charged and your request was not published. It is kept as a private draft; post it again when you are ready."
          : "Nothing was charged and the bounty has not changed. You can try again from the Wanted."
      }
      action={
        bill.purpose === "publish" ? (
          <Link href="/wanted/new">Post a Wanted</Link>
        ) : (
          <Link href={`/wanted/${bill.wantedId}`}>Back to the Wanted</Link>
        )
      }
    />
  );
}

/**
 * Where the payment provider sends a payer after checkout
 * (`TOYYIBPAY_RETURN_URL`, or the test gateway's own redirect).
 *
 * A redirect is UX, never confirmation (context/architecture.md): the query
 * string can be edited by anyone. What this page reports comes from the
 * payer's own bill in the database, which only a verified provider event
 * marks paid. The provider's own status hint is used only when the bill
 * cannot be read, and only to choose wording. The bill code and order
 * reference are never echoed onto the page.
 */
export default async function PaymentReturnPage({ searchParams }: PaymentReturnPageProps) {
  const params = await searchParams;
  const bill = await readBill(first(params.bill) ?? first(params.billcode));
  const providerReportedFailure = first(params.status_id) === "3";

  return (
    <div className="stack">
      <h1>Back from payment</h1>

      {bill?.status === "paid" ? (
        <PaidBill bill={bill} />
      ) : bill?.status === "failed" || bill?.status === "expired" ? (
        <UnpaidBill bill={bill} />
      ) : providerReportedFailure && bill === null ? (
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
          message="The bounty changes only after the payment provider confirms your payment directly with VAULTIX, which can take a few minutes. You do not need to pay again. Reload this page or check your notifications for the result."
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
