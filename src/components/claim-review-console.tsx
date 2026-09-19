"use client";

import { useEffect, useState } from "react";
import type { ClaimReviewQueueItem } from "@/contracts/claim-reviews";
import { UiStatus } from "./ui-status";

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; items: ClaimReviewQueueItem[] };

export function ClaimReviewConsole() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  async function load() {
    setState({ kind: "loading" });
    try {
      const response = await fetch("/api/claims/reviews", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok || !body.ok) {
        setState({
          kind: "error",
          message: body.message ?? "The claim review queue is unavailable.",
        });
        return;
      }
      setState({ kind: "ready", items: body.data });
    } catch {
      setState({
        kind: "error",
        message: "The claim review queue is unavailable. Try again shortly.",
      });
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function decide(
    item: ClaimReviewQueueItem,
    decision: "approve" | "reject" | "request_information",
  ) {
    if (busyId) return;
    const reasonCode = window.prompt(
      "Reason code (lowercase_with_underscores)",
      decision === "approve" ? "rights_confirmed" : "needs_review",
    );
    if (!reasonCode) return;
    setBusyId(item.claimId);
    setNotice("");
    try {
      const response = await fetch("/api/claims/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claimId: item.claimId, decision, reasonCode }),
      });
      const body = await response.json();
      if (!response.ok || !body.ok) {
        setNotice(body.message ?? "The decision was not recorded.");
        return;
      }
      setNotice("Decision recorded.");
      setState((current) =>
        current.kind === "ready"
          ? { kind: "ready", items: current.items.filter((row) => row.claimId !== item.claimId) }
          : current,
      );
    } catch {
      setNotice("The decision was not recorded. Try again.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="review-console" aria-labelledby="claim-review-heading">
      <h2 id="claim-review-heading">Claim review queue</h2>
      <p className="review-console__disclaimer">
        Screening is evidence. A human Sheriff records the final decision.
      </p>
      {notice ? <p role="status">{notice}</p> : null}
      {state.kind === "loading" ? (
        <UiStatus kind="loading" heading="Loading claim reviews" />
      ) : null}
      {state.kind === "error" ? (
        <UiStatus
          kind="offline"
          heading="Claim reviews unavailable"
          message={state.message}
          action={
            <button type="button" onClick={() => void load()}>
              Try again
            </button>
          }
        />
      ) : null}
      {state.kind === "ready" && state.items.length === 0 ? (
        <UiStatus
          kind="empty"
          heading="No claims are waiting for review"
          message="Approved and rejected claims leave this queue."
        />
      ) : null}
      {state.kind === "ready" && state.items.length > 0 ? (
        <ul className="review-queue" aria-label={`${state.items.length} claim reviews waiting`}>
          {state.items.map((item) => (
            <li key={item.claimId} className="review-queue__item">
              <article className="review-queue__row">
                <strong className="review-queue__name">{item.fileName}</strong>
                <span className="review-queue__institution">{item.status.replace("_", " ")}</span>
                <span className="review-queue__date">
                  {item.mimeType} · {Math.round(item.sizeBytes / 1024)} KB
                </span>
                <div className="review-console__actions">
                  <button
                    type="button"
                    className="auth-form__submit"
                    disabled={busyId !== null}
                    onClick={() => void decide(item, "approve")}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="auth-form__submit"
                    disabled={busyId !== null}
                    onClick={() => void decide(item, "request_information")}
                  >
                    Request information
                  </button>
                  <button
                    type="button"
                    className="auth-form__submit"
                    disabled={busyId !== null}
                    onClick={() => void decide(item, "reject")}
                  >
                    Reject
                  </button>
                </div>
              </article>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
