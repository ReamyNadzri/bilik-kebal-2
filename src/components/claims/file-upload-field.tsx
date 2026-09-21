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
  | { kind: "success"; proof: CompletedClaimProof }
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
  const [rightsConfirmed, setRightsConfirmed] = useState(true);
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
      if (!rightsConfirmed) {
        const errorMsg = "You must confirm you are authorised to share this material.";
        setStage({ kind: "error", message: errorMsg, file });
        onUploadError?.(errorMsg);
        return;
      }

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
        const errorMsg = "Failed to calculate file checksum. Try another browser.";
        setStage({ kind: "error", message: errorMsg, file });
        onUploadError?.(errorMsg);
        return;
      }

      // 2. Request Presigned Upload URL or simulate for development/fixture preview
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        wantedId,
      );

      if (!isUuid) {
        // Development / fixture preview mode: simulate the upload lifecycle
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

        setStage({ kind: "success", proof });
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
          const errorMsg = json.message || "Failed to initialize upload session.";
          setStage({ kind: "error", message: errorMsg, file });
          onUploadError?.(errorMsg);
          return;
        }

        uploadSession = json.data;
      } catch {
        const errorMsg = "Connection error while preparing upload.";
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
          uploadErr instanceof Error ? uploadErr.message : "Failed to upload file to storage.";
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
          const errorMsg = confirmJson.message || "Failed to confirm upload.";
          setStage({ kind: "error", message: errorMsg, file });
          onUploadError?.(errorMsg);
          return;
        }

        const proof: CompletedClaimProof = confirmJson.data;
        setStage({ kind: "success", proof });
        onUploadComplete?.(proof);
      } catch {
        const errorMsg = "Failed to record upload completion.";
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

  return (
    <div
      className="panel"
      style={{
        borderRadius: "4px",
        padding: "1.75rem",
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        id="proof-file-input"
        data-testid="proof-file-input"
        disabled={disabled || stage.kind === "uploading" || stage.kind === "validating"}
        accept="image/png,image/jpeg,image/webp,application/pdf,.docx,.pptx,.xlsx"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />

      {/* IDLE STATE */}
      {stage.kind === "idle" && (
        <>
          <div
            className="file-upload-dropzone"
            style={{
              border: isDragOver
                ? "2px solid var(--accent-brass, #c89b3c)"
                : "2px dashed var(--border-default, #9c8558)",
              borderRadius: "4px",
              padding: "2.5rem 1.5rem",
              textAlign: "center",
              cursor: disabled ? "not-allowed" : "pointer",
              background: isDragOver ? "var(--bg-selected, #e3d6b4)" : "var(--bg-surface, #fbf3e0)",
              transition: "all 0.15s ease",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.75rem",
            }}
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
            onClick={() => !disabled && fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (!disabled && (e.key === "Enter" || e.key === " ")) {
                fileInputRef.current?.click();
              }
            }}
            tabIndex={disabled ? -1 : 0}
            role="button"
            aria-label="Click to attach proof file"
          >
            <div
              style={{
                width: "54px",
                height: "54px",
                borderRadius: "50%",
                background: "var(--bg-canvas, #f3e6c8)",
                border: "1px solid var(--border-default, #9c8558)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.75rem",
              }}
            >
              📁
            </div>

            <div>
              <p
                style={{
                  fontWeight: "700",
                  fontSize: "1.1rem",
                  margin: "0 0 0.35rem 0",
                  color: "var(--text-primary, #2a2118)",
                }}
              >
                Click to attach proof file
              </p>
              <p
                style={{
                  fontSize: "0.875rem",
                  color: "var(--text-muted, #5e4f37)",
                  margin: 0,
                }}
              >
                Drag and drop your file here, or click to browse
              </p>
              <p
                style={{
                  fontSize: "0.8rem",
                  color: "var(--text-soft, #6b5a3f)",
                  margin: "0.25rem 0 0 0",
                }}
              >
                PNG, JPEG, WEBP, PDF, or Office documents (Max {formatBytes(maxSizeBytes)})
              </p>
            </div>

            <button
              type="button"
              className="button button--secondary"
              style={{ marginTop: "0.5rem", pointerEvents: "none" }}
              tabIndex={-1}
            >
              Select File
            </button>
          </div>

          {/* Policy Checklist */}
          <div
            style={{
              background: "var(--bg-surface, #fbf3e0)",
              border: "1px solid var(--border-subtle, #d3bc92)",
              borderRadius: "4px",
              padding: "1rem 1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "0.75rem",
                cursor: "pointer",
                fontSize: "0.9rem",
                color: "var(--text-primary, #2a2118)",
              }}
            >
              <input
                type="checkbox"
                checked={rightsConfirmed}
                onChange={(e) => setRightsConfirmed(e.target.checked)}
                style={{ marginTop: "0.2rem", accentColor: "var(--accent-brass, #c89b3c)" }}
              />
              <span>
                <strong>Required:</strong> I confirm I am authorised to share this academic material
                and it complies with VAULTIX content policy.
              </span>
            </label>

            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "0.75rem",
                cursor: "pointer",
                fontSize: "0.9rem",
                color: "var(--text-muted, #5e4f37)",
              }}
            >
              <input
                type="checkbox"
                checked={freeReleaseOptIn}
                onChange={(e) => setFreeReleaseOptIn(e.target.checked)}
                style={{ marginTop: "0.2rem", accentColor: "var(--accent-brass, #c89b3c)" }}
              />
              <span>
                <strong>Optional:</strong> Allow free release to all verified students 48 hours
                after Sheriff approval.
              </span>
            </label>
          </div>
        </>
      )}

      {/* VALIDATING STATE */}
      {stage.kind === "validating" && (
        <div
          style={{
            padding: "2rem",
            textAlign: "center",
            background: "var(--bg-surface, #fbf3e0)",
            border: "1px solid var(--border-default, #9c8558)",
            borderRadius: "4px",
          }}
        >
          <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>⏳</div>
          <p style={{ margin: "0 0 0.25rem 0", fontWeight: "700" }}>
            Validating &amp; Calculating Checksum
          </p>
          <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-muted, #5e4f37)" }}>
            Hashing <strong>{stage.file.name}</strong> ({formatBytes(stage.file.size)}) using
            SHA-256...
          </p>
        </div>
      )}

      {/* UPLOADING OR CONFIRMING STATE */}
      {(stage.kind === "uploading" || stage.kind === "confirming") && (
        <div
          style={{
            padding: "1.5rem",
            background: "var(--bg-surface, #fbf3e0)",
            border: "1px solid var(--border-default, #9c8558)",
            borderRadius: "4px",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p
                style={{
                  margin: "0 0 0.2rem 0",
                  fontWeight: "700",
                  fontSize: "1rem",
                  color: "var(--text-primary, #2a2118)",
                }}
              >
                {stage.file.name}
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: "0.85rem",
                  color: "var(--text-muted, #5e4f37)",
                }}
              >
                {formatBytes(stage.file.size)} ·{" "}
                {stage.kind === "uploading"
                  ? "Uploading to private quarantine..."
                  : "Finalizing submission..."}
              </p>
            </div>
            <span
              className="numeric"
              style={{
                fontFamily: "var(--font-display, serif)",
                fontSize: "1.25rem",
                fontWeight: "700",
                color: "var(--accent-brass, #c89b3c)",
              }}
            >
              {stage.kind === "uploading" ? `${stage.progress}%` : "100%"}
            </span>
          </div>

          {/* Progress Bar */}
          <div
            style={{
              width: "100%",
              height: "10px",
              borderRadius: "5px",
              background: "var(--bg-selected, #e3d6b4)",
              overflow: "hidden",
              border: "1px solid var(--border-subtle, #d3bc92)",
            }}
          >
            <div
              data-testid="upload-progress-bar"
              style={{
                height: "100%",
                width: stage.kind === "uploading" ? `${stage.progress}%` : "100%",
                background: "linear-gradient(90deg, #b79763, #c89b3c)",
                transition: "width 0.2s ease",
              }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              className="button button--secondary"
              onClick={handleCancel}
              style={{ fontSize: "0.85rem" }}
            >
              Cancel Upload
            </button>
          </div>
        </div>
      )}

      {/* SUCCESS STATE */}
      {stage.kind === "success" && (
        <div
          style={{
            border: "2px solid var(--state-success, #2e7d32)",
            background: "rgba(46, 125, 50, 0.08)",
            padding: "1.5rem",
            borderRadius: "4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "1rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "50%",
                background: "var(--state-success, #2e7d32)",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.25rem",
                fontWeight: "bold",
              }}
            >
              ✓
            </div>
            <div>
              <p
                style={{
                  margin: "0 0 0.25rem 0",
                  fontWeight: "700",
                  fontSize: "1.05rem",
                  color: "var(--text-primary, #2a2118)",
                }}
              >
                {stage.proof.fileName}
              </p>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-muted, #5e4f37)" }}>
                {formatBytes(stage.proof.sizeBytes)} · Uploaded and sent for screening
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button
              type="button"
              className="button button--secondary"
              onClick={() => {
                onRemoveProof?.(stage.proof);
                handleReset();
              }}
              style={{
                fontSize: "0.85rem",
                color: "var(--state-error, #b71c1c)",
                borderColor: "rgba(183, 28, 28, 0.4)",
              }}
              aria-label={`Cancel upload: ${stage.proof.fileName}`}
            >
              Cancel Upload
            </button>
            <button
              type="button"
              className="button button--secondary"
              onClick={handleReset}
              style={{ fontSize: "0.85rem" }}
            >
              Upload Another File
            </button>
          </div>
        </div>
      )}

      {/* ERROR STATE */}
      {stage.kind === "error" && (
        <div
          style={{
            border: "2px solid var(--state-error, #b71c1c)",
            background: "rgba(183, 28, 28, 0.08)",
            padding: "1.25rem 1.5rem",
            borderRadius: "4px",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
            <span
              style={{
                color: "var(--state-error, #b71c1c)",
                fontSize: "1.2rem",
                fontWeight: "bold",
              }}
            >
              ⚠
            </span>
            <div>
              <p
                style={{
                  margin: "0 0 0.2rem 0",
                  fontWeight: "700",
                  color: "var(--state-error, #b71c1c)",
                }}
              >
                Upload Refused
              </p>
              <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-primary, #2a2118)" }}>
                {stage.message}
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.25rem" }}>
            {stage.file && (
              <button
                type="button"
                className="button button--primary"
                onClick={() => stage.file && void handleStartUpload(stage.file)}
                style={{ fontSize: "0.85rem" }}
              >
                Retry
              </button>
            )}
            <button
              type="button"
              className="button button--secondary"
              onClick={handleReset}
              style={{ fontSize: "0.85rem" }}
            >
              Choose Different File
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
