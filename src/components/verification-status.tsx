import Link from "next/link";
import { TrustBadge, type EmailBadgeState, type InstitutionBadgeState } from "./trust-badge";
import { UiStatus } from "./ui-status";
import type { AccountCapabilities } from "@/features/presentation/account-capabilities";

export interface VerificationStatusProps {
  email: EmailBadgeState;
  institution: InstitutionBadgeState;
  capabilities: AccountCapabilities;
}

/**
 * Presents the two trust states and what the account may currently do.
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

const RESTRICTION_MESSAGE: Record<InstitutionBadgeState, string> = {
  unverified:
    "You can browse Wanted metadata. Funding a bounty, submitting a claim and downloading a resource each require institution verification.",
  pending:
    "Your institution verification is under review. You can browse Wanted metadata in the meantime, but you cannot fund a bounty, submit a claim or download a resource yet.",
  rejected:
    "Your institution verification was rejected. You can still browse Wanted metadata. Funding a bounty, submitting a claim and downloading a resource remain unavailable.",
  verified:
    "Some actions are unavailable on this account. Browsing Wanted metadata is still permitted.",
};

export function VerificationStatus({ email, institution, capabilities }: VerificationStatusProps) {
  const blocked = CAPABILITY_LABEL.filter(({ key }) => !capabilities[key]);

  return (
    <section className="verification-status">
      <h2>Verification</h2>

      <div className="verification-status__badges">
        <TrustBadge kind="email" state={email} />
        <TrustBadge kind="institution" state={institution} />
      </div>

      {blocked.length === 0 ? null : (
        <UiStatus
          kind="restricted"
          heading="Institution verification required for this action"
          message={RESTRICTION_MESSAGE[institution]}
          action={
            institution === "verified" ? undefined : (
              <Link href="/profile/institution-verification">Verify your institution</Link>
            )
          }
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
