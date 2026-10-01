import type { PaymentRecipient } from "@/contracts/payment-details";

export interface PaymentRecipientDetailsProps {
  readonly recipient: PaymentRecipient | null | undefined;
  /** "Hunter" or "Backer": who is missing details, when they are missing. */
  readonly role: string;
  readonly testMoney?: boolean;
}

/**
 * Where the Owner sends a manual payout or refund. The account number is
 * shown whole here only: the database releases it to the Owner, and only
 * while the task is pending.
 */
export function PaymentRecipientDetails({
  recipient,
  role,
  testMoney,
}: PaymentRecipientDetailsProps) {
  return (
    <>
      {testMoney ? (
        <p role="note" className="ops-alert ops-alert--warning dialog__lede">
          <strong>Test money.</strong> This was paid through the test gateway, so VAULTIX never
          received it. Do not send real money: record it with a reference such as TEST.
        </p>
      ) : null}
      {recipient ? (
        <dl className="money-breakdown" aria-label="Send to">
          <div className="money-breakdown__row">
            <dt>Bank</dt>
            <dd>{recipient.bankName}</dd>
          </div>
          <div className="money-breakdown__row">
            <dt>Account number</dt>
            <dd className="numeric">{recipient.accountNumber}</dd>
          </div>
          <div className="money-breakdown__row">
            <dt>Account holder</dt>
            <dd>{recipient.accountHolderName}</dd>
          </div>
          <div className="money-breakdown__row">
            <dt>Phone</dt>
            <dd className="numeric">{recipient.phone}</dd>
          </div>
        </dl>
      ) : (
        <p role="note" className="ops-alert ops-alert--info dialog__lede">
          No bank details are shown. Either the {role} has not added them to their profile yet, or
          only the Owner can see them.
        </p>
      )}
    </>
  );
}
