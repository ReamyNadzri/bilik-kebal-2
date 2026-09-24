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
import { sen } from "@/features/marketplace/money";
import type { ClaimSummary, HuntOpportunity } from "@/features/marketplace/types";
import { HunterClaimsReadService } from "@/modules/claims/services/hunter-claims-read-service";

export const metadata: Metadata = {
  title: "Hunt | VAULTIX",
  description: "Find academic resource bounties to fulfil and track your claims.",
};

export const dynamic = "force-dynamic";

interface ClaimsPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

interface WantedHuntRow {
  readonly public_id: string;
  readonly title: string;
  readonly status: string;
  readonly gross_bounty_sen: number | null;
  readonly backer_count: number | null;
  readonly closes_at: string | null;
  readonly created_at: string;
  readonly published_at: string | null;
  readonly courses: { readonly code: string; readonly name: string } | null;
  readonly campuses: { readonly name: string } | null;
  readonly resource_types: { readonly name: string } | null;
  readonly academic_sessions: { readonly name: string } | null;
}

export default async function ClaimsPage({ searchParams }: ClaimsPageProps) {
  const params = await searchParams;
  const preview = readPreviewState(params["preview"]);
  const nowInstant = new Date().toISOString();

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
      .select(
        `
        public_id,
        title,
        status,
        gross_bounty_sen,
        backer_count,
        closes_at,
        created_at,
        published_at,
        courses (code, name),
        campuses (name),
        resource_types (name),
        academic_sessions (name)
      `,
      )
      .in("status", ["open", "reviewing"])
      .order("published_at", { ascending: false });

    if (wantedData && wantedData.length > 0) {
      const rows = wantedData as unknown as readonly WantedHuntRow[];
      hunts = rows.map((w) => ({
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
        grossBountySen: sen(w.gross_bounty_sen ?? 2500),
        backerCount: w.backer_count ?? 1,
        status: w.status as "open" | "reviewing",
        postedAt: w.published_at ?? w.created_at,
        closesAt: w.closes_at ?? w.created_at,
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
      const { data: auth } = await supabase.auth.getUser();
      if (auth.user) {
        const readService = new HunterClaimsReadService(supabase);
        claims = await readService.listHunterClaims(auth.user.id);
      }
    } catch {
      claims = [];
    }
  }

  return (
    <div className="page-bare">
      <HunterOffice claims={account ? claims : null} account={account} />

      {!account ? (
        <div className="panel">
          <UiStatus
            kind="restricted"
            heading="Sign in to submit and track claims"
            message="You can browse active bounties below. To claim a bounty and earn the reward, please sign in with your student account."
            action={<Link href="/sign-in?next=/claims">Sign in</Link>}
          />
        </div>
      ) : null}

      <HuntWorkspace hunts={hunts} claims={claims} now={nowInstant} />
    </div>
  );
}
