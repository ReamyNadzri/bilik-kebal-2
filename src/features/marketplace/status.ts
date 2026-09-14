import type { ClaimStatus, WantedStatus } from "./types";

/**
 * How lifecycle states are worded and marked.
 *
 * Kept out of the components so the wording is testable on its own and so one
 * state cannot quietly acquire another's words. Two signals accompany every
 * state — a word and a border treatment — because no status may be carried by
 * colour alone (`context/ui-context.md`).
 */

/** Colour family. Never the only signal. */
export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger" | "muted";

/** Border treatment, so the states stay distinct without colour. */
export type StatusEmphasis = "solid" | "dashed" | "doubled";

export interface StatusPresentation {
  readonly label: string;
  readonly tone: StatusTone;
  readonly emphasis: StatusEmphasis;
}

export interface ClaimStatusPresentation extends StatusPresentation {
  /** What the Hunter should expect next, in the interface's own voice. */
  readonly nextStep: string;
}

const WANTED_STATUS: Record<WantedStatus, StatusPresentation> = {
  open: { label: "Open", tone: "success", emphasis: "solid" },
  "ending-soon": { label: "Ending soon", tone: "warning", emphasis: "doubled" },
  "well-funded": { label: "Well funded", tone: "info", emphasis: "solid" },
  reviewing: { label: "Under review", tone: "info", emphasis: "dashed" },
  closed: { label: "Closed", tone: "muted", emphasis: "solid" },
};

export function wantedStatusPresentation(status: WantedStatus): StatusPresentation {
  return WANTED_STATUS[status];
}

/**
 * `not-selected` and `rejected` are the pair most likely to be collapsed, and
 * collapsing them would tell a student who did nothing wrong that they broke a
 * rule. They differ here in word, tone, border treatment and sentence, and a
 * test asserts all four.
 */
const CLAIM_STATUS: Record<ClaimStatus, ClaimStatusPresentation> = {
  draft: {
    label: "Draft",
    tone: "neutral",
    emphasis: "dashed",
    nextStep: "Complete and submit your claim.",
  },
  screening: {
    label: "Screening",
    tone: "info",
    emphasis: "solid",
    nextStep: "We are checking your file. No Sheriff has seen it yet.",
  },
  "needs-information": {
    label: "Needs information",
    tone: "warning",
    emphasis: "solid",
    nextStep: "A Sheriff asked for more detail before reviewing this claim.",
  },
  "under-review": {
    label: "Under Sheriff review",
    tone: "info",
    emphasis: "dashed",
    nextStep: "A Sheriff is reviewing your claim. You will be notified of the decision.",
  },
  "not-selected": {
    label: "Not selected",
    tone: "muted",
    emphasis: "doubled",
    nextStep: "Your claim was valid. Another claim was chosen for this bounty.",
  },
  approved: {
    label: "Approved",
    tone: "success",
    emphasis: "solid",
    nextStep: "Approved. The Owner prepares the payout and records the reference.",
  },
  rejected: {
    label: "Rejected",
    tone: "danger",
    emphasis: "solid",
    nextStep: "This claim did not meet the content policy. You may appeal within seven days.",
  },
  quarantined: {
    label: "Quarantined",
    tone: "danger",
    emphasis: "doubled",
    nextStep: "Held for content safety review. Your file stays private while this is decided.",
  },
};

export function claimStatusPresentation(status: ClaimStatus): ClaimStatusPresentation {
  return CLAIM_STATUS[status];
}
