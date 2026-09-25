import Link from "next/link";
import { SignOutButton } from "./sign-out-button";
import { VerificationStatus } from "./verification-status";
import type { AccountViewModel } from "@/contracts";

export interface AccountSummaryProps {
  account: AccountViewModel;
}

/**
 * The signed-in account, rendered from the Codex-published `AccountViewModel`.
 *
 * Presentational and synchronous: the page awaits `loadAccountViewModel` and
 * hands the result here, which keeps every state in this specification unit
 * testable without a server or a session.
 *
 * It renders the backend's decisions and makes none of its own. In particular
 * `capabilities` is passed straight through: recomputing a permission from
 * `trust` would fork the access policy that
 * `src/modules/identity/domain/access-policy.ts` owns.
 */
const REQUEST_STATE_LABEL: Record<
  NonNullable<AccountViewModel["latestVerificationRequest"]>["state"],
  string
> = {
  pending: "Awaiting review",
  approved: "Approved",
  rejected: "Rejected",
};

/**
 * Stored timestamps are UTC instants; only display converts them
 * (context/code-standards.md). Formatting in UTC with an explicit locale keeps
 * the rendered date identical wherever the test or the reader happens to run.
 */
const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "long",
  timeZone: "UTC",
});

function formatDate(iso: string): string {
  const parsed = new Date(iso);

  return Number.isNaN(parsed.getTime()) ? "Unknown date" : DATE_FORMAT.format(parsed);
}

/**
 * Reason codes are machine identifiers; the catalogue that would give each one
 * approved wording is still an open question in context/progress-tracker.md.
 * Presenting the code readably is honest; inventing a sentence for it would
 * put words in a Sheriff's mouth.
 */
function readableReason(reasonCode: string): string {
  return reasonCode.replaceAll("_", " ");
}

export function AccountSummary({ account }: AccountSummaryProps) {
  const { console: consoleAccess, institution, latestVerificationRequest, trust } = account;

  return (
    <>
      <section className="account-summary">
        <h2>Account</h2>

        <dl className="account-summary__details">
          <dt>Name</dt>
          <dd>{account.displayName}</dd>

          <dt>Institution</dt>
          <dd>{institution === null ? "No institution confirmed" : institution.name}</dd>
        </dl>
      </section>

      <VerificationStatus
        email={trust.email}
        institution={trust.institution}
        restricted={trust.restricted}
        restrictedUntil={account.restrictedUntil}
        capabilities={account.capabilities}
      />

      {latestVerificationRequest === null ? null : (
        <section className="account-summary__request">
          <h2>Your verification request</h2>

          <dl className="account-summary__details">
            <dt>Status</dt>
            <dd>{REQUEST_STATE_LABEL[latestVerificationRequest.state]}</dd>

            <dt>Submitted</dt>
            <dd>{formatDate(latestVerificationRequest.submittedAt)}</dd>

            {latestVerificationRequest.decidedAt === null ? null : (
              <>
                <dt>Decided</dt>
                <dd>{formatDate(latestVerificationRequest.decidedAt)}</dd>
              </>
            )}

            {latestVerificationRequest.reasonCode === null ? null : (
              <>
                <dt>Reason</dt>
                <dd>{readableReason(latestVerificationRequest.reasonCode)}</dd>
              </>
            )}

            <dt>Evidence deleted after</dt>
            <dd>{formatDate(latestVerificationRequest.evidenceDeleteAfter)}</dd>
          </dl>

          <p>
            Your evidence is stored privately and only a Sheriff reviewing your request can open it.
          </p>
        </section>
      )}

      {consoleAccess.hasAccess ? (
        <section className="account-summary__console">
          <h2>Sheriff Console</h2>
          <p>
            <Link href="/console">Open the Sheriff Console</Link>
          </p>
        </section>
      ) : null}

      <section className="account-summary__session">
        <h2>Session</h2>
        <p>
          <SignOutButton />
        </p>
      </section>
    </>
  );
}
