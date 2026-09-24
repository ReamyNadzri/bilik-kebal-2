"use client";

import { useEffect, useState } from "react";
import { type ClaimAppealDetails } from "@/contracts/moderation";
import { UiStatus } from "../ui-status";

interface SheriffAppealConsoleProps {
  currentSheriffUserId: string;
}

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; items: ClaimAppealDetails[] };

export function SheriffAppealConsole({ currentSheriffUserId }: SheriffAppealConsoleProps) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function load() {
    setState({ kind: "loading" });
    try {
      const response = await fetch("/api/sheriff/moderation", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok || !body.ok) {
        setState({
          kind: "error",
          message: body.message ?? "The moderation queue is unavailable.",
        });
        return;
      }
      setState({ kind: "ready", items: body.data.appeals ?? [] });
    } catch {
      setState({
        kind: "error",
        message: "The moderation queue is unavailable. Try again shortly.",
      });
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function decide(appeal: ClaimAppealDetails, decision: "upheld" | "overturned") {
    if (busyId) return;

    // Client-side guard for segregation of duties
    if (appeal.reviewerUserId === currentSheriffUserId) {
      setNotice(
        "Segregation of duties: You issued the original decision and cannot review this appeal.",
      );
      return;
    }

    const reasonCode =
      decision === "overturned"
        ? "decision_overturned_evidence_valid"
        : "decision_upheld_policy_violation";
    const rationale = (notes[appeal.id] ?? "").trim();

    setBusyId(appeal.id);
    setNotice("");

    try {
      const response = await fetch(`/api/sheriff/appeals/${appeal.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, reasonCode, notes: rationale }),
      });

      const body = await response.json();
      if (!response.ok || !body.ok) {
        setNotice(body.message ?? "The appeal decision was not recorded.");
        return;
      }

      setNotice(
        decision === "overturned"
          ? "Appeal overturned. The claim is back in the review queue."
          : "Appeal upheld. The rejection stands.",
      );

      setState((current) =>
        current.kind === "ready"
          ? { kind: "ready", items: current.items.filter((item) => item.id !== appeal.id) }
          : current,
      );
    } catch {
      setNotice(
        "VAULTIX could not confirm the decision was recorded. Reload the queue before retrying.",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="panel ops-panel" aria-labelledby="claim-appeals-heading">
      <div className="ops-panel__head">
        <div>
          <h2 id="claim-appeals-heading" className="ops-panel__title">
            Claim appeals
          </h2>
          <p className="ops-panel__lede">
            Each appeal must be decided by a different Sheriff from the one who made the original
            decision. While an appeal is open, the request&rsquo;s expiry and refunds are paused.
          </p>
        </div>
      </div>

      {notice ? (
        <p role="status" className="ops-alert ops-alert--info">
          {notice}
        </p>
      ) : null}

      {state.kind === "loading" ? (
        <UiStatus kind="loading" heading="Loading claim appeals" />
      ) : null}

      {state.kind === "error" ? (
        <UiStatus
          kind="offline"
          heading="Appeals queue unavailable"
          message={state.message}
          action={
            <button type="button" className="button button--secondary" onClick={() => void load()}>
              Try again
            </button>
          }
        />
      ) : null}

      {state.kind === "ready" && state.items.length === 0 ? (
        <UiStatus
          kind="empty"
          heading="No appeals waiting"
          message="Every appeal has been decided."
        />
      ) : null}

      {state.kind === "ready" && state.items.length > 0 ? (
        <ul className="appeal-list" aria-label={`${state.items.length} claim appeals waiting`}>
          {state.items.map((appeal) => {
            const isOriginalReviewer = appeal.reviewerUserId === currentSheriffUserId;
            const notesId = `appeal-notes-${appeal.id}`;

            return (
              <li key={appeal.id} className="locker-card appeal-card">
                <div className="locker-card__top">
                  <span className="pixel-label">Appeal {appeal.id.slice(0, 8)}</span>
                  <span className="status-stamp status-stamp--warning">
                    Decide by{" "}
                    {new Date(appeal.appealDeadline).toLocaleDateString("en-MY", {
                      dateStyle: "medium",
                    })}
                  </span>
                </div>

                <div className="locker-card__note">
                  <strong>Why the Hunter is appealing</strong>
                  <p className="reply__text">{appeal.reason}</p>
                </div>

                {isOriginalReviewer ? (
                  <p role="alert" className="ops-alert ops-alert--error">
                    You made the original decision on this claim, so you cannot decide its appeal.
                    Another Sheriff must review it.
                  </p>
                ) : (
                  <div className="form-field">
                    <label className="form-field__label" htmlFor={notesId}>
                      Your reasoning <span className="form-field__required">(optional)</span>
                    </label>
                    <textarea
                      id={notesId}
                      className="form-field__input"
                      rows={3}
                      maxLength={1000}
                      value={notes[appeal.id] ?? ""}
                      onChange={(event) =>
                        setNotes((current) => ({ ...current, [appeal.id]: event.target.value }))
                      }
                    />
                  </div>
                )}

                <div className="locker-card__actions">
                  <button
                    type="button"
                    className="button button--secondary"
                    disabled={busyId !== null || isOriginalReviewer}
                    onClick={() => void decide(appeal, "upheld")}
                  >
                    Uphold rejection
                  </button>
                  <button
                    type="button"
                    className="button button--green"
                    disabled={busyId !== null || isOriginalReviewer}
                    onClick={() => void decide(appeal, "overturned")}
                  >
                    Overturn decision
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
