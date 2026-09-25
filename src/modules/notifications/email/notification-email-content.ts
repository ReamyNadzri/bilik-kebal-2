import { notificationMessages, type NotificationKind } from "@/contracts/notifications";

/** Allow-listed per-kind values from private.notification_email_context. */
export interface NotificationEmailContext {
  requesterDisplayName?: string | undefined;
  institutionName?: string | undefined;
  welcomeCodeCredits?: number | undefined;
}

export interface NotificationEmailCopy {
  subject: string;
  heading: string;
  paragraphs: string[];
  action: { label: string; path: string };
}

const subjects: Readonly<Record<NotificationKind, string>> = {
  claim_approved: "Your claim was approved",
  claim_rejected: "Your claim was not approved",
  claim_information_requested: "More information is needed for your claim",
  claim_not_selected: "Your claim was not selected",
  institution_verification_approved: "Your institution verification was approved",
  institution_verification_rejected: "Your institution verification was not approved",
  payout_recorded: "A payout was recorded",
  refund_recorded: "A refund was recorded",
  account_restricted: "An account restriction was recorded",
  appeal_updated: "Your appeal has an update",
  // In-app only; the outbox never queues it (migration 202609290001).
  wanted_reply: "Someone replied to your request",
  taxonomy_request_approved: "The entry you asked for was added",
  taxonomy_request_rejected: "The entry you asked for was not added",
  community_payout_approved: "Your bounty release was approved",
  community_payout_rejected: "Your bounty release was not approved",
  community_bounty_awarded: "You were awarded a bounty",
  institution_verification_submitted: "New institution verification request",
  welcome: "Welcome to VAULTIX",
  // In-app only; the outbox never queues it (migration 202610100001).
  wanted_thread_auto_closed: "Your request closed after 30 quiet days",
};

const cap = (value: string | undefined) => value?.slice(0, 80).trim() || undefined;

/** Server-composed copy; only allow-listed context fields are ever interpolated. */
export function notificationEmailCopy(
  kind: NotificationKind,
  context: NotificationEmailContext,
): NotificationEmailCopy {
  if (kind === "institution_verification_submitted") {
    const who = cap(context.requesterDisplayName) ?? "a member";
    const where = cap(context.institutionName);
    return {
      subject: subjects[kind],
      heading: "A verification request needs review",
      paragraphs: [
        `A new institution verification request from ${who}${where ? ` at ${where}` : ""} is waiting for review.`,
        "Open the review queue to see the request. Its details are only shown inside VAULTIX.",
      ],
      action: { label: "Open review queue", path: "/console" },
    };
  }
  if (kind === "welcome") {
    const credits = context.welcomeCodeCredits;
    return {
      subject: subjects[kind],
      heading: "Welcome to VAULTIX",
      paragraphs: [
        "Your email is verified. You can now sign in and browse the Wanted Board.",
        "Funding a bounty, submitting a claim and downloading a resource also need institution verification, which a Sheriff grants separately.",
        ...(credits
          ? [
              `Redeem code WELCOME on your profile for ${credits} free ${credits === 1 ? "request" : "requests"}. Each member can use it once.`,
            ]
          : []),
      ],
      action: { label: "Go to my profile", path: "/profile" },
    };
  }
  return {
    subject: subjects[kind],
    heading: subjects[kind],
    paragraphs: [notificationMessages[kind]],
    action: { label: "Open VAULTIX", path: "/notifications" },
  };
}
