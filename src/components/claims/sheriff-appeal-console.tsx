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

    const defaultReason =
      decision === "overturned"
        ? "decision_overturned_evidence_valid"
        : "decision_upheld_policy_violation";

    const reasonCode = window.prompt(
      "Decision reason code (lowercase_with_underscores)",
      defaultReason,
    );
    if (!reasonCode) return;

    const notes = window.prompt("Optional reviewer rationale / notes:", "") ?? "";

    setBusyId(appeal.id);
    setNotice("");

    try {
      const response = await fetch(`/api/sheriff/appeals/${appeal.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, reasonCode, notes }),
      });

      const body = await response.json();
      if (!response.ok || !body.ok) {
        setNotice(body.message ?? "The appeal decision was not recorded.");
        return;
      }

      setNotice(
        decision === "overturned"
          ? "Appeal overturned: Claim restored to review queue."
          : "Appeal upheld: Claim rejection confirmed.",
      );

      setState((current) =>
        current.kind === "ready"
          ? { kind: "ready", items: current.items.filter((item) => item.id !== appeal.id) }
          : current,
      );
    } catch {
      setNotice("Network error recording appeal decision.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="review-console mt-8" aria-labelledby="claim-appeals-heading">
      <h2 id="claim-appeals-heading" className="text-xl font-bold tracking-tight text-stone-100">
        Claim Appeals Queue
      </h2>
      <p className="mt-1 text-sm text-stone-400">
        Segregation of duties: Appeals must be decided by an independent Sheriff who did not issue
        the original decision.
      </p>

      {notice ? (
        <div
          role="status"
          className="mt-3 rounded-lg border border-amber-600/40 bg-amber-950/40 p-3 text-sm text-amber-200"
        >
          {notice}
        </div>
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
            <button type="button" onClick={() => void load()}>
              Try again
            </button>
          }
        />
      ) : null}

      {state.kind === "ready" && state.items.length === 0 ? (
        <UiStatus
          kind="empty"
          heading="No pending claim appeals"
          message="All claim appeals have been adjudicated."
        />
      ) : null}

      {state.kind === "ready" && state.items.length > 0 ? (
        <ul className="mt-4 space-y-4" aria-label={`${state.items.length} claim appeals waiting`}>
          {state.items.map((appeal) => {
            const isOriginalReviewer = appeal.reviewerUserId === currentSheriffUserId;

            return (
              <li
                key={appeal.id}
                className="rounded-xl border border-stone-800 bg-stone-900/90 p-5 shadow-lg"
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs text-stone-400">
                    <span>Appeal ID: {appeal.id.slice(0, 8)}...</span>
                    <span>Deadline: {new Date(appeal.appealDeadline).toLocaleDateString()}</span>
                  </div>

                  <div className="mt-2 rounded-lg bg-stone-800/60 p-3 text-sm text-stone-200">
                    <strong className="block text-xs uppercase tracking-wider text-amber-400 mb-1">
                      Appellant Justification:
                    </strong>
                    <p className="whitespace-pre-wrap">{appeal.reason}</p>
                  </div>

                  {isOriginalReviewer ? (
                    <div
                      role="alert"
                      className="mt-3 rounded-lg border border-red-600/40 bg-red-950/30 p-3 text-xs text-red-300"
                    >
                      🛡️ <strong>Segregation of Duties Enforced:</strong> You issued the original
                      decision on this claim and cannot adjudicate this appeal. Another authorized
                      Sheriff must review it.
                    </div>
                  ) : null}

                  <div className="mt-4 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      disabled={busyId !== null || isOriginalReviewer}
                      onClick={() => void decide(appeal, "upheld")}
                      className="rounded-lg border border-stone-700 bg-stone-800 px-4 py-2 text-xs font-semibold text-stone-200 hover:bg-stone-700 disabled:opacity-40"
                    >
                      Upheld (Confirm Rejection)
                    </button>
                    <button
                      type="button"
                      disabled={busyId !== null || isOriginalReviewer}
                      onClick={() => void decide(appeal, "overturned")}
                      className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-600 disabled:opacity-40"
                    >
                      Overturn Decision
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
