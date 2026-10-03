import { render, screen, within } from "@testing-library/react";
import { TERMS_OF_USE_VERSION } from "@/contracts/legal";
import { LEGAL_LANGUAGES, type Bilingual, type LegalDocument } from "@/features/legal/document";
import { PRIVACY_NOTICE } from "@/features/legal/privacy-notice";
import { REFUND_POLICY } from "@/features/legal/refund-policy";
import { POSTING_TERMS, POSTING_TERMS_MS } from "@/features/legal/terms";
import { TERMS_OF_USE } from "@/features/legal/terms-of-use";
import { LegalPage } from "./legal-page";

const DOCUMENTS: ReadonlyArray<[string, Bilingual<LegalDocument>]> = [
  ["Terms of Use", TERMS_OF_USE],
  ["Privacy Notice", PRIVACY_NOTICE],
  ["Refund Policy", REFUND_POLICY],
];

describe.each(DOCUMENTS)("%s", (_name, document) => {
  // A point in one language and not the other is a different agreement.
  test("says the same number of things in English and Malay", () => {
    const shape = (text: LegalDocument) =>
      text.sections.map((s) => [s.paragraphs?.length ?? 0, s.points?.length ?? 0]);
    expect(shape(document.ms)).toEqual(shape(document.en));
  });

  test.each(LEGAL_LANGUAGES)("names the version in %s", (language) => {
    expect(document[language].status).toContain(TERMS_OF_USE_VERSION);
  });
});

test("the Malay posting terms match the English point for point", () => {
  expect(POSTING_TERMS_MS.map((s) => s.points.length)).toEqual(
    POSTING_TERMS.map((s) => s.points.length),
  );
});

test("the Privacy Notice names no company or person, and every provider", () => {
  const text = JSON.stringify(PRIVACY_NOTICE.en);
  for (const provider of ["Clerk", "Supabase", "Vercel", "HitPay", "Brevo"]) {
    expect(text).toContain(provider);
  }
  expect(text).not.toMatch(/Sdn\.? Bhd|SSM|ToyyibPay|Resend/);
});

test("the Refund Policy promises 1 to 3 days", () => {
  expect(JSON.stringify(REFUND_POLICY.en)).toContain("within 1 to 3 days");
  expect(JSON.stringify(REFUND_POLICY.ms)).toContain("dalam tempoh 1 hingga 3 hari");
});

test("the Terms of Use require members to be 18 or older", () => {
  expect(JSON.stringify(TERMS_OF_USE.en)).toContain("You must be 18 or older.");
  expect(JSON.stringify(TERMS_OF_USE.ms)).toContain("Anda mesti berumur 18 tahun ke atas.");
});

test("renders English with a link to the Malay version", () => {
  render(<LegalPage document={PRIVACY_NOTICE} language="en" path="/privacy" />);

  expect(screen.getByRole("heading", { level: 1, name: "Privacy Notice" })).toBeInTheDocument();
  expect(screen.getByRole("article")).toHaveAttribute("lang", "en");
  const languages = screen.getByRole("navigation", { name: "Language / Bahasa" });
  expect(within(languages).getByRole("link", { name: "English" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  expect(within(languages).getByRole("link", { name: "Bahasa Melayu" })).toHaveAttribute(
    "href",
    "/privacy?lang=ms",
  );
  expect(
    screen.getByRole("heading", { level: 2, name: "How long we keep it" }),
  ).toBeInTheDocument();
});

test("renders Malay marked as Malay, keeping the language on the related links", () => {
  render(<LegalPage document={REFUND_POLICY} language="ms" path="/refunds" />);

  expect(
    screen.getByRole("heading", { level: 1, name: "Polisi Bayaran Balik" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("article")).toHaveAttribute("lang", "ms");
  const related = screen.getByRole("navigation", { name: "Legal" });
  expect(within(related).getByRole("link", { name: "Terms of Use" })).toHaveAttribute(
    "href",
    "/terms?lang=ms",
  );
  expect(within(related).getByRole("link", { name: "Refund Policy" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});
