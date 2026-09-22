"use client";

import { useEffect, useRef, useState } from "react";
import type { WantedDetail } from "@/features/marketplace/types";
import { formatRinggit, sen, type Sen } from "@/features/marketplace/money";
import { UiStatus } from "./ui-status";

export interface BackWantedModalProps {
  readonly wanted: WantedDetail;
  readonly onClose: () => void;
}

const PRESET_AMOUNTS: readonly { label: string; amountSen: Sen }[] = [
  { label: "RM 1", amountSen: sen(100) },
  { label: "RM 5", amountSen: sen(500) },
  { label: "RM 10", amountSen: sen(1000) },
  { label: "RM 20", amountSen: sen(2000) },
  { label: "RM 50", amountSen: sen(5000) },
];

/**
 * Modal dialog for institution-verified students to add RM1–RM50 backer
 * contributions to an open Wanted request.
 *
 * Enforces:
 * - Integer sen branding at all times (100–5,000 sen).
 * - Transparent explanation of provider charges.
 * - Launch-gate awareness: informative refusal notice when payments are disabled.
 * - Accessible dialog semantics, keyboard navigation, and escape-to-close.
 */
export function BackWantedModal({ wanted, onClose }: BackWantedModalProps) {
  const [selectedSen, setSelectedSen] = useState<Sen>(sen(500));
  const [status, setStatus] = useState<"idle" | "submitting" | "refused">("idle");
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function handleProceed() {
    setStatus("submitting");

    // In this MVP phase, live payments are protected by launch gates (PAYMENT_MODE=disabled/sandbox).
    // Simulated or refusal path demonstrates safe launch gate response.
    try {
      const response = await fetch(`/api/marketplace/wanted/${wanted.id}/contribution`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountSen: selectedSen }),
      });

      if (!response.ok) {
        setStatus("refused");
        return;
      }

      const result = await response.json();
      if (result.ok && result.data?.paymentUrl) {
        window.location.href = result.data.paymentUrl;
        return;
      }

      setStatus("refused");
    } catch {
      setStatus("refused");
    }
  }

  const projectedTotalSen = sen(wanted.grossBountySen + selectedSen);

  return (
    <div
      className="evidence-viewer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="back-wanted-title"
      ref={dialogRef}
      tabIndex={-1}
      style={{
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0, 0, 0, 0.75)",
      }}
    >
      <div
        className="panel"
        style={{
          maxWidth: "32rem",
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "var(--space-4)",
          }}
        >
          <h2 id="back-wanted-title" style={{ margin: 0, fontSize: "var(--text-lg)" }}>
            Back this Wanted
          </h2>
          <button
            type="button"
            className="button button--ghost"
            onClick={onClose}
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        {status === "refused" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <UiStatus
              kind="offline"
              heading="Payments are switched off"
              message="Backer contributions are currently disabled pending launch-gate clearance. No charge was made and the bounty remains unchanged."
              action={
                <button type="button" className="button button--primary" onClick={onClose}>
                  Understood
                </button>
              }
            />
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleProceed();
            }}
          >
            <p className="policy-note" style={{ marginBottom: "var(--space-4)" }}>
              Add to the bounty for <strong>{wanted.title}</strong> ({wanted.courseCode}). Every
              contribution is RM1 to RM50.
            </p>

            <fieldset className="draft-form__fieldset" style={{ marginBottom: "var(--space-4)" }}>
              <legend className="draft-form__legend">Select contribution amount</legend>
              <div
                className="draft-form__choices"
                style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}
              >
                {PRESET_AMOUNTS.map(({ label, amountSen }) => (
                  <label
                    key={amountSen}
                    className="draft-form__choice"
                    style={{
                      cursor: "pointer",
                      padding: "var(--space-2) var(--space-3)",
                      border: "var(--border-width-1) solid var(--border-default)",
                      borderRadius: "var(--radius-sm)",
                      background:
                        selectedSen === amountSen
                          ? "var(--bg-surface-elevated)"
                          : "var(--bg-surface)",
                    }}
                  >
                    <input
                      type="radio"
                      name="backer-amount"
                      value={amountSen}
                      checked={selectedSen === amountSen}
                      onChange={() => setSelectedSen(amountSen)}
                    />
                    <span style={{ fontWeight: selectedSen === amountSen ? "bold" : "normal" }}>
                      {label}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div
              className="panel"
              style={{
                background: "var(--bg-canvas)",
                padding: "var(--space-3)",
                marginBottom: "var(--space-4)",
                fontSize: "var(--text-sm)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "var(--space-1)",
                }}
              >
                <span>Current bounty:</span>
                <span className="numeric">{formatRinggit(wanted.grossBountySen)}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "var(--space-1)",
                }}
              >
                <span>Your contribution:</span>
                <span className="numeric">+{formatRinggit(selectedSen)}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontWeight: "bold",
                  borderTop: "1px solid var(--border-default)",
                  paddingTop: "var(--space-1)",
                }}
              >
                <span>New bounty total:</span>
                <span className="numeric">{formatRinggit(projectedTotalSen)}</span>
              </div>
            </div>

            <p
              style={{
                fontSize: "var(--text-xs)",
                color: "var(--text-muted)",
                marginBottom: "var(--space-4)",
              }}
            >
              The payment provider adds its own charge on top of your contribution total. A bounty
              contribution cannot be cancelled or refunded once confirmed, unless the Wanted request
              expires unfulfilled.
            </p>

            <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="button button--ghost"
                onClick={onClose}
                disabled={status === "submitting"}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="button button--primary"
                disabled={status === "submitting"}
              >
                {status === "submitting"
                  ? "Connecting to payment…"
                  : `Proceed to payment of ${formatRinggit(selectedSen)}`}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
