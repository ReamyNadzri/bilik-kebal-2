import Link from "next/link";
import {
  LEGAL_LANGUAGES,
  LEGAL_LANGUAGE_NAME,
  type Bilingual,
  type LegalDocument,
  type LegalLanguage,
} from "@/features/legal/document";
import { LEGAL_LINKS, type LegalPath } from "@/features/legal/legal-links";

/**
 * One public legal document (Terms, Privacy, Refunds) in English or Malay.
 * The language is a link (`?lang=ms`), so either version can be shared, read
 * without JavaScript and opened before signing in. The text carries its own
 * `lang` so a screen reader pronounces the Malay as Malay.
 */
export function LegalPage({
  document,
  language,
  path,
}: {
  readonly document: Bilingual<LegalDocument>;
  readonly language: LegalLanguage;
  readonly path: LegalPath;
}) {
  const text = document[language];

  return (
    <article className="legal-page" lang={language}>
      <header className="legal-page__head">
        <nav className="legal-page__languages" aria-label="Language / Bahasa">
          <ul>
            {LEGAL_LANGUAGES.map((option) => (
              <li key={option}>
                <Link
                  href={option === "en" ? path : `${path}?lang=${option}`}
                  hrefLang={option}
                  lang={option}
                  aria-current={option === language ? "page" : undefined}
                >
                  {LEGAL_LANGUAGE_NAME[option]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <h1>{text.title}</h1>
        <p className="legal-page__status">{text.status}</p>
        <p className="legal-page__lede">{text.lede}</p>
      </header>

      {text.sections.map((section) => (
        <section className="legal-page__section" key={section.heading}>
          <h2>{section.heading}</h2>
          {section.paragraphs?.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          {section.points ? (
            <ul>
              {section.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}

      <nav className="legal-page__related" aria-label="Legal" lang="en">
        <ul>
          {LEGAL_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={language === "en" ? link.href : `${link.href}?lang=${language}`}
                aria-current={link.href === path ? "page" : undefined}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </article>
  );
}
