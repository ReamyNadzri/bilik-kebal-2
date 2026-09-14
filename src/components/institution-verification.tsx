"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { ErrorSummary, type FieldError } from "./error-summary";
import { FormField } from "./form-field";
import { TrustBadge, type InstitutionBadgeState } from "./trust-badge";
import { UiStatus } from "./ui-status";
import type {
  AccountViewModel,
  AutomaticVerificationResult,
  EvidenceUploadResult,
  InstitutionOption,
  ManualVerificationRequestResult,
  VerificationOperationCode,
} from "@/contracts";
import { callOperation } from "@/features/presentation/call-operation";
import { IDENTITY_MESSAGE } from "@/features/presentation/identity-messages";
import { useHydrated } from "@/features/presentation/use-hydrated";

export interface InstitutionVerificationProps {
  state: InstitutionBadgeState;
  /**
   * Active institutions from the identity read contract. The screen never
   * invents or hardcodes an identifier: submitting evidence against a guessed
   * institution would attach someone's document to the wrong one.
   */
  institutions: readonly InstitutionOption[];
  latestRequest?: AccountViewModel["latestVerificationRequest"];
}

type Step = "idle" | "preparing" | "uploading" | "submitting" | "checking-domain";

type Outcome =
  | { kind: "idle" }
  | { kind: "domain-routed"; message: string }
  | { kind: "failed"; message: string; retryable: boolean }
  | { kind: "pending" };

const STEP_HEADING: Record<Exclude<Step, "idle">, string> = {
  "checking-domain": "Checking your email domain",
  preparing: "Preparing the upload",
  uploading: "Uploading your document",
  submitting: "Submitting your request",
};

function messageFor(code: VerificationOperationCode, message: string): string {
  return message === "" ? IDENTITY_MESSAGE[code] : message;
}

function readableReason(reasonCode: string): string {
  return reasonCode.replaceAll("_", " ");
}

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" });

function formatDate(iso: string): string {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? "Unknown date" : DATE_FORMAT.format(parsed);
}

/**
 * Institution verification: the automatic domain check, then evidence review.
 *
 * The evidence path is three operations — mint a signed upload URL, PUT the
 * document straight to storage, then submit the request that references it.
 * Each can fail on its own, and the third failing is the interesting one: the
 * document is then in private storage with nothing pointing at it. That retry
 * resubmits the path already held rather than uploading again, because a second
 * upload means a second copy of someone's identity document.
 *
 * The signed URL and the storage key are held in local state and never
 * rendered, logged, or persisted.
 */
