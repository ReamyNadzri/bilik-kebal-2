/**
 * Which drawing stands in the portrait frame of a Wanted poster.
 *
 * The poster shows the kind of resource wanted rather than the person asking:
 * the Board does not expose who posted a request
 * (docs/superpowers/specs/2026-09-16-vaultix-frontier-visual-handoff.md §1.2).
 *
 * Resource types come from the institution's taxonomy, so the label is matched
 * by keyword and anything unrecognised falls back to the notebook. The emblem
 * is decorative; the resource type is always written beside it, so a wrong
 * guess costs nothing but the picture.
 */
import type { EmblemKind } from "./pixel-drawings";

export type { EmblemKind };

/*
 * Whole words only: "worked example" must not match "exam", and "lab" must
 * not match "syllabus".
 */
const RULES: ReadonlyArray<readonly [EmblemKind, RegExp]> = [
  ["worked", /\b(worked|examples?|solutions?|tutorials?|assignments?)\b/i],
  ["exam", /\b(past year|exams?|questions?|papers?)\b/i],
  ["formula", /\b(formulas?|formulae|cheat sheets?)\b/i],
  ["lab", /\b(labs?|experiments?|practicals?)\b/i],
  ["slides", /\b(slides?|lectures?|presentations?)\b/i],
];

export function emblemFor(resourceType: string): EmblemKind {
  for (const [kind, pattern] of RULES) {
    if (pattern.test(resourceType)) {
      return kind;
    }
  }

  return "notes";
}

/**
 * The drawing for a Wanted as a whole. A missing item shows a magnifying
 * glass and a discussion a speech bubble; an academic request shows the kind
 * of resource wanted.
 */
export function emblemForWanted(
  kind: "academic" | "missing_item" | "discussion",
  resourceType: string,
): EmblemKind {
  if (kind === "missing_item") return "lost";
  if (kind === "discussion") return "talk";
  return emblemFor(resourceType);
}
