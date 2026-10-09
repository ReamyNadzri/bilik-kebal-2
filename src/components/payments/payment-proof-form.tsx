"use client";

import { useRef, useState, type FormEvent } from "react";
import { ErrorSummary, type FieldError } from "../error-summary";
import { FormField } from "../form-field";
import { PixelIcon } from "../pixel-icon";

/**
 * PNG and JPEG screenshots are the draft's proposed proof formats; the size,
 * pixel limits and any other format wait on D4, so none is stated or enforced
 * here beyond the type. The server and the isolated scanner decide for real.
 */
const PROOF_TYPES = ["image/png", "image/jpeg"] as const;

const FILE_ID = "payment-proof-file";

export interface PaymentProofFormProps {
  readonly heading: string;
  /** The version the next screenshot becomes. Earlier ones are kept. */
  readonly nextVersion: number;
  /** While offline the form stays readable but cannot be sent. */
  readonly offline: boolean;
  /**
   * Only `preview` exists until the backend publishes proof uploads: the form
   * validates, then says plainly that nothing was sent.
   */
  readonly mode: "preview";
}

/**
 * The member's screenshot, plus the reference and time if their app shows
 * them. Submission is evidence for checking, never a confirmation.
 *
 * The chosen file stays in memory only; nothing is written to browser storage
 * (draft design §4: no private proof in browser storage).
 */
export function PaymentProofForm({ heading, nextVersion, offline }: PaymentProofFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [sent, setSent] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);

  const fileError = errors.find((error) => error.fieldId === FILE_ID)?.message;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (offline) return;

    const found: FieldError[] = [];
    if (file === null) {
      found.push({ fieldId: FILE_ID, message: "Choose a screenshot of your payment." });
    } else if (!PROOF_TYPES.some((type) => type === file.type)) {
      found.push({ fieldId: FILE_ID, message: "Choose a PNG or JPEG screenshot." });
    }

    setErrors(found);
    setSent(found.length === 0);
    if (found.length > 0) {
      requestAnimationFrame(() => summaryRef.current?.focus());
    }
  }

  return (
    <form
      className="pay-proof"
      onSubmit={handleSubmit}
      noValidate
      aria-labelledby="pay-proof-heading"
    >
      <h3 id="pay-proof-heading" className="pay-proof__heading">
        {heading}
      </h3>

      <ErrorSummary errors={errors} ref={summaryRef} />

      <label className={`dropzone${fileError === undefined ? "" : " dropzone--invalid"}`}>
        <input
          id={FILE_ID}
          className="dropzone__input"
          type="file"
          accept={PROOF_TYPES.join(",")}
          aria-describedby={`${FILE_ID}-hint${fileError === undefined ? "" : ` ${FILE_ID}-error`}`}
          aria-invalid={fileError === undefined ? undefined : true}
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setSent(false);
          }}
        />
        <PixelIcon name="upload" className="pay-icon pay-icon--large" />
        <span className="dropzone__title">
          {file === null ? "Choose your payment screenshot (required)" : file.name}
        </span>
        <span className="dropzone__hint" id={`${FILE_ID}-hint`}>
          {file === null
            ? "PNG or JPEG, from your banking or e-wallet app, showing the amount, the recipient, the date and the reference."
            : "Choose another file to replace it before you submit."}
        </span>
        {fileError === undefined ? null : (
          <span className="form-field__error" id={`${FILE_ID}-error`}>
            {fileError}
          </span>
        )}
      </label>

      <div className="pay-proof__fields">
        <FormField
          id="payment-proof-reference"
          name="reference"
          label="Payment reference, if your app shows one"
          hint="Copy it exactly as it appears on the successful payment screen."
          autoComplete="off"
          maxLength={64}
        />
        <FormField
          id="payment-proof-paid-at"
          name="paidAt"
          type="datetime-local"
          label="When you paid, if you know"
          hint="Malaysia time (UTC+8)."
        />
      </div>

      {sent ? (
        <p className="pay-proof__preview" role="status">
          <strong>Preview only: nothing was uploaded.</strong> On the live screen this saves your
          screenshot to this request as version {nextVersion} for checking. Earlier screenshots are
          kept.
        </p>
      ) : null}

      <button
        type="submit"
        className="button button--primary"
        aria-disabled={offline ? true : undefined}
      >
        Submit proof for checking
      </button>
      {offline ? (
        <p className="pay-proof__note">
          You are offline. Your proof can be sent when you reconnect.
        </p>
      ) : (
        <p className="pay-proof__note">
          Sending proof does not confirm your payment. VAULTIX confirms it after checking.
        </p>
      )}
    </form>
  );
}
