import type { WantedSummary } from "./types";

/**
 * Requests a Commissioner should look at before publishing their own.
 *
 * Duplicate suggestions are a product requirement before a Wanted is published
 * (`context/project-overview.md`), and they are advisory: two students asking
 * for the same notes split the class across two small bounties instead of
 * building one worth answering. Nothing here blocks publication.
 *
 * The real ranking is a server operation. The backend design
 * (`2026-09-15-vaultix-phase-3-wanted-money-design.md` §3.3) ranks by
 * institution and course first, then resource type, session and normalised
 * title terms, and issues a token the publication request must carry. This
 * function is the frontend stand-in for that ordering; the token has no
 * frontend equivalent and is recorded as a contract gap.
 *
 * Only public Board metadata participates. No file, claim, storage path,
 * uploader identity or unreviewed content is searched or returned.
 */

export interface DuplicateQuery {
  readonly courseId: string;
  readonly resourceTypeId: string;
  readonly sessionId: string;
  readonly title: string;
}

const LIMIT = 4;

/** Words too common to indicate a duplicate on an academic board. */
const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "for",
  "from",
  "in",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
  "notes",
  "every",
  "all",
]);

function terms(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 2 && !STOP_WORDS.has(word)),
  );
}

/**
 * Lower sorts first. Same course outranks everything, so a classmate's request
 * for the identical course is never pushed below a loose title match.
 */
function rank(
  wanted: WantedSummary,
  query: DuplicateQuery,
  queryTerms: Set<string>,
): number | null {
  if (wanted.courseId === query.courseId) {
    return 0;
  }

  const sameType = wanted.resourceTypeId === query.resourceTypeId;
  const sameSession = wanted.sessionId === query.sessionId;

  if (sameType && sameSession) {
    return 1;
  }

  const shared = [...terms(wanted.title)].filter((word) => queryTerms.has(word)).length;

  if (sameType && shared > 0) {
    return 2;
  }

  if (shared >= 2) {
    return 3;
  }

  return null;
}

export function suggestDuplicates(
  board: readonly WantedSummary[],
  query: DuplicateQuery,
): readonly WantedSummary[] {
  const queryTerms = terms(query.title);

  return (
    board
      // A closed request cannot be backed, so offering it as an alternative
      // would send the reader somewhere they can do nothing.
      .filter((wanted) => wanted.status !== "closed")
      .map((wanted) => ({ wanted, rank: rank(wanted, query, queryTerms) }))
      .filter((entry): entry is { wanted: WantedSummary; rank: number } => entry.rank !== null)
      // Ties break on the Board's own order, which keeps the output stable.
      .sort((a, b) => a.rank - b.rank)
      .slice(0, LIMIT)
      .map((entry) => entry.wanted)
  );
}
