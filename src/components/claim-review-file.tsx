"use client";

import { useId, useState } from "react";
import type { ClaimFileAccess, ClaimFilePurpose } from "@/contracts/claim-reviews";

const GENERIC_ERROR = "The file could not be opened. Try again.";

type Action = "preview" | "view" | "download";

type Fetched = { ok: true; data: ClaimFileAccess } | { ok: false; message: string };

/**
 * A fresh five-minute URL per click, so an expired one is never reused. The
 * server authorises and audits each request; the file itself is served by the
 * Storage domain, never this app.
 */
async function fetchSignedUrl(claimId: string, purpose: ClaimFilePurpose): Promise<Fetched> {
  try {
    const response = await fetch(
      `/api/claims/reviews/${encodeURIComponent(claimId)}/file?purpose=${purpose}`,
      { cache: "no-store" },
    );
    const body = (await response.json()) as
      { ok: true; data: ClaimFileAccess } | { ok: false; code?: string; message?: string };
    if (body.ok) return body;
    // Unavailable or unexpected failures read the same; refusals say why.
    const refusal = response.status >= 400 && response.status < 500 && body.message;
    return { ok: false, message: refusal || GENERIC_ERROR };
  } catch {
    return { ok: false, message: GENERIC_ERROR };
  }
}

/**
 * The reviewer's way into a claim's raw, unscanned file: an on-click image
 * preview (nothing untrusted loads until asked), a PDF opened in a new tab by
 * the browser's own viewer, and a download for every type.
 */
export function ClaimReviewFile({
  claimId,
  fileName,
  mimeType,
}: {
  readonly claimId: string;
  readonly fileName: string;
  readonly mimeType: string;
}) {
  const headingId = useId();
  const [busy, setBusy] = useState<Action | null>(null);
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const isImage = mimeType.startsWith("image/");
  const isPdf = mimeType === "application/pdf";

  async function preview() {
    setBusy("preview");
    setError("");
    const result = await fetchSignedUrl(claimId, "view");
    setBusy(null);
    if (result.ok) setPreviewUrl(result.data.url);
    else setError(result.message);
  }

  async function view() {
    // Opened during the click so popup blockers allow it; pointed at the file
    // once the URL arrives, and cut off from this page first.
    const tab = window.open("", "_blank");
    if (tab) tab.opener = null;
    setBusy("view");
    setError("");
    setFallbackUrl(null);
    const result = await fetchSignedUrl(claimId, "view");
    setBusy(null);
    if (!result.ok) {
      tab?.close();
      setError(result.message);
      return;
    }
    if (tab) tab.location.href = result.data.url;
    else setFallbackUrl(result.data.url);
  }

  async function download() {
    setBusy("download");
    setError("");
    const result = await fetchSignedUrl(claimId, "download");
    setBusy(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    // The signed URL answers with an attachment, so the page stays put.
    const link = document.createElement("a");
    link.href = result.data.url;
    link.rel = "noopener noreferrer";
    link.click();
  }

  return (
    <section className="claim-file" aria-labelledby={headingId}>
      <h4 className="claim-file__title" id={headingId}>
        File
      </h4>
      <p className="ops-alert ops-alert--warning">
        This file has not been virus-scanned yet. Open it only if it is what you expect, and never
        turn on editing or macros if Word, Excel or PowerPoint asks.
      </p>
      <div className="claim-file__actions">
        {isImage ? (
          previewUrl ? (
            <button
              type="button"
              className="button button--quiet button--compact"
              onClick={() => setPreviewUrl(null)}
            >
              Hide preview
            </button>
          ) : (
            <button
              type="button"
              className="button button--quiet button--compact"
              disabled={busy !== null}
              aria-label={`Show preview of ${fileName}`}
              onClick={() => void preview()}
            >
              {busy === "preview" ? "Opening…" : "Show preview"}
            </button>
          )
        ) : null}
        {isPdf ? (
          <button
            type="button"
            className="button button--quiet button--compact"
            disabled={busy !== null}
            aria-label={`View ${fileName}`}
            onClick={() => void view()}
          >
            {busy === "view" ? "Opening…" : "View"}
          </button>
        ) : null}
        <button
          type="button"
          className="button button--quiet button--compact"
          disabled={busy !== null}
          aria-label={`Download ${fileName}`}
          onClick={() => void download()}
        >
          {busy === "download" ? "Preparing…" : "Download"}
        </button>
      </div>
      {error ? (
        <p className="form-field__error" role="alert">
          {error}
        </p>
      ) : null}
      {fallbackUrl ? (
        <p className="claim-file__fallback">
          Your browser blocked the new tab.{" "}
          <a href={fallbackUrl} target="_blank" rel="noopener noreferrer">
            Open {fileName} in a new tab
          </a>{" "}
          (the link works for five minutes).
        </p>
      ) : null}
      {previewUrl ? (
        // A signed, short-lived URL on the Storage domain; next/image would
        // proxy it through this app, which untrusted files must never be.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="claim-file__preview"
          src={previewUrl}
          alt={fileName}
          referrerPolicy="no-referrer"
          onError={() => {
            setPreviewUrl(null);
            setError(GENERIC_ERROR);
          }}
        />
      ) : null}
    </section>
  );
}
