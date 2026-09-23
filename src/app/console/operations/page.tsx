import type { Metadata } from "next";
import Link from "next/link";
import { OperationalConsole } from "@/components/claims/operational-console";
import { requireAccount } from "@/features/presentation/auth/require-account";

export const metadata: Metadata = {
  title: "Operations & Payouts | VAULTIX",
};

export const dynamic = "force-dynamic";

export default async function OperationsConsolePage() {
  await requireAccount("/console/operations");

  return (
    <>
      <p>
        <Link href="/console">← Back to Sheriff Console</Link>
      </p>
      <h1>Operations &amp; Fulfilment Console</h1>
      <OperationalConsole />
    </>
  );
}
