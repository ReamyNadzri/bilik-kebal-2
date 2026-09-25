"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { WantedDetail } from "@/features/marketplace/types";
import {
  submitClaimFile,
  validateClaimFile,
  type ClaimSubmissionStep,
} from "@/features/claims/claim-operations";
import { formatRinggit } from "@/features/marketplace/money";
import { useAuth } from "@/features/presentation/auth/auth-provider";
import { CapturePoster, pickCaptureWord, type CaptureWord } from "./motion/capture-poster";
import { UiStatus } from "./ui-status";

export interface ClaimSubmissionFormProps {
  readonly wanted: WantedDetail;
  readonly onClose: () => void;
  readonly onClaimSubmitted?: (claimId: string) => void;
}

/**
 * Accessible modal dialog for submitting an academic resource claim.
 *
 * Implements:
 * - Drag-and-drop and manual file selection (50 MB limit, permitted MIME types).
 * - Multi-stage progress indicators: hashing -> authorizing -> uploading -> complete.
 * - Client-side validation before any network request.
 * - Explicit rights confirmation and optional free-release opt-in checkboxes.
 * - Direct upload to quarantine storage without streaming bytes through Next.js server.
 * - Launch-gate awareness: informative notice when uploads are disabled (UPLOAD_UNAVAILABLE).
 */
