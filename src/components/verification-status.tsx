import type { ReactNode } from "react";
import Link from "next/link";
import { TrustBadge, type EmailBadgeState, type InstitutionBadgeState } from "./trust-badge";
import { UiStatus } from "./ui-status";
import type { AccountCapabilities } from "@/features/presentation/account-capabilities";

export interface VerificationStatusProps {
  email: EmailBadgeState;
  institution: InstitutionBadgeState;
  /**
   * Whether the account carries an active restriction.
   *
   * A third trust axis, independent of the two verification states: a
   * restricted account can be both email- and institution-verified and still
   * be unable to act. It must never be folded into the institution state.
   */
  restricted: boolean;
  /** When a timeout lifts by itself. */
  restrictedUntil?: string | undefined;
  capabilities: AccountCapabilities;
}

/**
 * Presents the trust states and what the account may currently do.
 *
 * It renders the capabilities the backend granted; it never derives them.
 * Email verification alone permits browsing. Funding, claiming and
 * downloading additionally require institution verification
 * (context/project-overview.md).
 */
const CAPABILITY_LABEL: { key: keyof AccountCapabilities; label: string }[] = [
  { key: "browseMetadata", label: "Browse Wanted metadata" },
  { key: "transact", label: "Fund or create a bounty" },
  { key: "submitClaim", label: "Submit a claim" },
  { key: "download", label: "Download an entitled resource" },
];

const INSTITUTION_MESSAGE: Record<InstitutionBadgeState, string> = {
  unverified:
    "You can browse Wanted metadata. Funding a bounty, submitting a claim and downloading a resource each require institution verification.",
  pending:
    "Your institution verification is under review. You can browse Wanted metadata in the meantime, but you cannot fund a bounty, submit a claim or download a resource yet.",
  rejected:
    "Your institution verification was rejected. You can still browse Wanted metadata. Funding a bounty, submitting a claim and downloading a resource remain unavailable.",
  verified:
    "Some actions are unavailable on this account. Browsing Wanted metadata is still permitted.",
};

/**
 * Deliberately states the fact and nothing more. How a restriction is lifted
 * is not defined in the accepted product behaviour, and inventing an appeal
 * route or a contact address here would promise a remedy that does not exist
 * (context/ai-workflow-rules.md: do not infer moderation behaviour).
 */
const RESTRICTED_MESSAGE =
  "This account has been restricted, so any action shown below as Not allowed is unavailable while the restriction stands.";

interface Notice {
  heading: string;
  message: string;
  action?: ReactNode;
}

/**
 * At most one notice, so at most one `role="alert"` enters the accessibility
 * tree per render. Two interrupting announcements in one update queue, and the
 * second usually clips the first.
 *
 * A restriction outranks a missing institution verification: verifying would
 * not restore the blocked actions, so offering it as the remedy would mislead.
 */
const UNTIL = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kuala_Lumpur",
});

function noticeFor(
  restricted: boolean,
  institution: InstitutionBadgeState,
  blockedCount: number,
  restrictedUntil?: string,
): Notice | null {
  if (restricted && restrictedUntil) {
    return {
      heading: "This account is timed out",
      message: `A Sheriff paused this account until ${UNTIL.format(new Date(restrictedUntil))} (Malaysia time). You can browse, but posting, replying, claiming and funding are paused until then. It lifts by itself.`,
    };
  }
  if (restricted) {
    return { heading: "This account is restricted", message: RESTRICTED_MESSAGE };
  }

  if (blockedCount === 0) {
    return null;
  }

  return {
    heading: "Institution verification required for this action",
    message: INSTITUTION_MESSAGE[institution],
    action:
      institution === "verified" ? undefined : (
        <Link href="/profile/institution-verification">Verify your institution</Link>
      ),
  };
}

export function VerificationStatus({
  email,
  institution,
  restricted,
  restrictedUntil,
  capabilities,
}: VerificationStatusProps) {
  const blocked = CAPABILITY_LABEL.filter(({ key }) => !capabilities[key]);
  const notice = noticeFor(restricted, institution, blocked.length, restrictedUntil);

  return (
    <section className="verification-status">
      <h2>Verification</h2>

      <div className="verification-status__badges">
        <TrustBadge kind="email" state={email} />
        <TrustBadge kind="institution" state={institution} />
      </div>

      {notice === null ? null : (
        <UiStatus
          kind="restricted"
          heading={notice.heading}
          message={notice.message}
          action={notice.action}
        />
      )}

      <h3>What this account can do</h3>

      <ul className="capability-list" aria-label="Account capabilities">
        {CAPABILITY_LABEL.map(({ key, label }) => (
          <li key={key} className="capability-list__item">
            <span className="capability-list__name">{label}</span>
            <span
              className={
                capabilities[key]
                  ? "capability-list__state capability-list__state--allowed"
                  : "capability-list__state capability-list__state--blocked"
              }
            >
              {capabilities[key] ? "Allowed" : "Not allowed"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
