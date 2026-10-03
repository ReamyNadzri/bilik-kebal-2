/**
 * The public legal pages (Terms of Use, Privacy Notice, Refund Policy) in
 * English and Malay. The Personal Data Protection Act 2010 asks for the
 * privacy notice in both languages; the Terms and Refund Policy follow so a
 * reader never meets half a page in one language.
 */
export const LEGAL_LANGUAGES = ["en", "ms"] as const;
export type LegalLanguage = (typeof LEGAL_LANGUAGES)[number];

export const LEGAL_LANGUAGE_NAME: Record<LegalLanguage, string> = {
  en: "English",
  ms: "Bahasa Melayu",
};

/** `?lang=ms` selects Malay; anything else is English. */
export function legalLanguage(value: unknown): LegalLanguage {
  return value === "ms" ? "ms" : "en";
}

export interface LegalSection {
  readonly heading: string;
  readonly paragraphs?: readonly string[];
  readonly points?: readonly string[];
}

export interface LegalDocument {
  readonly title: string;
  /** One or two sentences under the title: what this page is for. */
  readonly lede: string;
  /** "Version 2026-10-03 · Effective 3 October 2026", in the page's language. */
  readonly status: string;
  readonly sections: readonly LegalSection[];
}

export type Bilingual<T> = Readonly<Record<LegalLanguage, T>>;
