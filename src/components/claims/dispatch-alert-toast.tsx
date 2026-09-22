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

  const getTierStyles = () => {
    switch (tier) {
      case "success":
        return {
          icon: "✓",
          border: "var(--state-success, #2e7d32)",
          bg: "var(--bg-surface, #fbf3e0)",
          indicatorBg: "var(--state-success, #2e7d32)",
          accentText: "#1b5e20",
        };
      case "warning":
        return {
          icon: "!",
          border: "var(--state-warning, #c89b3c)",
          bg: "var(--bg-surface, #fbf3e0)",
          indicatorBg: "var(--state-warning, #c89b3c)",
          accentText: "#8a6100",
        };
      case "error":
        return {
          icon: "✕",
          border: "var(--state-error, #b71c1c)",
          bg: "var(--bg-surface, #fbf3e0)",
          indicatorBg: "var(--state-error, #b71c1c)",
          accentText: "#b71c1c",
        };
      case "info":
      default:
        return {
          icon: "ℹ",
          border: "var(--border-default, #9c8558)",
          bg: "var(--bg-surface, #fbf3e0)",
          indicatorBg: "var(--border-default, #9c8558)",
          accentText: "var(--text-primary, #2a2118)",
        };
    }
  };

  const style = getTierStyles();

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="dispatch-alert-toast"
      style={{
        position: "fixed",
        bottom: "1.5rem",
        right: "1.5rem",
        zIndex: 9999,
        maxWidth: "24rem",
        width: "calc(100vw - 3rem)",
        background: style.bg,
        border: `2px solid ${style.border}`,
        borderRadius: "4px",
        boxShadow: "0 4px 14px rgba(0, 0, 0, 0.18)",
        padding: "1rem 1.15rem",
        display: "flex",
        alignItems: "flex-start",
        gap: "0.85rem",
        animation: "toast-slide-up 0.2s ease-out",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: "22px",
          height: "22px",
          borderRadius: "50%",
          background: style.indicatorBg,
          color: "var(--bg-surface, #fbf3e0)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "0.75rem",
          fontWeight: 700,
          flexShrink: 0,
          marginTop: "0.1rem",
        }}
      >
        {style.icon}
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.5rem",
            marginBottom: "0.2rem",
          }}
        >
          <span
            className="pixel-label"
            style={{
              fontSize: "0.65rem",
              color: style.accentText,
            }}
          >
            {badgeLabel}
          </span>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss alert"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontSize: "1rem",
              lineHeight: 1,
              padding: "0.1rem",
              color: "var(--text-muted, #5e4f37)",
            }}
          >
            ×
          </button>
        </div>

        <h4
          style={{
            margin: "0 0 0.2rem 0",
            fontSize: "0.9rem",
            fontWeight: 700,
            color: "var(--text-primary, #2a2118)",
          }}
        >
          {title}
        </h4>

        <p
          style={{
            margin: 0,
            fontSize: "0.825rem",
            lineHeight: 1.35,
            color: "var(--text-muted, #5e4f37)",
          }}
        >
          {message}
        </p>
      </div>
    </div>
  );
}
