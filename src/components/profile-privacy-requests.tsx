"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  PRIVACY_REQUEST_DETAILS_MAX,
  PRIVACY_REQUEST_DETAILS_MIN,
  PRIVACY_REQUEST_KINDS,
  PRIVACY_REQUEST_LABEL,
  PRIVACY_REQUEST_OPEN_LIMIT,
  type OwnPrivacyRequest,
  type PrivacyRequestCode,
  type PrivacyRequestKind,
} from "@/contracts/legal";
import { callOperation } from "@/features/presentation/call-operation";

const DATE = new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "short", year: "numeric" });

type Notice = { kind: "ok" | "error"; text: string } | null;

/**
 * The member asks for a copy of their data, a correction or a deletion, and
 * reads the Owner's answer here. Requests go only to the Owner; no email
 * address changes hands either way.
 */
export function ProfilePrivacyRequests({
  requests,
}: {
  readonly requests: readonly OwnPrivacyRequest[] | null;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<PrivacyRequestKind>("access");
  const [details, setDetails] = useState("");
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const waiting = (requests ?? []).filter((request) => request.status === "open").length;
  const full = waiting >= PRIVACY_REQUEST_OPEN_LIMIT;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = details.trim();
    if (text.length < PRIVACY_REQUEST_DETAILS_MIN || text.length > PRIVACY_REQUEST_DETAILS_MAX) {
      setDetailsError(
        `Describe your request in ${PRIVACY_REQUEST_DETAILS_MIN} to ${PRIVACY_REQUEST_DETAILS_MAX.toLocaleString("en-MY")} characters.`,
      );
      return;
    }
    setDetailsError(null);
    setBusy(true);
    setNotice(null);
    const result = await callOperation<{ id: string }, PrivacyRequestCode>(
      "/api/profile/privacy-requests",
      { kind, details: text },
      "PRIVACY_UNAVAILABLE",
    );
    setBusy(false);
    if (!result.ok) {
      setNotice({ kind: "error", text: result.message });
      return;
    }
    setDetails("");
    setNotice({
      kind: "ok",
      text: "Your request was sent to the Owner. The answer will appear below, normally within 21 days.",
    });
    router.refresh();
  }

  return (
    <section
      className="panel profile-card"
      id="privacy-requests"
      aria-labelledby="privacy-requests-heading"
    >
      <h2 id="privacy-requests-heading">Privacy requests</h2>
      <p className="profile-card__hint">
        Ask for a copy of your data, a correction or a deletion. Only the Owner reads these
        requests. See the <Link href="/privacy">Privacy Notice</Link> for what VAULTIX keeps and for
        how long.
      </p>

      {notice === null ? null : (
        <p
          className={`ops-alert ${notice.kind === "ok" ? "ops-alert--success" : "ops-alert--error"}`}
          role={notice.kind === "ok" ? "status" : "alert"}
        >
          {notice.text}
        </p>
      )}

      {full ? (
        <p className="ops-alert ops-alert--warning" role="status">
          You have {PRIVACY_REQUEST_OPEN_LIMIT} requests waiting for an answer. You can send another
          once one is answered.
        </p>
      ) : (
        <form className="privacy-request-form" onSubmit={submit} noValidate>
          <div className="form-field">
            <label className="form-field__label" htmlFor="privacy-request-kind">
              What do you need?
            </label>
            <select
              className="form-field__input"
              id="privacy-request-kind"
              value={kind}
              onChange={(event) => setKind(event.target.value as PrivacyRequestKind)}
            >
              {PRIVACY_REQUEST_KINDS.map((option) => (
                <option key={option} value={option}>
                  {PRIVACY_REQUEST_LABEL[option]}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label className="form-field__label" htmlFor="privacy-request-details">
              Details
              <span className="form-field__required"> (required)</span>
            </label>
            <p className="form-field__hint" id="privacy-request-details-hint">
              Say which data, and what should change. Do not include passwords or bank numbers.
            </p>
            {detailsError === null ? null : (
              <p className="form-field__error" id="privacy-request-details-error">
                {detailsError}
              </p>
            )}
            <textarea
              className="form-field__input"
              id="privacy-request-details"
              rows={4}
              maxLength={PRIVACY_REQUEST_DETAILS_MAX}
              value={details}
              aria-invalid={detailsError === null ? undefined : true}
              aria-describedby={
                detailsError === null
                  ? "privacy-request-details-hint"
                  : "privacy-request-details-hint privacy-request-details-error"
              }
              onChange={(event) => setDetails(event.target.value)}
            />
          </div>
          <div className="profile-form__actions">
            <button className="button button--primary" type="submit" disabled={busy}>
              {busy ? "Sending…" : "Send request"}
            </button>
          </div>
        </form>
      )}

      {requests === null ? (
        <p className="profile-card__hint">Your requests could not be loaded right now.</p>
      ) : requests.length === 0 ? null : (
        <ul className="entry-list" aria-label="Your privacy requests">
          {requests.map((request) => (
            <li className="entry-list__item" key={request.id}>
              <div>
                <p className="trust-row__title">{PRIVACY_REQUEST_LABEL[request.kind]}</p>
                <p className="trust-row__body">
                  Sent {DATE.format(new Date(request.createdAt))} · {request.details}
                </p>
                {request.answer === null ? null : (
                  <p className="trust-row__body">
                    <strong>
                      Answer
                      {request.answeredAt ? `, ${DATE.format(new Date(request.answeredAt))}` : ""}:
                    </strong>{" "}
                    {request.answer}
                  </p>
                )}
              </div>
              <span
                className={`status-stamp ${
                  request.status === "answered" ? "status-stamp--success" : "status-stamp--warning"
                }`}
              >
                {request.status === "answered" ? "Answered" : "Waiting"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
