/**
 * Presentation of a single verification state.
 *
 * Deliberately presentational: it takes a state to render, never an identity
 * object, and it decides no permission. Access rules live in the Codex-owned
 * identity module (canBrowseMetadata, canTransact, canSubmitClaim,
 * canDownload). A screen maps that contract onto these props.
 *
 * Email verification and institution verification are separate trust states
 * and must never be presented as one (context/project-overview.md).
 */

export type TrustBadgeKind = "email" | "institution";

export type EmailBadgeState = "unverified" | "verified";
export type InstitutionBadgeState = "unverified" | "pending" | "verified" | "rejected";

export type TrustBadgeProps =
  { kind: "email"; state: EmailBadgeState } | { kind: "institution"; state: InstitutionBadgeState };

const EMAIL_LABEL: Record<EmailBadgeState, string> = {
  unverified: "Email Not Verified",
  verified: "Email Verified",
};

const INSTITUTION_LABEL: Record<InstitutionBadgeState, string> = {
  unverified: "Institution Not Verified",
  pending: "Institution Verification Pending",
  verified: "Institution Verified",
  rejected: "Institution Verification Rejected",
};

export function TrustBadge(props: TrustBadgeProps) {
  const label = props.kind === "email" ? EMAIL_LABEL[props.state] : INSTITUTION_LABEL[props.state];

  // The star marks institution affiliation only, never email verification.
  const showEmblem = props.kind === "institution" && props.state === "verified";

  return (
    <span className={`trust-badge trust-badge--${props.kind} trust-badge--${props.state}`}>
      {showEmblem ? (
        <span className="trust-badge__emblem" data-testid="star-emblem" aria-hidden="true">
          ★
        </span>
      ) : null}
      <span className="trust-badge__label">{label}</span>
      {showEmblem ? (
        <span className="trust-badge__note">
          Confirms institution affiliation only. It does not guarantee resource quality.
        </span>
      ) : null}
    </span>
  );
}
