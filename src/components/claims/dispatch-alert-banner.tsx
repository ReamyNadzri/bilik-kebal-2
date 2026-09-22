"use client";

import type { ClaimLifecycle } from "@/contracts/claims";

export interface DispatchAlertBannerProps {
  readonly status: ClaimLifecycle | "screening" | "approved" | "under_review" | "rejected";
  readonly reviewerNote?: string | null | undefined;
  readonly className?: string | undefined;
}

interface AlertVisual {
  readonly icon: string;
  readonly title: string;
  readonly message: string;
  readonly bg: string;
  readonly border: string;
  readonly textColor: string;
  readonly badgeBg: string;
}

function getAlertVisual(
  status: ClaimLifecycle | "screening" | "approved" | "under_review" | "rejected",
  reviewerNote?: string | null,
): AlertVisual {
  switch (status) {
    case "uploading":
    case "screening":
      return {
        icon: "⏳",
        title: "Dispatched to Quarantine Screening",
        message:
          "Your proof file has been encrypted and placed into the isolated quarantine sandbox. Automated integrity, checksum, and format screening are underway.",
        bg: "rgba(183, 151, 99, 0.12)",
        border: "var(--border-subtle, #d3bc92)",
        textColor: "var(--text-primary, #2a2118)",
        badgeBg: "rgba(183, 151, 99, 0.25)",
      };
    case "under_review":
      return {
        icon: "🔍",
        title: "Dispatched to Sheriff Review Queue",
        message:
          "Automated checks cleared! Your evidence is now queued for evaluation by an authorized institution Sheriff. Decisions are rendered manually.",
        bg: "rgba(200, 155, 60, 0.12)",
        border: "var(--state-warning, #c89b3c)",
        textColor: "var(--text-primary, #2a2118)",
        badgeBg: "rgba(200, 155, 60, 0.25)",
      };
    case "needs_information":
      return {
        icon: "📋",
        title: "Action Required: Needs Clarification",
        message:
          reviewerNote ??
          "The reviewing Sheriff requested additional proof or clarification before this claim can be decided. Please review and re-submit.",
        bg: "rgba(217, 119, 6, 0.12)",
        border: "var(--state-warning, #d97706)",
        textColor: "var(--text-primary, #2a2118)",
        badgeBg: "rgba(217, 119, 6, 0.25)",
      };
    case "approved":
      return {
        icon: "🏆",
        title: "Bounty Claim Approved!",
        message:
          reviewerNote ??
          "Congratulations! An authorized Sheriff selected your submission as the winning claim. Entitlements are being generated and payout processing will follow.",
        bg: "rgba(46, 125, 50, 0.12)",
        border: "var(--state-success, #2e7d32)",
        textColor: "var(--text-primary, #2a2118)",
        badgeBg: "rgba(46, 125, 50, 0.25)",
      };
    case "not_selected":
      return {
        icon: "📌",
        title: "Bounty Decided — Not Selected",
        message:
          "Another Hunter's submission was selected as the winning claim for this bounty. Thank you for participating.",
        bg: "rgba(94, 79, 55, 0.08)",
        border: "var(--border-default, #9c8558)",
        textColor: "var(--text-muted, #5e4f37)",
        badgeBg: "rgba(94, 79, 55, 0.15)",
      };
    case "rejected":
      return {
        icon: "⚠️",
        title: "Claim Submission Rejected",
        message:
          reviewerNote ??
          "This submission did not meet the verification standards or course criteria. Check reason codes or submit an appeal within 7 days if eligible.",
        bg: "rgba(183, 28, 28, 0.1)",
        border: "var(--state-error, #b71c1c)",
        textColor: "var(--state-error, #b71c1c)",
        badgeBg: "rgba(183, 28, 28, 0.2)",
      };
    case "withdrawn":
      return {
        icon: "↩️",
        title: "Claim Withdrawn",
        message: "You have retracted this claim from the bounty review pipeline.",
        bg: "rgba(94, 79, 55, 0.08)",
        border: "var(--border-default, #9c8558)",
        textColor: "var(--text-muted, #5e4f37)",
        badgeBg: "rgba(94, 79, 55, 0.15)",
      };
  }
}

export function DispatchAlertBanner({
  status,
  reviewerNote,
  className = "",
}: DispatchAlertBannerProps) {
  const visual = getAlertVisual(status, reviewerNote);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid={`dispatch-alert-${status}`}
      className={`dispatch-alert-banner ${className}`}
      style={{
        borderRadius: "4px",
        border: `1px solid ${visual.border}`,
        background: visual.bg,
        padding: "1rem 1.25rem",
        display: "flex",
        alignItems: "flex-start",
        gap: "0.85rem",
        transition: "all 0.2s ease-in-out",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          fontSize: "1.25rem",
          lineHeight: "1",
          marginTop: "0.1rem",
        }}
      >
        {visual.icon}
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            flexWrap: "wrap",
            marginBottom: "0.25rem",
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: "0.95rem",
              fontWeight: 700,
              color: visual.textColor,
            }}
          >
            {visual.title}
          </h3>
          <span
            className="pixel-label"
            style={{
              fontSize: "0.65rem",
              padding: "0.1rem 0.45rem",
              borderRadius: "2px",
              background: visual.badgeBg,
              color: visual.textColor,
            }}
          >
            DISPATCH ALERT
          </span>
        </div>

        <p
          style={{
            margin: 0,
            fontSize: "0.875rem",
            lineHeight: 1.4,
            color: visual.textColor,
            opacity: 0.9,
          }}
        >
          {visual.message}
        </p>
      </div>
    </div>
  );
}
