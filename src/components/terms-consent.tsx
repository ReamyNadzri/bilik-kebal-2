import Link from "next/link";

export const TERMS_CONSENT_ERROR =
  "Tick the box to confirm you are 18 or older and agree to the Terms of Use and the Privacy Notice.";

/**
 * The one agreement every member gives: 18 or older, Terms of Use and Privacy
 * Notice. Shared by sign-up and the acceptance screen so the words cannot
 * drift apart. The documents open in a new tab so a half-filled form is kept.
 */
export function TermsConsent({
  id,
  checked,
  onChange,
  error,
}: {
  readonly id: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly error?: string | undefined;
}) {
  const errorId = `${id}-error`;
  return (
    <div className="terms-consent">
      {error === undefined ? null : (
        <p className="form-field__error" id={errorId}>
          {error}
        </p>
      )}
      <label className={`consent${error === undefined ? "" : " consent--attention"}`} htmlFor={id}>
        <input
          id={id}
          name={id}
          type="checkbox"
          checked={checked}
          aria-invalid={error === undefined ? undefined : true}
          aria-describedby={error === undefined ? undefined : errorId}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span>
          I am 18 or older, and I agree to the{" "}
          <Link href="/terms" target="_blank" rel="noopener">
            Terms of Use<span className="visually-hidden"> (opens in a new tab)</span>
          </Link>{" "}
          and the{" "}
          <Link href="/privacy" target="_blank" rel="noopener">
            Privacy Notice<span className="visually-hidden"> (opens in a new tab)</span>
          </Link>
          .
        </span>
      </label>
    </div>
  );
}
