import type { Metadata } from "next";
import { ConsoleNav } from "@/components/console-nav";
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
      <ConsoleNav current="operations" />
      <OperationalConsole />
    </>
  );
}
