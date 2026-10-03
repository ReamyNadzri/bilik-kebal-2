import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { legalLanguage } from "@/features/legal/document";
import { REFUND_POLICY } from "@/features/legal/refund-policy";

export const metadata: Metadata = {
  title: "Refund Policy | VAULTIX",
};

interface RefundsPageProps {
  readonly searchParams?: Promise<{ lang?: string }>;
}

/** Public: readable before signing in, and before accepting the Terms. */
export default async function RefundsPage({ searchParams }: RefundsPageProps) {
  const language = legalLanguage((await searchParams)?.lang);
  return <LegalPage document={REFUND_POLICY} language={language} path="/refunds" />;
}
