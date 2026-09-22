"use client";

import {
  CLAIM_MAX_BYTES,
  claimMimeTypes,
  type ClaimMimeType,
  type ClaimsOperationCode,
  type ClaimSubmissionInput,
  type ClaimUploadSession,
  type CreateClaimUploadResult,
} from "@/contracts/claims";
import type { OperationResult } from "@/contracts/operation-result";
import { callOperation } from "@/features/presentation/call-operation";

/**
 * Computes the client-side SHA-256 hex digest of a file using the Web Crypto API.
 * Files never pass through the Next.js process or edge functions for hashing.
 */
export async function computeFileSha256(file: Blob | File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digestBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(digestBuffer));
  return hashArray.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export interface FileValidationResult {
  readonly valid: boolean;
  readonly error?: string;
}

/**
 * Client-side validation enforcing repository file invariants:
 * - Max 50 MB
 * - Allowed types: PDF, DOCX, PPTX, XLSX, JPEG, PNG, WEBP
 * - Valid filename without path traversal characters
 */
export function validateClaimFile(file: File): FileValidationResult {
  if (file.size <= 0) {
    return { valid: false, error: "File cannot be empty." };
  }
  if (file.size > CLAIM_MAX_BYTES) {
    return { valid: false, error: "File exceeds 50 MB maximum allowed size." };
  }
  if (!claimMimeTypes.includes(file.type as ClaimMimeType)) {
    return {
      valid: false,
      error:
        "Unsupported file type. Allowed formats: PDF, Word (DOCX), PowerPoint (PPTX), Excel (XLSX), JPEG, PNG, WEBP.",
    };
  }
  if (/[\\/\0]/.test(file.name) || file.name.length > 255) {
    return { valid: false, error: "Filename is invalid or contains disallowed characters." };
  }
  return { valid: true };
}

/**
 * Requests an upload session from the server-side claim upload gateway.
 * Target route: POST /api/claims/upload-url
 */
export async function requestClaimUploadSession(
  input: ClaimSubmissionInput,
): Promise<CreateClaimUploadResult> {
  return callOperation<ClaimUploadSession, ClaimsOperationCode>(
    "/api/claims/upload-url",
    input,
    "CLAIMS_UNAVAILABLE",
  );
}

/**
 * Uploads untrusted file bytes directly from browser to private quarantine bucket
 * via pre-signed PUT URL. Next.js server runtime never streams or parses file content.
 */
export async function uploadFileToQuarantine(
  signedUrl: string,
  file: File,
  mimeType: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch(signedUrl, {
      method: "PUT",
      headers: {
        "Content-Type": mimeType,
      },
      body: file,
    });

    if (!response.ok) {
      return { ok: false, error: "Upload to quarantine storage failed. Please try again." };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: "Network error during quarantine upload. Check your connection." };
  }
}

export type ClaimSubmissionStep = "hashing" | "authorizing" | "uploading" | "complete";

export interface SubmitClaimOptions {
  readonly wantedId: string;
  readonly file: File;
  readonly rightsConfirmed: true;
  readonly freeReleaseOptIn: boolean;
  readonly onProgress?: (step: ClaimSubmissionStep) => void;
}

export type SubmitClaimResult = OperationResult<{ claimId: string }, ClaimsOperationCode>;

/**
 * Orchestrates the full client-side claim submission flow:
 * 1. Validates file locally (size, MIME type, filename).
 * 2. Computes client-side SHA-256 digest via Web Crypto API.
 * 3. Obtains short-lived signed upload session from /api/claims/upload-url.
 * 4. Uploads file directly to private quarantine bucket via signed PUT.
 * 5. Reports progress across states: hashing -> authorizing -> uploading -> complete.
 */
export async function submitClaimFile({
  wantedId,
  file,
  rightsConfirmed,
  freeReleaseOptIn,
  onProgress,
}: SubmitClaimOptions): Promise<SubmitClaimResult> {
  // Step 0: Validate locally
  const validation = validateClaimFile(file);
  if (!validation.valid) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: validation.error ?? "Invalid file.",
    };
  }

  // Step 1: Client-side hashing
  onProgress?.("hashing");
  const sha256 = await computeFileSha256(file);

  // Step 2: Request signed upload session
  onProgress?.("authorizing");
  const sessionResult = await requestClaimUploadSession({
    wantedId,
    fileName: file.name,
    mimeType: file.type as ClaimMimeType,
    sizeBytes: file.size,
    sha256,
    rightsConfirmed,
    freeReleaseOptIn,
  });

  if (!sessionResult.ok) {
    return sessionResult;
  }

  // Step 3: Direct PUT to quarantine storage bucket
  onProgress?.("uploading");
  const upload = await uploadFileToQuarantine(
    sessionResult.data.signedUrl,
    file,
    sessionResult.data.mimeType,
  );

  if (!upload.ok) {
    return {
      ok: false,
      code: "CLAIMS_UNAVAILABLE",
      message: upload.error ?? "File upload failed.",
    };
  }

  // Step 4: Completed
  onProgress?.("complete");
  return {
    ok: true,
    data: {
      claimId: sessionResult.data.claimId,
    },
  };
}
