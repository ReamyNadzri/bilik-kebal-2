import type { Metadata } from "next";
import { ConsoleNav } from "@/components/console-nav";
import { OperationalConsole, type OperationsTab } from "@/components/claims/operational-console";
import { requireAccount } from "@/features/presentation/auth/require-account";

export const metadata: Metadata = {
  title: "Operations & Payouts | VAULTIX",
};

export const dynamic = "force-dynamic";

interface OperationsPageProps {
  readonly searchParams?: Promise<{ tab?: string }>;
}

export default async function OperationsConsolePage({ searchParams }: OperationsPageProps) {
  await requireAccount("/console/operations");
  // ?tab=refunds is where a refund notice leads; anything else opens payouts.
  // (A client module's constants are references here, so the list is local.)
  const requested = (await searchParams)?.tab;
  const initialTab: OperationsTab =
    requested === "refunds" || requested === "expiry" ? requested : "payouts";

  return (
    <>
      <ConsoleNav current="operations" />
      <OperationalConsole initialTab={initialTab} />
    </>
  );
}
