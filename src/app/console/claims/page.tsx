import type { Metadata } from "next";
import { ConsoleNav } from "@/components/console-nav";
import { ClaimReviewConsole } from "@/components/claim-review-console";
import { requireAccount } from "@/features/presentation/auth/require-account";

export const metadata: Metadata = {
  title: "Claim Reviews | VAULTIX",
};

export const dynamic = "force-dynamic";

export default async function ClaimReviewsPage() {
  /**
   * Protected. Role scope is decided by the review operations themselves,
   * which authorise server-side and are repeated by RLS; this guard only
   * spares a signed-out viewer a console that could tell them nothing.
   */
  await requireAccount("/console/claims");

  return (
    <>
      <ConsoleNav current="claims" />
      <ClaimReviewConsole />
    </>
  );
}
