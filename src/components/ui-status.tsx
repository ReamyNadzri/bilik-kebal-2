import type { ReactNode } from "react";

export type UiStatusKind =
  "loading" | "empty" | "success" | "error" | "restricted" | "expired" | "offline";

export interface UiStatusProps {
  kind: UiStatusKind;
  heading: string;
  message?: string;
  action?: ReactNode;
}

/**
 * Shared presentation for operation and lifecycle states.
 *
 * Carries no business rule, copy or lifecycle knowledge — callers supply the
 * words. Every kind renders a text label so the state is never conveyed by
 * colour alone (context/ui-context.md, Accessibility requirements).
 */
const STATE_LABEL: Record<UiStatusKind, string> = {
  loading: "Loading",
  empty: "Empty",
  success: "Success",
  error: "Error",
  restricted: "Restricted",
  expired: "Expired",
  offline: "Offline",
};

function announcementRole(kind: UiStatusKind): "alert" | "status" | undefined {
  switch (kind) {
    // Failure and access refusal interrupt: the user cannot proceed.
    case "error":
    case "restricted":
      return "alert";
    // Lifecycle and connectivity are informational, so they wait their turn.
    case "expired":
    case "offline":
    case "success":
      return "status";
    case "loading":
    case "empty":
      return undefined;
  }
}

export function UiStatus({ kind, heading, message, action }: UiStatusProps) {
  const isLoading = kind === "loading";

  return (
    <section
      className={`ui-status ui-status--${kind}`}
      role={announcementRole(kind)}
      aria-live={isLoading ? "polite" : undefined}
      aria-busy={isLoading ? true : undefined}
    >
      <p className="ui-status__label">{STATE_LABEL[kind]}</p>
      <h2 className="ui-status__heading">{heading}</h2>
      {message === undefined ? null : <p className="ui-status__message">{message}</p>}
      {action === undefined ? null : <div className="ui-status__action">{action}</div>}
    </section>
  );
}
