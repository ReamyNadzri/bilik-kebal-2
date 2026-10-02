"use client";

import { useEffect, useState } from "react";
import type { ClaimReviewQueueItem } from "@/contracts/claim-reviews";
import { formatSubmittedAge } from "@/features/marketplace/time";
import { ClaimReviewDetail, STATUS_LABEL, type ClaimDecision } from "./claim-review-detail";
import { UiStatus } from "./ui-status";

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; items: ClaimReviewQueueItem[] };

/**
 * Claims waiting for a human decision: the list on the left, the chosen
 * claim and its decision form on the right. Screening is evidence only; the
 * decision recorded here is the one that counts.
 */
export function ClaimReviewConsole() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [decisionError, setDecisionError] = useState("");
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
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function decide(
    item: ClaimReviewQueueItem,
    decision: ClaimDecision,
    reasonCode: string,
    notes: string | null,
  ) {
    if (busy) return;
    setBusy(true);
    setNotice("");
    setDecisionError("");
    try {
      const response = await fetch("/api/claims/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claimId: item.claimId, decision, reasonCode, notes }),
      });
      const body = await response.json();
      if (!response.ok || !body.ok) {
        setDecisionError(body.message ?? "The decision was not recorded.");
        return;
      }
      setNotice("Decision recorded.");
      setSelectedId(null);
      setState((current) =>
        current.kind === "ready"
          ? { kind: "ready", items: current.items.filter((row) => row.claimId !== item.claimId) }
          : current,
      );
    } catch {
      setDecisionError("The decision was not recorded. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const items = state.kind === "ready" ? state.items : [];
  const selected = items.find((item) => item.claimId === selectedId) ?? null;
  const now = new Date().toISOString();

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
      {state.kind === "ready" && items.length === 0 ? (
        <UiStatus
          kind="empty"
          heading="No claims are waiting for review"
          message="Approved and rejected claims leave this queue."
        />
      ) : null}
      {state.kind === "ready" && items.length > 0 ? (
        <div className={`people${selected ? " people--open" : ""}`}>
          <section className="panel people__directory" aria-labelledby="claim-list-heading">
            <h3 className="people__heading" id="claim-list-heading">
              Waiting <span className="people__count">{items.length}</span>
            </h3>
            <ul
              className="people__list console-scroll-list"
              tabIndex={0}
              aria-label={`${items.length} claim reviews waiting`}
            >
              {items.map((item) => (
                <li key={item.claimId}>
                  <button
                    type="button"
                    className="people-row"
                    aria-current={item.claimId === selectedId ? "true" : undefined}
                    onClick={() => {
                      setSelectedId(item.claimId);
                      setDecisionError("");
                    }}
                  >
                    <span className="people-row__name">{item.fileName}</span>
                    <span className="people-row__meta">
                      {item.wantedTitle ?? "Wanted not visible"} · {STATUS_LABEL[item.status]} ·{" "}
                      {formatSubmittedAge(item.createdAt, now)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <section className="panel people__detail" aria-label="Claim details">
            {selected ? (
              <ClaimReviewDetail
                key={selected.claimId}
                item={selected}
                busy={busy}
                error={decisionError}
                onDecide={(decision, reasonCode, notes) =>
                  void decide(selected, decision, reasonCode, notes)
                }
                onClose={() => setSelectedId(null)}
              />
            ) : (
              <p className="people__placeholder">
                Choose a claim to see its details and record a decision.
              </p>
            )}
          </section>
        </div>
      ) : null}
    </section>
  );
}
