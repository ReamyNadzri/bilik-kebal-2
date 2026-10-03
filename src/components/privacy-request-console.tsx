"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  PRIVACY_REQUEST_DETAILS_MAX,
  PRIVACY_REQUEST_LABEL,
  type PrivacyRequestCode,
  type PrivacyRequestItem,
} from "@/contracts/legal";
import { callOperation } from "@/features/presentation/call-operation";

const DATE = new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "short", year: "numeric" });

/**
 * The Owner's privacy queue: open requests oldest first, each answered in
 * writing. The member reads the answer on their profile; nothing is emailed.
 */
export function PrivacyRequestConsole({
  open,
  answered,
}: {
  readonly open: readonly PrivacyRequestItem[];
  readonly answered: readonly PrivacyRequestItem[] | null;
}) {
  return (
    <div className="privacy-console">
      <section className="panel" aria-labelledby="privacy-open-heading">
        <h2 id="privacy-open-heading">Waiting for an answer ({open.length})</h2>
        <p className="profile-card__hint">
          The Privacy Notice tells members to expect an answer normally within 21 days. A copy of
          their data, a correction or a deletion is done by hand; write what was done.
        </p>
        {open.length === 0 ? (
          <p>No privacy requests are waiting.</p>
        ) : (
          <ul className="privacy-console__list">
            {open.map((request) => (
              <OpenRequest key={request.id} request={request} />
            ))}
          </ul>
        )}
      </section>

      <section className="panel" aria-labelledby="privacy-answered-heading">
        <h2 id="privacy-answered-heading">Answered</h2>
        {answered === null ? (
          <p>Answered requests could not be loaded.</p>
        ) : answered.length === 0 ? (
          <p>None yet.</p>
        ) : (
          <ul className="privacy-console__list">
            {answered.map((request) => (
              <li className="privacy-console__item" key={request.id}>
                <RequestSummary request={request} />
                <p>
                  <strong>
                    Answered
                    {request.answeredAt ? ` ${DATE.format(new Date(request.answeredAt))}` : ""}:
                  </strong>{" "}
                  {request.answer}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function RequestSummary({ request }: { readonly request: PrivacyRequestItem }) {
  return (
    <>
      <p className="trust-row__title">
        {PRIVACY_REQUEST_LABEL[request.kind]} ·{" "}
        <Link href={`/u/${request.memberPublicId}`}>{request.memberDisplayName}</Link>
      </p>
      <p className="trust-row__body">Sent {DATE.format(new Date(request.createdAt))}</p>
      <p className="privacy-console__details">{request.details}</p>
    </>
  );
}

function OpenRequest({ request }: { readonly request: PrivacyRequestItem }) {
  const router = useRouter();
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fieldId = `privacy-answer-${request.id}`;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (answer.trim() === "") {
      setError("Write the answer the member will read.");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await callOperation<{ done: true }, PrivacyRequestCode>(
      `/api/console/privacy-requests/${request.id}/answer`,
      { answer: answer.trim() },
      "PRIVACY_UNAVAILABLE",
    );
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.refresh();
  }

  return (
    <li className="privacy-console__item">
      <RequestSummary request={request} />
      <form onSubmit={submit} noValidate>
        <div className="form-field">
          <label className="form-field__label" htmlFor={fieldId}>
            Answer to {request.memberDisplayName}
          </label>
          {error === null ? null : (
            <p className="form-field__error" id={`${fieldId}-error`} role="alert">
              {error}
            </p>
          )}
          <textarea
            className="form-field__input"
            id={fieldId}
            rows={3}
            maxLength={PRIVACY_REQUEST_DETAILS_MAX}
            value={answer}
            aria-invalid={error === null ? undefined : true}
            aria-describedby={error === null ? undefined : `${fieldId}-error`}
            onChange={(event) => setAnswer(event.target.value)}
          />
        </div>
        <div className="profile-form__actions">
          <button className="button button--primary" type="submit" disabled={busy}>
            {busy ? "Saving…" : "Send answer"}
          </button>
        </div>
      </form>
    </li>
  );
}
