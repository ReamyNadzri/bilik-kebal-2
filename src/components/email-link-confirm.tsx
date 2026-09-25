import Link from "next/link";
import { UiStatus } from "@/components/ui-status";

export interface EmailLinkConfirmProps {
  tokenHash: string | null;
  type: "email" | "recovery" | null;
  next: string | null;
  unavailable: boolean;
}

/**
 * Opening the emailed link does nothing on its own: email security scanners
 * (for example Microsoft Defender Safe Links on student mailboxes) open links
 * before people do, so the one-time token is spent only when this form is sent.
 * A plain form POST works without JavaScript and by keyboard.
 */
export function EmailLinkConfirm({ tokenHash, type, next, unavailable }: EmailLinkConfirmProps) {
  if (!tokenHash || !type) {
    return (
      <UiStatus
        kind="error"
        heading="This link cannot be used"
        message="It is incomplete or was changed. Request a new link and open the newest email."
        action={
          <p className="auth-form__links">
            <Link href="/verify-email">Request a new link</Link>
            <Link href="/recover">Reset your password</Link>
          </p>
        }
      />
    );
  }

  const isRecovery = type === "recovery";

  return (
    <form className="auth-form" method="post" action="/api/auth/confirm">
      {unavailable ? (
        <UiStatus
          kind="offline"
          heading="We could not reach the sign-in service"
          message="Your link has not been used. Try the button again in a moment."
        />
      ) : null}

      <p>
        {isRecovery
          ? "Press the button to continue to choosing a new password."
          : "Press the button to confirm this email address belongs to you."}
      </p>
      <p className="auth-form__intro">
        We ask for this press because some email security scanners open links automatically, which
        would otherwise use up your one-time link.
      </p>

      <input type="hidden" name="token_hash" value={tokenHash} />
      <input type="hidden" name="type" value={type} />
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <button className="auth-form__submit" type="submit">
        {isRecovery ? "Reset my password" : "Confirm my email"}
      </button>
    </form>
  );
}
