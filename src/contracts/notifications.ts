import type { OperationResult } from "./operation-result";

export const notificationKinds = [
  "claim_approved",
  "claim_rejected",
  "claim_information_requested",
  "claim_not_selected",
  "institution_verification_approved",
  "institution_verification_rejected",
  "payout_recorded",
  "refund_recorded",
  "account_restricted",
  "appeal_updated",
] as const;
export type NotificationKind = (typeof notificationKinds)[number];

/** Generic copy keeps private evidence and financial details out of notifications. */
export const notificationMessages: Readonly<Record<NotificationKind, string>> = {
  claim_approved: "A Sheriff approved your claim. Check your claims for the next step.",
  claim_rejected: "A Sheriff rejected your claim. Check your claims for details.",
  claim_information_requested: "A Sheriff requested more information about your claim.",
  claim_not_selected: "Your claim was not selected for this Wanted request.",
  institution_verification_approved: "Your institution verification was approved. You can now access student features.",
  institution_verification_rejected: "Your institution verification was not approved. Check your account for next steps.",
  payout_recorded: "The Owner recorded a payout. Sign in to view its status.",
  refund_recorded: "The Owner recorded a refund. Sign in to view its status.",
  account_restricted: "Your account has been restricted. Check your profile for details.",
  appeal_updated: "Your appeal has an update. Sign in to view its status.",
};

export interface NotificationItem {
  id: string;
  kind: NotificationKind;
  message: string;
  subjectId: string;
  createdAt: string;
  readAt: string | null;
}
export type NotificationCode =
  "AUTH_REQUIRED" | "NOTIFICATIONS_UNAVAILABLE" | "VALIDATION_ERROR" | "REQUEST_NOT_FOUND";
export type NotificationListResult = OperationResult<
  {
    items: NotificationItem[];
    nextCursor: string | null;
  },
  NotificationCode
>;
export type NotificationReadResult = OperationResult<{ read: true }, NotificationCode>;
