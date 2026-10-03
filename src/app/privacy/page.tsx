import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { legalLanguage } from "@/features/legal/document";
import { PRIVACY_NOTICE } from "@/features/legal/privacy-notice";

export const metadata: Metadata = {
  title: "Privacy Notice | VAULTIX",
};

interface PrivacyPageProps {
  readonly searchParams?: Promise<{ lang?: string }>;
}

/** Public: readable before signing in, and before accepting the Terms. */
export default async function PrivacyPage({ searchParams }: PrivacyPageProps) {
  const language = legalLanguage((await searchParams)?.lang);
  return <LegalPage document={PRIVACY_NOTICE} language={language} path="/privacy" />;
}
