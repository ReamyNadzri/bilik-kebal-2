import type { Metadata } from "next";
import Link from "next/link";
import { ClaimReviewConsole } from "@/components/claim-review-console";

export const metadata: Metadata = {
  title: "Claim Reviews | VAULTIX",
};

export const dynamic = "force-dynamic";

export default function ClaimReviewsPage() {
  return (
    <>
      <p>
        <Link href="/console">← Back to Sheriff Console</Link>
      </p>
      <ClaimReviewConsole />
    </>
  );
}
