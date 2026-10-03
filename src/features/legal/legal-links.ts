/** The three public legal pages, in the order the footer and menus list them. */
export const LEGAL_LINKS = [
  { href: "/terms", label: "Terms of Use" },
  { href: "/privacy", label: "Privacy Notice" },
  { href: "/refunds", label: "Refund Policy" },
] as const;

export type LegalPath = (typeof LEGAL_LINKS)[number]["href"];

/**
 * Pages a signed-in member may open before accepting the current Terms: the
 * documents themselves, and the way out.
 */
export const OPEN_BEFORE_TERMS: readonly string[] = [
  ...LEGAL_LINKS.map((link) => link.href),
  "/sign-out",
];
