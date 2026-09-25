export const EMAIL_DELIVERY_HINT =
  "Check your inbox and your Spam or Junk folder. If our email is there, mark it Not spam so future updates reach your inbox.";

/** Deliverability guidance shown wherever an action sends an email. */
export function EmailDeliveryHint() {
  return (
    <p role="note" className="auth-form__intro">
      {EMAIL_DELIVERY_HINT}
    </p>
  );
}
