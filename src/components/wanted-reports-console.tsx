"use client";

import Link from "next/link";
import { useState } from "react";
import {
  WANTED_REPORT_LABEL,
  type WantedReportCode,
  type WantedReportItem,
} from "@/contracts/wanted-reports";
import { callOperation } from "@/features/presentation/call-operation";

const DATE = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kuala_Lumpur",
});

/**
 * Members' reports on Wanted requests, for Sheriffs and the Owner. A report is
 * evidence only: Dismiss closes one that needs nothing; acting on one happens
 * on the Wanted itself, where the Owner can remove it (which marks its
 * reports actioned).
 */
export function WantedReportsConsole({
  reports,
}: {
  readonly reports: readonly WantedReportItem[];
}) {
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  async function dismiss(id: string) {
    setError(null);
    const result = await callOperation<{ done: true }, WantedReportCode>(
      `/api/console/wanted-reports/${encodeURIComponent(id)}/dismiss`,
      {},
      "REPORTS_UNAVAILABLE",
    );
    if (!result.ok) {
      setError(result.message || "The report could not be dismissed.");
      return;
    }
    setDismissed((current) => new Set(current).add(id));
  }

  const visible = reports.filter((report) => !dismissed.has(report.id));

  return (
    <section className="panel ops-panel" aria-labelledby="wanted-reports-heading">
      <h2 className="ops-panel__title" id="wanted-reports-heading">
        Reported Wanteds
      </h2>
      <p className="form-field__hint">
        Reports from members. Open the Wanted to judge it; the Owner can remove it there, and the
        poster then forfeits their own money while every Backer is refunded.
      </p>
      {error ? (
        <p className="form-field__error" role="alert">
          {error}
        </p>
      ) : null}
      {visible.length === 0 ? (
        <p className="replies__empty">No reports waiting.</p>
      ) : (
        <ul className="ops-list">
          {visible.map((report) => (
            <li className="ops-list__item" key={report.id}>
              <p className="trust-row__title">
                <Link href={`/wanted/${report.wantedPublicId}`}>{report.wantedTitle}</Link>
              </p>
              <p className="trust-row__body">
                {WANTED_REPORT_LABEL[report.category]}
                {report.reportCount > 1
                  ? ` · ${report.reportCount} reports on this Wanted`
                  : ""} ·{" "}
                <time dateTime={report.createdAt}>{DATE.format(new Date(report.createdAt))}</time>
              </p>
              {report.details ? (
                <p className="trust-row__body">&ldquo;{report.details}&rdquo;</p>
              ) : null}
              <button
                type="button"
                className="button button--secondary button--compact"
                onClick={() => void dismiss(report.id)}
              >
                Dismiss
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