export function InstitutionVerification({
  state,
  institutions,
  latestRequest,
}: InstitutionVerificationProps) {
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [step, setStep] = useState<Step>("idle");
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });
  const [announcement, setAnnouncement] = useState("");
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [verifiedHere, setVerifiedHere] = useState(false);
  // Held for the submission-only retry. Never rendered.
  const [uploaded, setUploaded] = useState<{ institutionId: string; objectPath: string } | null>(
    null,
  );
  const summaryRef = useRef<HTMLDivElement>(null);
  /**
   * aria-disabled is advisory: it does not stop a click or an Enter key. A ref
   * rather than the `step` state because several activations can arrive in one
   * tick, before React has re-rendered, and each would read a stale `step`.
   */
  const busyRef = useRef(false);
  const hydrated = useHydrated();

  useEffect(() => {
    if (errors.length > 0) {
      summaryRef.current?.focus();
    }
  }, [errors]);

  const resolvedState: InstitutionBadgeState = verifiedHere ? "verified" : state;
  const submittedPending = outcome.kind === "pending" || resolvedState === "pending";
  const canRequest =
    !submittedPending && (resolvedState === "unverified" || resolvedState === "rejected");
  const busy = step !== "idle";

  async function submitRequest(institutionId: string, objectPath: string): Promise<void> {
    setStep("submitting");

    const result = (await callOperation<
      { evidenceDeleteAfter: string; requestId: string; status: "pending" },
      VerificationOperationCode
    >(
      "/api/identity/verification-requests",
      { evidenceObjectPath: objectPath, institutionId },
      "AUTH_UNAVAILABLE",
    )) as ManualVerificationRequestResult;

    if (result.ok) {
      setUploaded(null);
      setOutcome({ kind: "pending" });
      setAnnouncement("Verification request submitted. A Sheriff will review it.");
      return;
    }

    // A request already exists, so the account is already waiting on a review.
    if (result.code === "VERIFICATION_CONFLICT") {
      setUploaded(null);
      setOutcome({ kind: "pending" });
      setAnnouncement("A verification request is already under review.");
      return;
    }

    setUploaded({ institutionId, objectPath });
    setOutcome({
      kind: "failed",
      message: `Your document was uploaded, but the request was not created. ${messageFor(
        result.code,
        result.message,
      )}`,
      retryable: true,
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (busyRef.current) {
      return;
    }

    const form = new FormData(event.currentTarget);
    const institutionId = String(form.get("institution") ?? "");

    const found: FieldError[] = [];
    if (institutionId === "") {
      found.push({ fieldId: "institution", message: "Choose your institution." });
    }
    if (evidenceFile === null) {
      found.push({ fieldId: "evidence", message: "Choose a file that shows your affiliation." });
    }
    if (form.get("declaration") === null) {
      found.push({
        fieldId: "declaration",
        message: "Confirm that the evidence is accurate and yours to share.",
      });
    }

    if (found.length > 0 || evidenceFile === null) {
      setErrors(found);
      setOutcome({ kind: "idle" });
      return;
    }

    setErrors([]);
    setOutcome({ kind: "idle" });
    busyRef.current = true;

    try {
      setStep("preparing");

      const upload = (await callOperation<
        { objectPath: string; signedUrl: string; token: string },
        VerificationOperationCode
      >(
        "/api/identity/verification-evidence/upload-url",
        { fileName: evidenceFile.name, mimeType: evidenceFile.type },
        "EVIDENCE_UPLOAD_UNAVAILABLE",
      )) as EvidenceUploadResult;

      if (!upload.ok) {
        setOutcome({
          kind: "failed",
          message: messageFor(upload.code, upload.message),
          retryable: false,
        });
        return;
      }

      setStep("uploading");

      let stored = false;
      try {
        const response = await fetch(upload.data.signedUrl, {
          method: "PUT",
          body: evidenceFile,
          headers: { "Content-Type": evidenceFile.type },
        });
        stored = response.ok;
      } catch {
        stored = false;
      }

      if (!stored) {
        // Deliberately says nothing about the URL or the key.
        setOutcome({
          kind: "failed",
          message: "Your document was not uploaded. Check your connection and try again.",
          retryable: false,
        });
        return;
      }

      await submitRequest(institutionId, upload.data.objectPath);
    } finally {
      busyRef.current = false;
      setStep("idle");
    }
  }

  async function handleRetrySubmission() {
    if (busyRef.current || uploaded === null) {
      return;
    }

    busyRef.current = true;
    setOutcome({ kind: "idle" });

    try {
      await submitRequest(uploaded.institutionId, uploaded.objectPath);
    } finally {
      busyRef.current = false;
      setStep("idle");
    }
  }

  async function handleDomainCheck() {
    if (busyRef.current) {
      return;
    }

    busyRef.current = true;
    setOutcome({ kind: "idle" });

    try {
      setStep("checking-domain");

      const result = (await callOperation<
        { institutionId: string; status: "verified" },
        VerificationOperationCode
      >("/api/identity/verify-domain", {}, "AUTH_UNAVAILABLE")) as AutomaticVerificationResult;

      if (result.ok) {
        setVerifiedHere(true);
        // Deliberately not a restatement of the paragraph that appears on
        // screen: a live region that repeats visible text verbatim is read
        // twice by a screen reader.
        setAnnouncement("Institution verified.");
        return;
      }

      /**
       * An unapproved domain is the expected route into manual review, not a
       * fault the user caused. While the approved-domain list is deliberately
       * empty it is the only outcome this operation can return, so presenting
       * it as an error would tell the whole first cohort they did something
       * wrong.
       */
      if (result.code === "DOMAIN_NOT_APPROVED") {
        setOutcome({
          kind: "domain-routed",
          message: messageFor(result.code, result.message),
        });
        return;
      }

      setOutcome({
        kind: "failed",
        message: messageFor(result.code, result.message),
        retryable: false,
      });
    } finally {
      busyRef.current = false;
      setStep("idle");
    }
  }

  const errorFor = (fieldId: string) => errors.find((error) => error.fieldId === fieldId)?.message;

  return (
    <section className="institution-verification">
      <p
        className="visually-hidden"
        data-testid="verification-announcer"
        aria-live="polite"
        role="status"
      >
        {announcement}
      </p>

      <h2>Current status</h2>
      <TrustBadge kind="institution" state={resolvedState} />

      {resolvedState === "rejected" && latestRequest?.reasonCode ? (
        <p className="institution-verification__reason">
          Your last request was rejected. Reason: {readableReason(latestRequest.reasonCode)}.
        </p>
      ) : null}

      {submittedPending ? (
        <section className="institution-verification__pending">
          <h2>A Sheriff is reviewing your request</h2>
          <p>
            You can browse Wanted metadata while this is reviewed. You will be notified when a
            decision is made.
          </p>
          {latestRequest === null || latestRequest === undefined ? null : (
            <dl className="account-summary__details">
              <dt>Submitted</dt>
              <dd>{formatDate(latestRequest.submittedAt)}</dd>
              <dt>Evidence deleted after</dt>
              <dd>{formatDate(latestRequest.evidenceDeleteAfter)}</dd>
            </dl>
          )}
        </section>
      ) : null}

      {resolvedState === "verified" ? (
        <p>
          Your institution affiliation is confirmed. Nothing further is needed. The star emblem
          confirms affiliation only; it is not a statement about resource quality.
        </p>
      ) : null}

      {canRequest ? (
        <>
          <h2>Automatic verification</h2>
          <p>
            If your email address is at an approved institution domain, this confirms your
            affiliation immediately.
          </p>

          <button
            className="auth-form__submit"
            type="button"
            onClick={handleDomainCheck}
            aria-disabled={busy ? true : undefined}
          >
            Check my email domain
          </button>

          {outcome.kind === "domain-routed" ? (
            <p className="institution-verification__routed" data-testid="domain-outcome">
              {outcome.message} Submit your evidence below and a Sheriff will review it.
            </p>
          ) : null}

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

          {institutions.length === 0 ? (
            <UiStatus
              kind="empty"
              heading="Verification by evidence is unavailable"
              message="There are no institutions are available for verification yet, so a request cannot be submitted. Try again later."
            />
          ) : (
            <form
              className="auth-form"
              noValidate
              onSubmit={handleSubmit}
              data-hydrated={hydrated ? "true" : "false"}
            >
              <ErrorSummary errors={errors} ref={summaryRef} />

              {outcome.kind === "failed" && errors.length === 0 ? (
                <UiStatus
                  kind="error"
                  heading="Your request was not submitted"
                  message={outcome.message}
                />
              ) : null}

              <div className="form-field">
                <label className="form-field__label" htmlFor="institution">
                  Institution
                  <span className="form-field__required"> (required)</span>
                </label>
                {errorFor("institution") === undefined ? null : (
                  <p className="form-field__error" id="institution-error">
                    {errorFor("institution")}
                  </p>
                )}
                <select
                  className="form-field__input"
                  id="institution"
                  name="institution"
                  defaultValue=""
                  required
                  aria-invalid={errorFor("institution") === undefined ? undefined : true}
                  aria-describedby={
                    errorFor("institution") === undefined ? undefined : "institution-error"
                  }
                >
                  <option value="">Choose an institution</option>
                  {institutions.map((institution) => (
                    <option key={institution.id} value={institution.id}>
                      {institution.name}
                    </option>
                  ))}
                </select>
              </div>

              <FormField
                id="evidence"
                name="evidence"
                type="file"
                label="Evidence of affiliation"
                hint="A student card, enrolment letter or transcript. PDF, JPEG or PNG."
                accept=".pdf,.jpg,.jpeg,.png"
                required
                error={errorFor("evidence")}
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  setEvidenceFile(event.target.files?.[0] ?? null);
                }}
              />

              {evidenceFile === null ? null : (
                <p className="form-field__hint">Selected: {evidenceFile.name}</p>
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

              <button
                className="auth-form__submit"
                type="submit"
                aria-disabled={busy ? true : undefined}
              >
                Request verification
              </button>

              {outcome.kind === "failed" && outcome.retryable ? (
                <button
                  className="auth-form__submit"
                  type="button"
                  onClick={handleRetrySubmission}
                  aria-disabled={busy ? true : undefined}
                >
                  Try submitting again
                </button>
              ) : null}

              {busy ? (
                <UiStatus kind="loading" heading={STEP_HEADING[step as Exclude<Step, "idle">]} />
              ) : null}
            </form>
          )}
        </>
      ) : null}
    </section>
  );
}
