"use client";

import { useEffect } from "react";

export interface DispatchAlertToastProps {
  readonly title: string;
  readonly message: string;
  readonly tier?: "info" | "success" | "warning" | "error" | undefined;
  readonly onDismiss: () => void;
  readonly autoDismissMs?: number | undefined;
  readonly badgeLabel?: string | undefined;
}

export function DispatchAlertToast({
  title,
  message,
  tier = "info",
  onDismiss,
  autoDismissMs = 5000,
  badgeLabel = "DISPATCH EVENT",
}: DispatchAlertToastProps) {
  useEffect(() => {
    if (autoDismissMs <= 0) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, autoDismissMs);
    return () => clearTimeout(timer);
  }, [autoDismissMs, onDismiss]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onDismiss();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="dispatch-alert-toast"
      className={`toast toast--${tier}`}
    >
      <div className="toast__head">
        <span className="toast__tag">{badgeLabel}</span>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss alert"
          className="toast__close"
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
      <h4 className="toast__title">{title}</h4>
      <p className="toast__message">{message}</p>
    </div>
  );
}
