"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { ErrorSummary, type FieldError } from "./error-summary";
import { FormField } from "./form-field";
import { TrustBadge, type InstitutionBadgeState } from "./trust-badge";
import { UiStatus } from "./ui-status";
import { useHydrated } from "@/features/presentation/use-hydrated";

export interface InstitutionVerificationProps {
  state: InstitutionBadgeState;
  /**
   * Approved institution email domains, supplied by configuration through the
   * view model. Empty while the authoritative list is unresolved — see the
   * open question in context/progress-tracker.md. The frontend must not
   * present a guessed domain as an approved one.
   */
  approvedDomains: readonly string[];
  rejectionReason?: string | undefined;
}

/**
 * Institution verification request presentation.
 *
 * Fixture-only: it uploads nothing and decides nothing. Institution
 * verification is a trust state separate from email verification, and only a
 * Sheriff grants it (context/project-overview.md). The evidence route is
 * described here, but the real submission needs the Codex-owned operation and
 * a private signed upload into the verification-evidence bucket.
 */
export function InstitutionVerification({
  state,
  approvedDomains,
  rejectionReason,
}: InstitutionVerificationProps) {
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [attempted, setAttempted] = useState(false);
  // Tracked from the change event rather than read back out of FormData: it
  // lets the chosen filename be shown, and keeps the check independent of how
  // a given runtime serialises file inputs.
  const [evidenceName, setEvidenceName] = useState<string | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const hydrated = useHydrated();

  useEffect(() => {
    if (errors.length > 0) {
      summaryRef.current?.focus();
    }
  }, [errors]);

  const canRequest = state === "unverified" || state === "rejected";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const declared = new FormData(event.currentTarget).get("declaration") !== null;

    const found: FieldError[] = [];

    if (evidenceName === null) {
      found.push({ fieldId: "evidence", message: "Choose a file that shows your affiliation." });
    }

    if (!declared) {
      found.push({
        fieldId: "declaration",
        message: "Confirm that the evidence is accurate and yours to share.",
      });
    }

    setErrors(found);
    setAttempted(true);
  }

  const errorFor = (fieldId: string) => errors.find((error) => error.fieldId === fieldId)?.message;
  const submittedCleanly = attempted && errors.length === 0;

  return (
    <section className="institution-verification">
      <h2>Current status</h2>
      <TrustBadge kind="institution" state={state} />

      {state === "rejected" && rejectionReason !== undefined ? (
        <UiStatus kind="error" heading="Your last request was rejected" message={rejectionReason} />
      ) : null}

      {state === "pending" ? (
        <UiStatus
          kind="loading"
          heading="A Sheriff is reviewing your request"
          message="You can browse Wanted metadata while this is reviewed. You will be notified when a decision is made."
        />
      ) : null}

      {state === "verified" ? (
        <p>
          Your institution affiliation is confirmed. Nothing further is needed. The star emblem
          confirms affiliation only; it is not a statement about resource quality.
        </p>
      ) : null}

      {canRequest ? (
        <>
          <h2>Automatic verification</h2>
          {approvedDomains.length === 0 ? (
            <p>
              The list of approved institution email domains has not been published yet. Until it
              is, every request is reviewed by a Sheriff.
            </p>
          ) : (
            <>
              <p>Register or sign in with an email address at an approved domain:</p>
              <ul>
                {approvedDomains.map((domain) => (
                  <li key={domain}>{domain}</li>
                ))}
              </ul>
            </>
          )}

          <h2>Verification by evidence</h2>
          <p>
            If your email address is not on an approved domain, submit a document showing your
            affiliation. A Sheriff reviews it and decides.
          </p>

          <aside className="privacy-note" role="note" aria-label="How your evidence is handled">
            <h3 className="privacy-note__heading">How your evidence is handled</h3>
            <p>
              Your document is stored privately. Only a Sheriff reviewing your request can open it.
              It is never shown on the Wanted Board, attached to a claim, or sent in an email. It is
              deleted 30 days after the decision and any appeal period ends.
            </p>
          </aside>

          <form
            className="auth-form"
            noValidate
            onSubmit={handleSubmit}
            data-hydrated={hydrated ? "true" : "false"}
          >
            <ErrorSummary errors={errors} ref={summaryRef} />

            <FormField
              id="evidence"
              name="evidence"
              type="file"
              label="Evidence of affiliation"
              hint="A student card, enrolment letter or transcript. PDF, JPG, PNG or WEBP."
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              required
              error={errorFor("evidence")}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                const chosen = event.target.files?.[0];
                setEvidenceName(chosen === undefined ? null : chosen.name);
              }}
            />

            {evidenceName === null ? null : (
              <p className="form-field__hint">Selected: {evidenceName}</p>
            )}

            <div className="form-field">
              <label className="form-field__checkbox" htmlFor="declaration">
                <input
                  type="checkbox"
                  id="declaration"
                  name="declaration"
                  aria-invalid={errorFor("declaration") === undefined ? undefined : true}
                  aria-describedby={
                    errorFor("declaration") === undefined ? undefined : "declaration-error"
                  }
                />
                <span>
                  I confirm this evidence is accurate, relates to me, and is mine to share.
                </span>
              </label>
              {errorFor("declaration") === undefined ? null : (
                <p className="form-field__error" id="declaration-error">
                  {errorFor("declaration")}
                </p>
              )}
            </div>

            <button className="auth-form__submit" type="submit">
              Request verification
            </button>

            {submittedCleanly ? (
              <UiStatus
                kind="offline"
                heading="No request was submitted"
                message="The form is valid, but this screen is not connected to a verification operation yet, so nothing was uploaded and no Sheriff was notified."
              />
            ) : null}
          </form>
        </>
      ) : null}
    </section>
  );
}
