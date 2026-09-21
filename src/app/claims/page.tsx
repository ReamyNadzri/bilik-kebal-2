import type { Metadata } from "next";
import Link from "next/link";
import { HuntWorkspace } from "@/components/hunt-workspace";
import { HunterOffice } from "@/components/hunter-office";
import { UiStatus } from "@/components/ui-status";
import { readAccount } from "@/features/presentation/auth/require-account";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fixtureNow, readPreviewState } from "@/features/marketplace/fixture-preview";
import { listClaims, listHunts } from "@/features/marketplace/hunt-source";
import { toSen } from "@/features/marketplace/money";
import type { ClaimStatus, ClaimSummary, HuntOpportunity } from "@/features/marketplace/types";

export const metadata: Metadata = {
  title: "Hunt | VAULTIX",
  description: "Find academic resource bounties to fulfil and track your claims.",
};

export const dynamic = "force-dynamic";

interface ClaimsPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ClaimsPage({ searchParams }: ClaimsPageProps) {
  const params = await searchParams;
  const preview = readPreviewState(params["preview"]);

  // If explicitly in preview mode, use the preview harness
  if (preview !== null) {
    const hunts = listHunts(preview);
    const claims = listClaims(preview);

    return (
      <div className="page-bare">
        <HunterOffice claims={claims.status === "ready" ? claims.data : null} />

        {hunts.status === "unavailable" || claims.status === "unavailable" ? (
          <UiStatus
            kind="offline"
            heading="Hunt could not be loaded"
            message="The opportunity and claim ledgers are temporarily unavailable. Nothing has been submitted or changed."
            action={<Link href="/claims">Try again</Link>}
          />
        ) : (
          <HuntWorkspace hunts={hunts.data} claims={claims.data} now={fixtureNow()} />
        )}
      </div>
    );
  }

  // Real authenticated session:
  const outcome = await readAccount();
  const account = outcome.kind === "account" ? outcome.account : null;

  // Load real open bounties from Supabase using admin client so public hunts are always visible
  let hunts: HuntOpportunity[] = [];
  try {
    const supabase = createSupabaseAdminClient();
    const { data: wantedData } = await supabase
      .from("wanted_requests")
      .select(`
        id,
        public_id,
        title,
        status,
        closes_at,
        created_at,
        published_at,
        courses (code, name),
        campuses (name),
        resource_types (name),
        academic_sessions (name)
      `)
      .in("status", ["open", "reviewing"])
      .order("published_at", { ascending: false });

    if (wantedData && wantedData.length > 0) {
      hunts = wantedData.map((w: any) => ({
        id: w.public_id,
        title: w.title,
        courseCode: w.courses?.code ?? "",
        courseName: w.courses?.name ?? "",
        courseId: "",
        campus: w.campuses?.name ?? "",
        campusId: "",
        resourceType: w.resource_types?.name ?? "",
        resourceTypeId: "",
        session: w.academic_sessions?.name ?? "",
        sessionId: "",
        grossBountySen: toSen(2500),
        backerCount: 1,
        status: w.status,
        postedAt: w.published_at ?? w.created_at,
        closesAt: w.closes_at ?? new Date(Date.now() + 14 * 86400000).toISOString(),
        activeClaimCount: 0,
        eligibility: "institution-verified" as const,
      }));
    }
  } catch {
    hunts = [];
  }

  // Load live claims for this user if authenticated
  let claims: ClaimSummary[] = [];
  if (account) {
    try {
      const supabase = await createSupabaseServerClient();
      const { data: claimsData } = await supabase
        .from("claims")
        .select("id, wanted_request_id, status, created_at")
        .order("created_at", { ascending: false });

      if (claimsData) {
        claims = claimsData.map((c) => ({
          id: c.id,
          wantedId: c.wanted_request_id,
          wantedTitle: "Submitted Claim",
          courseCode: "",
          courseName: "",
          status: c.status as ClaimStatus,
          submittedAt: c.created_at,
        }));
      }
    } catch {
      claims = [];
    }
  }

  return (
    <div className="page-bare">
      <HunterOffice claims={account ? claims : null} account={account} />

      {!account ? (
        <div className="panel" style={{ marginBottom: "var(--space-4)" }}>
          <UiStatus
            kind="restricted"
            heading="Sign in to submit and track claims"
            message="You can browse active bounties below. To claim a bounty and earn the reward, please sign in with your student account."
            action={<Link href="/sign-in?next=/claims">Sign in</Link>}
          />
        </div>
      ) : null}

      <HuntWorkspace hunts={hunts} claims={claims} now={new Date().toISOString()} />
    </div>
  );
}
