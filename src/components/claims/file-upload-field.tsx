"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import type { ClaimMimeType, CompletedClaimProof } from "@/contracts/claims";
import { CLAIM_MAX_BYTES, claimMimeTypes } from "@/contracts/claims";

export interface FileUploadFieldProps {
  readonly wantedId: string;
  readonly maxSizeBytes?: number;
  readonly onUploadComplete?: (proof: CompletedClaimProof) => void;
  readonly onRemoveProof?: (proof: CompletedClaimProof) => void;
  readonly onUploadError?: (error: string) => void;
  readonly disabled?: boolean;
}

export type UploadStage =
  | { kind: "idle" }
  | { kind: "validating"; file: File }
  | { kind: "uploading"; file: File; progress: number }
  | { kind: "confirming"; file: File }
  | { kind: "success"; proof: CompletedClaimProof; simulated?: boolean }
  | { kind: "error"; message: string; file?: File };

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function computeSha256Hex(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function FileUploadField({
  wantedId,
  onUploadComplete,
  onRemoveProof,
  onUploadError,
  disabled = false,
  maxSizeBytes = CLAIM_MAX_BYTES,
}: FileUploadFieldProps) {
  const [stage, setStage] = useState<UploadStage>({ kind: "idle" });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  // Consent is an active choice: never pre-ticked on the Hunter's behalf.
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [rightsAttention, setRightsAttention] = useState(false);
  const rightsRef = useRef<HTMLInputElement>(null);
  const [freeReleaseOptIn, setFreeReleaseOptIn] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortUploadRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleStartUpload = useCallback(
    async (file: File) => {
      // 1. Validation
      if (!claimMimeTypes.includes(file.type as ClaimMimeType)) {
        const errorMsg = "Unsupported file type. Allowed: PDF, PNG, JPEG, WEBP, DOCX, PPTX, XLSX.";
        setStage({ kind: "error", message: errorMsg, file });
        onUploadError?.(errorMsg);
        return;
      }

      if (file.size > maxSizeBytes) {
        const errorMsg = `File too large (${formatBytes(file.size)}). Maximum allowed is ${formatBytes(maxSizeBytes)}.`;
        setStage({ kind: "error", message: errorMsg, file });
        onUploadError?.(errorMsg);
        return;
      }

      if (!rightsConfirmed) {
        const errorMsg = "Tick the rights confirmation, then choose your file again.";
        setRightsAttention(true);
        rightsRef.current?.focus();
        if (fileInputRef.current) fileInputRef.current.value = "";
        onUploadError?.(errorMsg);
        return;
      }

      if (file.type.startsWith("image/")) {
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
      } else {
        setPreviewUrl(null);
      }

      setStage({ kind: "validating", file });

      let sha256: string;
      try {
        sha256 = await computeSha256Hex(file);
      } catch {
        const errorMsg = "Your browser could not check this file. Try again in another browser.";
        setStage({ kind: "error", message: errorMsg, file });
        onUploadError?.(errorMsg);
        return;
      }

      // 2. Request Presigned Upload URL or simulate for development/fixture preview
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        wantedId,
      );

      if (!isUuid && process.env.NODE_ENV === "production") {
        const errorMsg =
          "This page is not linked to a valid Wanted request, so nothing was uploaded. Open the claim form from the Wanted request instead.";
        setStage({ kind: "error", message: errorMsg });
        onUploadError?.(errorMsg);
        return;
      }

      if (!isUuid) {
        // Development and test fixture preview only: simulates the upload
        // lifecycle. The success state says plainly that nothing was uploaded.
        let cancelled = false;
        abortUploadRef.current = () => {
          cancelled = true;
          setStage({ kind: "idle" });
        };

        setStage({ kind: "uploading", file, progress: 25 });
        await new Promise((r) => setTimeout(r, 400));
        if (cancelled) return;

        setStage({ kind: "uploading", file, progress: 65 });
        await new Promise((r) => setTimeout(r, 400));
        if (cancelled) return;

        setStage({ kind: "uploading", file, progress: 95 });
        await new Promise((r) => setTimeout(r, 300));
        if (cancelled) return;

        setStage({ kind: "confirming", file });
        await new Promise((r) => setTimeout(r, 300));
        if (cancelled) return;

        abortUploadRef.current = null;
        const proof: CompletedClaimProof = {
          claimId: `claim-${Date.now()}`,
          wantedId,
          fileName: file.name,
          mimeType: file.type as CompletedClaimProof["mimeType"],
          sizeBytes: file.size,
          status: "screening",
          completedAt: new Date().toISOString(),
        };

        setStage({ kind: "success", proof, simulated: true });
        onUploadComplete?.(proof);
        return;
      }

      let uploadSession: {
        claimId: string;
        signedUrl: string;
        token: string;
      };

      try {
        const res = await fetch("/api/claims/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            wantedId,
            fileName: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
            sha256,
            rightsConfirmed: true,
            freeReleaseOptIn,
          }),
        });

        const json = await res.json();
        if (!res.ok || !json.ok) {
          const errorMsg = json.message || "The upload could not be started. Nothing was uploaded.";
          setStage({ kind: "error", message: errorMsg, file });
          onUploadError?.(errorMsg);
          return;
        }

        uploadSession = json.data;
      } catch {
        const errorMsg = "VAULTIX could not be reached, so nothing was uploaded. Try again.";
        setStage({ kind: "error", message: errorMsg, file });
        onUploadError?.(errorMsg);
        return;
      }

      // 3. Direct Storage Upload via XMLHttpRequest
      setStage({ kind: "uploading", file, progress: 0 });

      try {
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          abortUploadRef.current = () => {
            xhr.abort();
            reject(new Error("Upload cancelled by user."));
          };

          xhr.upload.addEventListener("progress", (e) => {
            if (e.lengthComputable) {
              const pct = Math.round((e.loaded / e.total) * 100);
              setStage({ kind: "uploading", file, progress: pct });
            }
          });

          xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`Storage error (HTTP ${xhr.status}).`));
            }
          });

          xhr.addEventListener("error", () => {
            reject(new Error("Network connection lost during upload."));
          });

          xhr.addEventListener("abort", () => {
            reject(new Error("Upload was cancelled."));
          });

          xhr.open("PUT", uploadSession.signedUrl);
          xhr.setRequestHeader("Content-Type", file.type);
          if (uploadSession.token) {
            xhr.setRequestHeader("Authorization", `Bearer ${uploadSession.token}`);
          }
          xhr.send(file);
        });
      } catch (uploadErr) {
        abortUploadRef.current = null;
        const errorMsg =
          uploadErr instanceof Error ? uploadErr.message : "The file could not be uploaded.";
        setStage({ kind: "error", message: errorMsg, file });
        onUploadError?.(errorMsg);
        return;
      }

      abortUploadRef.current = null;

      // 4. Confirm Upload
      setStage({ kind: "confirming", file });

      try {
        const confirmRes = await fetch("/api/claims/confirm-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ claimId: uploadSession.claimId }),
        });

        const confirmJson = await confirmRes.json();
        if (!confirmRes.ok || !confirmJson.ok) {
          const errorMsg =
            confirmJson.message || "The upload finished but could not be recorded. Try again.";
          setStage({ kind: "error", message: errorMsg, file });
          onUploadError?.(errorMsg);
          return;
        }

        const proof: CompletedClaimProof = confirmJson.data;
        setStage({ kind: "success", proof });
        onUploadComplete?.(proof);
      } catch {
        const errorMsg = "The upload finished but could not be recorded. Try again.";
        setStage({ kind: "error", message: errorMsg, file });
        onUploadError?.(errorMsg);
      }
    },
    [wantedId, maxSizeBytes, rightsConfirmed, freeReleaseOptIn, onUploadComplete, onUploadError],
  );

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void handleStartUpload(file);
    }
  };

  const handleCancel = () => {
    if (abortUploadRef.current) {
      abortUploadRef.current();
    }
    setStage({ kind: "idle" });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleReset = () => {
    setStage({ kind: "idle" });
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const busy = stage.kind === "uploading" || stage.kind === "validating";

  return (
    <div className="panel ops-panel">
      {stage.kind === "idle" && (
        <>
          <fieldset className="consent-list">
            <legend className="draft-form__legend">Before you upload</legend>
            <label className={`consent${rightsAttention ? " consent--attention" : ""}`}>
              <input
                ref={rightsRef}
                type="checkbox"
                checked={rightsConfirmed}
                onChange={(e) => {
                  setRightsConfirmed(e.target.checked);
                  if (e.target.checked) setRightsAttention(false);
                }}
                disabled={disabled}
                aria-invalid={rightsAttention ? true : undefined}
                aria-describedby={rightsAttention ? "proof-rights-error" : undefined}
              />
              <span>
                <strong>Required:</strong> I confirm I am authorised to share this academic material
                and it follows the VAULTIX content policy.
              </span>
            </label>
            {rightsAttention ? (
              <p className="consent__error" id="proof-rights-error" role="alert">
                Tick this box to confirm you are authorised to share the file, then choose it again.
              </p>
            ) : null}

            <label className="consent">
              <input
                type="checkbox"
                checked={freeReleaseOptIn}
                onChange={(e) => setFreeReleaseOptIn(e.target.checked)}
                disabled={disabled}
              />
              <span>
                <strong>Optional:</strong> Offer this resource for free release. It is released free
                only if a Sheriff also confirms the rights; otherwise only this Wanted&rsquo;s
                Backers get access.
              </span>
            </label>
          </fieldset>

          <label
            className={`dropzone${isDragOver ? " dropzone--active" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              if (!disabled) setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file && !disabled) void handleStartUpload(file);
            }}
          >
            <input
              ref={fileInputRef}
              className="dropzone__input"
              type="file"
              id="proof-file-input"
              data-testid="proof-file-input"
              aria-describedby="proof-file-hint"
              disabled={disabled || busy}
              accept="image/png,image/jpeg,image/webp,application/pdf,.docx,.pptx,.xlsx"
              onChange={handleFileChange}
            />
            <span className="dropzone__title">Click to attach proof file</span>
            <span className="dropzone__hint" id="proof-file-hint">
              Or drag and drop it here. PNG, JPEG, WEBP, PDF or Office documents, up to{" "}
              {formatBytes(maxSizeBytes)}.
            </span>
          </label>
        </>
      )}

      {stage.kind === "validating" && (
        <div className="upload-card" role="status" aria-live="polite">
          <p className="upload-card__heading">Checking your file</p>
          <p className="upload-card__meta">
            <strong>{stage.file.name}</strong> ({formatBytes(stage.file.size)}) stays on this device
            while it is checked.
          </p>
        </div>
      )}

      {(stage.kind === "uploading" || stage.kind === "confirming") && (
        <div className="upload-card">
          <div className="upload-card__row">
            <div>
              <p className="upload-card__name">{stage.file.name}</p>
              <p className="upload-card__meta" aria-live="polite">
                {formatBytes(stage.file.size)} ·{" "}
                {stage.kind === "uploading"
                  ? "Uploading to private review storage…"
                  : "Finishing your submission…"}
              </p>
            </div>
            <span className="upload-card__percent">
              {stage.kind === "uploading" ? `${stage.progress}%` : "100%"}
            </span>
          </div>

          <div
            className="upload-progress"
            role="progressbar"
            aria-label="Upload progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={stage.kind === "uploading" ? stage.progress : 100}
          >
            <div
              data-testid="upload-progress-bar"
              className="upload-progress__bar"
              style={{ width: `${stage.kind === "uploading" ? stage.progress : 100}%` }}
            />
          </div>

          <div className="upload-actions">
            <button
              type="button"
              className="button button--secondary button--compact"
              onClick={handleCancel}
            >
              Cancel Upload
            </button>
          </div>
        </div>
      )}

      {stage.kind === "success" && (
        <div className="upload-card upload-card--success" role="status">
          <div>
            <p className="upload-card__heading">
              {stage.simulated ? "Preview only: nothing was uploaded" : "Uploaded"}
            </p>
            <p className="upload-card__name">{stage.proof.fileName}</p>
            <p className="upload-card__meta">
              {formatBytes(stage.proof.sizeBytes)} ·{" "}
              {stage.simulated
                ? "Fixture preview of the upload flow; no file left this device."
                : "Uploaded and sent for screening"}
            </p>
          </div>

          <div className="upload-actions">
            <button
              type="button"
              className="button button--danger-outline button--compact"
              onClick={() => {
                onRemoveProof?.(stage.proof);
                handleReset();
              }}
              aria-label={`Cancel upload: ${stage.proof.fileName}`}
            >
              Cancel Upload
            </button>
            <button
              type="button"
              className="button button--secondary button--compact"
              onClick={handleReset}
            >
              Upload Another File
            </button>
          </div>
        </div>
      )}

      {stage.kind === "error" && (
        <div className="upload-card upload-card--error" role="alert">
          <div>
            <p className="upload-card__heading">Upload refused</p>
            <p className="upload-card__meta">{stage.message}</p>
          </div>

          <div className="upload-actions">
            {stage.file && (
              <button
                type="button"
                className="button button--primary"
                onClick={() => stage.file && void handleStartUpload(stage.file)}
              >
                Retry
              </button>
            )}
            <button type="button" className="button button--secondary" onClick={handleReset}>
              Choose Different File
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
