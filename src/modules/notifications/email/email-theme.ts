/**
 * Email clients cannot read CSS custom properties, so the provisional tokens are
 * mirrored as literals. email-theme.test.ts fails when globals.css changes, which
 * is the signal to update this file (and nothing else) at design handoff.
 */
export const emailTheme = {
  color: {
    pageBackground: "#160d08",
    headerBackground: "#1b1109",
    cardBackground: "#fbf3e0",
    canvas: "#f3e6c8",
    textPrimary: "#2a2118",
    textMuted: "#5e4f37",
    textOnDark: "#f3e6c8",
    accent: "#9e2b25",
    textOnAccent: "#ffffff",
    brass: "#c89b3c",
    border: "#8a6a3c",
  },
  font: {
    heading: "Rye, Georgia, 'Times New Roman', serif",
    body: "Karla, Arial, Helvetica, sans-serif",
  },
} as const;

export const EMAIL_TOKEN_SOURCES: Readonly<Record<keyof typeof emailTheme.color, string>> = {
  pageBackground: "--bg-base",
  headerBackground: "--bg-rail",
  cardBackground: "--bg-surface",
  canvas: "--bg-canvas",
  textPrimary: "--text-primary",
  textMuted: "--text-muted",
  textOnDark: "--text-on-dark",
  accent: "--accent-primary",
  textOnAccent: "--text-on-accent",
  brass: "--accent-brass",
  border: "--border-default",
};