export function ClaimSubmissionForm({
  wanted,
  onClose,
  onClaimSubmitted,
}: ClaimSubmissionFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [rightsAttention, setRightsAttention] = useState(false);
  const rightsRef = useRef<HTMLInputElement>(null);
  const [freeReleaseOptIn, setFreeReleaseOptIn] = useState(false);
  const [step, setStep] = useState<ClaimSubmissionStep | "idle" | "error">("idle");
  const [errorHeading, setErrorHeading] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isDragOver, setIsDragOver] = useState(false);
  // Picked once, when the server confirms the claim; a re-render never re-rolls it.
  const [captureWord, setCaptureWord] = useState<CaptureWord | null>(null);
  const { state: auth } = useAuth();

  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // The poster takes focus while it is up; closing it hands focus back here.
    if (captureWord === null) dialogRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      // While the capture poster is up, Esc closes the poster alone.
      if (
        event.key === "Escape" &&
        step !== "uploading" &&
        step !== "hashing" &&
        captureWord === null
      ) {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, step, captureWord]);

  function handleFileSelection(selectedFile: File | null) {
    if (!selectedFile) return;

    const validation = validateClaimFile(selectedFile);
    if (!validation.valid) {
      setStep("error");
      setErrorHeading("This file cannot be used");
      setErrorMessage(validation.error ?? "Please select a supported document or image.");
      setFile(null);
      return;
    }

    setFile(selectedFile);
    setStep("idle");
    setErrorHeading("");
    setErrorMessage("");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!file) {
      setStep("error");
      setErrorHeading("No file selected");
      setErrorMessage("Please choose a file to submit as your claim.");
      return;
    }

    if (!rightsConfirmed) {
      // Point at the box itself rather than replacing the form with an error:
      // the Hunter's chosen file and opt-in stay exactly as they were.
      setRightsAttention(true);
      rightsRef.current?.focus();
      return;
    }

    const result = await submitClaimFile({
      wantedId: wanted.id,
      file,
      rightsConfirmed: true,
      freeReleaseOptIn,
      onProgress: (currentStep) => setStep(currentStep),
    });

    if (result.ok) {
      setStep("complete");
      setCaptureWord(pickCaptureWord());
      onClaimSubmitted?.(result.data.claimId);
      return;
    }

    setStep("error");
    if (result.code === "UPLOAD_UNAVAILABLE") {
      setErrorHeading("Uploads are switched off");
      setErrorMessage(
        "Claim uploads are not open yet while file screening is being set up. No file was uploaded.",
      );
    } else {
      setErrorHeading("Submission failed");
      setErrorMessage(result.message);
    }
  }

  const isWorking = step === "hashing" || step === "authorizing" || step === "uploading";

  return (
    <>
      <div
        className="dialog-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="claim-form-title"
        aria-busy={isWorking ? true : undefined}
        ref={dialogRef}
        tabIndex={-1}
      >
        <div className="dialog dialog--wide">
          <div className="dialog__head">
            <h2 id="claim-form-title" className="dialog__title">
              Submit a Claim
            </h2>
            {!isWorking ? (
              <button
                type="button"
                className="button button--quiet dialog__close"
                onClick={onClose}
                aria-label="Close dialog"
              >
                <span aria-hidden="true">✕</span>
              </button>
            ) : null}
          </div>

          {step === "complete" ? (
            <UiStatus
              kind="success"
              heading="Claim submitted for review"
              message="Your file is in private quarantine. A human Sheriff reviews it before any award or access is decided."
              action={
                <span className="dialog__actions">
                  <Link href="/claims" className="button button--primary">
                    View in Hunter&rsquo;s Office
                  </Link>
                  <button type="button" className="button button--quiet" onClick={onClose}>
                    Close
                  </button>
                </span>
              }
            />
          ) : step === "error" ? (
            <UiStatus
              kind="error"
              heading={errorHeading}
              message={errorMessage}
              action={
                <button
                  type="button"
                  className="button button--primary"
                  onClick={() => {
                    setStep("idle");
                    setErrorHeading("");
                    setErrorMessage("");
                  }}
                >
                  Try again
                </button>
              }
            />
          ) : isWorking ? (
            <div className="progress-note" role="status" aria-live="polite">
              <p className="ui-status__label">
                {step === "hashing" && "Checking your file…"}
                {step === "authorizing" && "Preparing a private upload…"}
                {step === "uploading" && "Uploading to private review storage…"}
              </p>
              <p>
                {step === "hashing" && "Your file stays on this device while it is checked."}
                {step === "authorizing" && "Asking for a one-time upload slot."}
                {step === "uploading" && "Keep this window open until the upload finishes."}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <p className="policy-note dialog__lede">
                Submitting for <strong>{wanted.title}</strong> ({wanted.courseCode}). Your file is
                kept private and reviewed by a Sheriff before anyone else can see it.
              </p>

              <label
                className={`dropzone${isDragOver ? " dropzone--active" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                  if (e.dataTransfer.files.length > 0) {
                    handleFileSelection(e.dataTransfer.files[0] ?? null);
                  }
                }}
              >
                <input
                  className="dropzone__input"
                  type="file"
                  aria-describedby="claim-file-hint"
                  accept=".pdf,.docx,.pptx,.xlsx,.jpg,.jpeg,.png,.webp"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleFileSelection(e.target.files[0] ?? null);
                    }
                  }}
                />
                {file ? (
                  <>
                    <span className="dropzone__title">{file.name}</span>
                    <span className="dropzone__hint" id="claim-file-hint">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB. Choose or drop another file to
                      replace it.
                    </span>
                  </>
                ) : (
                  <>
                    <span className="dropzone__title">
                      Drag and drop your claim file here, or choose a file
                    </span>
                    <span className="dropzone__hint" id="claim-file-hint">
                      PDF, DOCX, PPTX, XLSX, JPEG, PNG or WEBP, up to 50 MB.
                    </span>
                  </>
                )}
              </label>

              <fieldset className="consent-list">
                <legend className="draft-form__legend">Rights and release</legend>

                <label className={`consent${rightsAttention ? " consent--attention" : ""}`}>
                  <input
                    ref={rightsRef}
                    type="checkbox"
                    checked={rightsConfirmed}
                    onChange={(e) => {
                      setRightsConfirmed(e.target.checked);
                      if (e.target.checked) setRightsAttention(false);
                    }}
                    aria-invalid={rightsAttention ? true : undefined}
                    aria-describedby={rightsAttention ? "claim-rights-error" : undefined}
                  />
                  <span>
                    <strong>I confirm I hold the rights</strong> to share this material, and it does
                    not break copyright, exam confidentiality or institution rules.
                  </span>
                </label>
                {rightsAttention ? (
                  <p className="consent__error" id="claim-rights-error" role="alert">
                    Tick this box to confirm you hold the rights before submitting.
                  </p>
                ) : null}

                <label className="consent">
                  <input
                    type="checkbox"
                    checked={freeReleaseOptIn}
                    onChange={(e) => setFreeReleaseOptIn(e.target.checked)}
                  />
                  <span>
                    Offer this resource for free release. It becomes free 48 hours after approval,
                    and only if a Sheriff also confirms the rights; otherwise only this
                    Wanted&rsquo;s Backers get access.
                  </span>
                </label>
              </fieldset>

              <div className="dialog__actions">
                <button type="button" className="button button--quiet" onClick={onClose}>
                  Cancel
                </button>
                <button type="submit" className="button button--primary" disabled={!file}>
                  Submit Claim
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {captureWord === null ? null : (
        <CapturePoster
          word={captureWord}
          courseCode={wanted.courseCode}
          courseName={wanted.courseName}
          title={wanted.title}
          bountyLabel={formatRinggit(wanted.grossBountySen)}
          hunterName={auth.account?.displayName ?? "you"}
          onClose={() => setCaptureWord(null)}
          huntHref="/claims"
        />
      )}
    </>
  );
}
