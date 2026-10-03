import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { legalLanguage } from "@/features/legal/document";
import { TERMS_OF_USE } from "@/features/legal/terms-of-use";

export const metadata: Metadata = {
  title: "Terms of Use | VAULTIX",
};

interface TermsPageProps {
  readonly searchParams?: Promise<{ lang?: string }>;
}

/** Public: readable before signing in, and before accepting the Terms. */
export default async function TermsPage({ searchParams }: TermsPageProps) {
  const language = legalLanguage((await searchParams)?.lang);
  return <LegalPage document={TERMS_OF_USE} language={language} path="/terms" />;
}
