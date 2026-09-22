"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { WantedDetail } from "@/features/marketplace/types";
import {
  submitClaimFile,
  validateClaimFile,
  type ClaimSubmissionStep,
} from "@/features/claims/claim-operations";
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
  const [freeReleaseOptIn, setFreeReleaseOptIn] = useState(false);
  const [step, setStep] = useState<ClaimSubmissionStep | "idle" | "error">("idle");
  const [errorHeading, setErrorHeading] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isDragOver, setIsDragOver] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    dialogRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && step !== "uploading" && step !== "hashing") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, step]);

  function handleFileSelection(selectedFile: File | null) {
    if (!selectedFile) return;

    const validation = validateClaimFile(selectedFile);
    if (!validation.valid) {
      setStep("error");
      setErrorHeading("Invalid file selected");
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
      setStep("error");
      setErrorHeading("Rights confirmation required");
      setErrorMessage("You must confirm you have the rights to submit this resource.");
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
      onClaimSubmitted?.(result.data.claimId);
      return;
    }

    setStep("error");
    if (result.code === "UPLOAD_UNAVAILABLE") {
      setErrorHeading("Uploads are switched off");
      setErrorMessage(
        "Public claim uploads are currently disabled pending launch-gate clearance. No file was uploaded.",
      );
    } else {
      setErrorHeading("Submission failed");
      setErrorMessage(result.message);
    }
  }

  const isWorking = step === "hashing" || step === "authorizing" || step === "uploading";

  return (
    <div
      className="evidence-viewer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="claim-form-title"
      ref={dialogRef}
      tabIndex={-1}
      style={{
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0, 0, 0, 0.75)",
      }}
    >
      <div
        className="panel"
        style={{
          maxWidth: "36rem",
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "var(--space-4)",
          }}
        >
          <h2 id="claim-form-title" style={{ margin: 0, fontSize: "var(--text-lg)" }}>
            Submit a Claim for Bounty
          </h2>
          {!isWorking ? (
            <button
              type="button"
              className="button button--ghost"
              onClick={onClose}
              aria-label="Close dialog"
            >
              ✕
            </button>
          ) : null}
        </div>

        {step === "complete" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <div
              className="panel"
              style={{
                background: "var(--bg-canvas)",
                border: "var(--border-width-1) solid var(--border-default)",
                padding: "var(--space-4)",
              }}
            >
              <h3 style={{ margin: "0 0 var(--space-2) 0", fontSize: "var(--text-lg)" }}>
                Claim submitted for review
              </h3>
              <p style={{ margin: "0 0 var(--space-4) 0", color: "var(--text-muted)" }}>
                Your claim has been uploaded to quarantine. A human Sheriff will review it before an
                award or entitlement is decided.
              </p>
              <div style={{ display: "flex", gap: "var(--space-2)" }}>
                <Link href="/claims" className="button button--primary">
                  View in Hunter&rsquo;s Office
                </Link>
                <button type="button" className="button button--ghost" onClick={onClose}>
                  Close
                </button>
              </div>
            </div>
          </div>
        ) : step === "error" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <UiStatus
              kind="offline"
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
          </div>
        ) : isWorking ? (
          <div
            style={{
              padding: "var(--space-6) var(--space-4)",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "var(--space-3)",
            }}
          >
            <div className="ui-status__label" style={{ fontWeight: "bold" }}>
              {step === "hashing" && "Computing file checksum (SHA-256)…"}
              {step === "authorizing" && "Authorizing private quarantine upload…"}
              {step === "uploading" && "Uploading directly to quarantine storage…"}
            </div>
            <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
              {step === "hashing" &&
                "Hashing untrusted file in browser memory before authorization."}
              {step === "authorizing" && "Requesting pre-signed session from upload gateway."}
              {step === "uploading" &&
                "Direct browser-to-bucket upload. Please keep this window open."}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <p className="policy-note" style={{ marginBottom: "var(--space-4)" }}>
              Submitting for <strong>{wanted.title}</strong> ({wanted.courseCode}). Files are
              quarantined immediately and reviewed by a Sheriff before release.
            </p>

            <div
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
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: isDragOver
                  ? "2px dashed var(--accent-primary, #6366f1)"
                  : "2px dashed var(--border-default)",
                borderRadius: "var(--radius-card, 8px)",
                padding: "var(--space-6) var(--space-4)",
                textAlign: "center",
                cursor: "pointer",
                backgroundColor: isDragOver ? "var(--bg-surface-elevated)" : "var(--bg-canvas)",
                marginBottom: "var(--space-4)",
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                style={{ display: "none" }}
                accept=".pdf,.docx,.pptx,.xlsx,.jpg,.jpeg,.png,.webp"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFileSelection(e.target.files[0] ?? null);
                  }
                }}
              />
              {file ? (
                <div>
                  <p style={{ fontWeight: "bold", margin: "0 0 var(--space-1) 0" }}>{file.name}</p>
                  <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", margin: 0 }}>
                    {(file.size / (1024 * 1024)).toFixed(2)} MB &bull; Click or drop another file to
                    replace
                  </p>
                </div>
              ) : (
                <div>
                  <p style={{ margin: "0 0 var(--space-1) 0", fontWeight: "bold" }}>
                    Drag and drop your claim file here, or click to browse
                  </p>
                  <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", margin: 0 }}>
                    Supported: PDF, DOCX, PPTX, XLSX, JPEG, PNG, WEBP (up to 50 MB)
                  </p>
                </div>
              )}
            </div>

            <fieldset className="draft-form__fieldset" style={{ marginBottom: "var(--space-4)" }}>
              <legend className="draft-form__legend">Rights and Release</legend>

              <label
                className="draft-form__choice"
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "var(--space-2)",
                  marginBottom: "var(--space-2)",
                }}
              >
                <input
                  type="checkbox"
                  checked={rightsConfirmed}
                  onChange={(e) => setRightsConfirmed(e.target.checked)}
                  required
                />
                <span style={{ fontSize: "var(--text-sm)" }}>
                  <strong>I confirm I hold the rights</strong> to submit this material and that it
                  does not violate copyright, exam confidentiality, or institution rules.
                </span>
              </label>

              <label
                className="draft-form__choice"
                style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-2)" }}
              >
                <input
                  type="checkbox"
                  checked={freeReleaseOptIn}
                  onChange={(e) => setFreeReleaseOptIn(e.target.checked)}
                />
                <span style={{ fontSize: "var(--text-sm)" }}>
                  Opt into free public release 48 hours after Sheriff approval (allows classmates to
                  access after the initial reward window).
                </span>
              </label>
            </fieldset>

            <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "flex-end" }}>
              <button type="button" className="button button--ghost" onClick={onClose}>
                Cancel
              </button>
              <button
                type="submit"
                className="button button--primary"
                disabled={!file || !rightsConfirmed}
              >
                Submit Claim
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
