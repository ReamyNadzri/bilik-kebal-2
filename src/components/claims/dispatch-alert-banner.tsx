"use client";

import type { ClaimLifecycle } from "@/contracts/claims";

export interface DispatchAlertBannerProps {
  readonly status: ClaimLifecycle | "screening" | "approved" | "under_review" | "rejected";
  readonly reviewerNote?: string | null | undefined;
  readonly className?: string | undefined;
}

type Tone = "neutral" | "info" | "warning" | "success" | "danger" | "muted";

interface AlertVisual {
  readonly title: string;
  readonly message: string;
  readonly tone: Tone;
  readonly tag: string;
}

function getAlertVisual(
  status: ClaimLifecycle | "screening" | "approved" | "under_review" | "rejected",
  reviewerNote?: string | null,
): AlertVisual {
  switch (status) {
    case "uploading":
    case "screening":
      return {
        tone: "neutral",
        tag: "In quarantine",
        title: "Dispatched to Quarantine Screening",
        message:
          "Your file is held in private quarantine. Automated integrity, checksum and format checks are running. No one else can see it yet.",
      };
    case "under_review":
      return {
        tone: "info",
        tag: "With a Sheriff",
        title: "Dispatched to Sheriff Review Queue",
        message:
          "Automated checks are done. An authorized institution Sheriff will review your claim; every decision is made by a person.",
      };
    case "needs_information":
      return {
        tone: "warning",
        tag: "Action needed",
        title: "Action Required: Needs Clarification",
        message:
          reviewerNote ??
          "The Sheriff needs more proof or a clarification before deciding. Read the note and submit again.",
      };
    case "approved":
      return {
        tone: "success",
        tag: "Approved",
        title: "Bounty Claim Approved",
        message:
          reviewerNote ??
          "A Sheriff selected your submission as the winning claim. Access for the Backers is being set up, and your payout will be recorded once it is sent.",
      };
    case "not_selected":
      return {
        tone: "muted",
        tag: "Decided",
        title: "Bounty Decided — Not Selected",
        message:
          "Another Hunter's submission was selected as the winning claim for this bounty. Thank you for taking part.",
      };
    case "rejected":
      return {
        tone: "danger",
        tag: "Rejected",
        title: "Claim Submission Rejected",
        message:
          reviewerNote ??
          "This submission did not meet the request or verification standards. Check the reason, or appeal within 7 days if you are eligible.",
      };
    case "withdrawn":
      return {
        tone: "muted",
        tag: "Withdrawn",
        title: "Claim Withdrawn",
        message: "You withdrew this claim from review.",
      };
    case "restricted":
      return {
        tone: "danger",
        tag: "Restricted",
        title: "Claim Restricted — Under Investigation",
        message:
          reviewerNote ??
          "This submission is restricted while a report about it is investigated. It stays in private quarantine.",
      };
    case "appeal_pending":
      return {
        tone: "warning",
        tag: "Appeal open",
        title: "7-Day Appeal Active — Under Review",
        message:
          reviewerNote ??
          "A different Sheriff is reviewing your appeal. The bounty's expiry and any refunds are paused until it is decided.",
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
      className={`dispatch-banner dispatch-banner--${visual.tone} ${className}`.trim()}
    >
      <div className="dispatch-banner__head">
        <h3 className="dispatch-banner__title">{visual.title}</h3>
        <span className="dispatch-banner__tag">{visual.tag}</span>
      </div>
      <p className="dispatch-banner__message">{visual.message}</p>
    </div>
  );
}
