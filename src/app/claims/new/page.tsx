import type { Metadata } from "next";
import Link from "next/link";
import { FixtureNotice } from "@/components/fixture-notice";
import { UiStatus } from "@/components/ui-status";
import { ClaimSubmissionWorkspace } from "@/components/claims/claim-submission-workspace";
import type { EvidenceItem } from "@/components/claims/evidence-locker";
import type { AccountViewModel } from "@/contracts";
import { loadAccountViewModel } from "@/modules/identity";

export const metadata: Metadata = {
  title: "Fulfill Bounty | VAULTIX",
};

export const dynamic = "force-dynamic";

type Outcome =
  | { kind: "account"; account: AccountViewModel }
  | { kind: "unauthenticated" }
  | { kind: "unavailable" };

async function readAccount(): Promise<Outcome> {
  try {
    const account = await loadAccountViewModel();
    return account === null ? { kind: "unauthenticated" } : { kind: "account", account };
  } catch {
    return { kind: "unavailable" };
  }
}

interface NewClaimPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function NewClaimPage({ searchParams }: NewClaimPageProps) {
  const params = await searchParams;
  const rawWantedId = params["wantedId"];
  const wantedId = typeof rawWantedId === "string" ? rawWantedId : "";
  const rawFrom = params["from"];
  const from = typeof rawFrom === "string" ? rawFrom : "";

  const returnTo = from === "wanted" && wantedId ? `/wanted/${wantedId}` : "/claims";
  const returnLabel = from === "wanted" && wantedId ? "← Back to Wanted" : "← Back to Hunt";

  const outcome = await readAccount();
  const isDev = process.env.NODE_ENV === "development";
  const hasAccess = outcome.kind === "account" && outcome.account.capabilities.submitClaim;

  if (!hasAccess && !isDev) {
    if (outcome.kind === "unauthenticated") {
      return (
        <div style={{ maxWidth: "56rem", marginInline: "auto", width: "100%" }}>
          <header className="panel" style={{ marginBottom: "1.5rem" }}>
            <p className="pixel-label" style={{ marginBottom: "0.25rem" }}>
              Bounty Hunter · Fulfill Bounty
            </p>
            <h1 style={{ margin: 0, fontSize: "1.75rem", color: "var(--text-primary, #2a2118)" }}>
              Fulfill Bounty
            </h1>
          </header>
          <UiStatus
            kind="restricted"
            heading="Sign in to submit a claim"
            message="Claims belong to the verified student who submitted them. Please sign in before submitting proof."
            action={<Link href="/sign-in">Sign in</Link>}
          />
        </div>
      );
    }

    if (outcome.kind === "unavailable") {
      return (
        <div style={{ maxWidth: "56rem", marginInline: "auto", width: "100%" }}>
          <UiStatus
            kind="offline"
            heading="Your account could not be verified"
            message="We could not verify your session. Please try again shortly."
            action={
              <Link href={`/claims/new${wantedId ? `?wantedId=${wantedId}` : ""}`}>Try again</Link>
            }
          />
        </div>
      );
    }

    return (
      <div style={{ maxWidth: "56rem", marginInline: "auto", width: "100%" }}>
        <header className="panel" style={{ marginBottom: "1.5rem" }}>
          <p className="pixel-label" style={{ marginBottom: "0.25rem" }}>
            Bounty Hunter · Fulfill Bounty
          </p>
          <h1 style={{ margin: 0, fontSize: "1.75rem", color: "var(--text-primary, #2a2118)" }}>
            Fulfill Bounty
          </h1>
        </header>
        <UiStatus
          kind="restricted"
          heading="Institution verification required"
          message="Only institution-verified students can claim bounties and upload academic evidence."
          action={<Link href="/profile/institution-verification">Verify your institution</Link>}
        />
      </div>
    );
  }

  const effectiveWantedId = wantedId || "demo-wanted-bounty";
  const preview = typeof params["preview"] === "string" ? params["preview"] : null;

  const sampleEvidence: EvidenceItem[] =
    preview === "screening"
      ? [
          {
            id: "ev-demo-1",
            actionType: "Claim Proof",
            fileName: "CSC510_Past_Exam_Solutions_2025.pdf",
            mimeType: "application/pdf",
            sizeBytes: 2450000,
            uploadedAt: new Date().toISOString(),
            status: "screening",
          },
        ]
      : preview === "review"
        ? [
            {
              id: "ev-demo-2",
              actionType: "Claim Proof",
              fileName: "MAT402_Calculus_Formula_Sheet.pdf",
              mimeType: "application/pdf",
              sizeBytes: 1200000,
              uploadedAt: new Date(Date.now() - 3600000).toISOString(),
              status: "under_review",
              reviewerNote: "Sheriff review assigned: verifying course syllabus alignment.",
            },
          ]
        : preview === "approved"
          ? [
              {
                id: "ev-demo-3",
                actionType: "Claim Proof",
                fileName: "CSC404_Algorithm_Lecture_Notes.pdf",
                mimeType: "application/pdf",
                sizeBytes: 3100000,
                uploadedAt: new Date(Date.now() - 7200000).toISOString(),
                status: "approved",
                reviewerNote: "Verified authentic UiTM past semester solutions.",
              },
            ]
          : [];

  return (
    <div style={{ maxWidth: "56rem", marginInline: "auto", width: "100%" }}>
      {isDev && !hasAccess && (
        <FixtureNotice screen="Claim Proof & Evidence Locker Workspace (Dev Preview)" />
      )}
      <ClaimSubmissionWorkspace
        wantedId={effectiveWantedId}
        initialEvidence={sampleEvidence}
        returnTo={returnTo}
        returnLabel={returnLabel}
      />
    </div>
  );
}
