"use client";

import { useState } from "react";

export interface DownloadButtonProps {
  readonly claimId: string;
  readonly label: string;
}

/**
 * Asks the server for a short-lived signed link to an approved resource the
 * viewer is entitled to, then opens it. The link is never stored or shown.
 */
export function DownloadButton({ claimId, label }: DownloadButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/claims/${encodeURIComponent(claimId)}/download`);
      const body = (await response.json()) as
        { ok: true; data: { downloadUrl: string } } | { ok: false; message?: string };
      if (body.ok) {
        window.open(body.data.downloadUrl, "_blank", "noopener,noreferrer");
      } else {
        setError(body.message ?? "This download is not available.");
      }
    } catch {
      setError("The download could not be prepared. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="button button--green button--block"
        onClick={() => void download()}
        disabled={busy}
        aria-label={`Download ${label}`}
      >
        {busy ? "Preparing…" : "Download"}
      </button>
      {error ? (
        <p className="form-field__error" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}
