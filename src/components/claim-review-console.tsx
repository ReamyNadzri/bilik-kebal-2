"use client";

import { useEffect, useRef, useState } from "react";
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
  // Where focus goes once the list re-renders after a decision: a claim id
  // (its row), or "heading" when no other claim is left to move to.
  const [focusTarget, setFocusTarget] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

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
      if (state.kind === "ready") {
        const rows = state.items;
        const index = rows.findIndex((row) => row.claimId === item.claimId);
        // A claim sent back to its Hunter stays queued; approved or rejected ones leave.
        const next =
          decision === "request_information"
            ? rows.map((row) =>
                row.claimId === item.claimId
                  ? { ...row, status: "needs_information" as const }
                  : row,
              )
            : rows.filter((row) => row.claimId !== item.claimId);
        const others = rows.filter((row) => row.claimId !== item.claimId);
        const after = rows.slice(index + 1).find((row) => row.claimId !== item.claimId);
        const target = after ?? others[others.length - 1];
        setFocusTarget(target ? target.claimId : "heading");
        setState({ kind: "ready", items: next });
      }
    } catch {
      setDecisionError("The decision was not recorded. Try again.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (focusTarget === null) return;
    const row =
      focusTarget === "heading"
        ? null
        : listRef.current?.querySelector<HTMLElement>(`[data-claim-id="${focusTarget}"]`);
    (row ?? headingRef.current)?.focus();
    setFocusTarget(null);
  }, [focusTarget]);

  const items = state.kind === "ready" ? state.items : [];
  const selected = items.find((item) => item.claimId === selectedId) ?? null;
  const now = new Date().toISOString();

  return (
    <section className="review-console" aria-labelledby="claim-review-heading">
      <h2 id="claim-review-heading" tabIndex={-1} ref={headingRef}>
        Claim review queue
      </h2>
      <p className="review-console__disclaimer">
        Screening is evidence. A human Sheriff records the final decision.
      </p>
      {/* Always present, so a notice added later is announced. */}
      <p role="status">{notice}</p>
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
              ref={listRef}
              aria-label={`${items.length} claim reviews waiting`}
            >
              {items.map((item) => (
                <li key={item.claimId}>
                  <button
                    type="button"
                    className="people-row"
                    data-claim-id={item.claimId}
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
