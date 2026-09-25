import type { WantedDuplicateSuggestion, WantedSummary } from "@/contracts/marketplace";

export interface DuplicateCandidate {
  wanted: WantedSummary;
  courseId: string;
  resourceTypeId: string;
  academicSessionId: string | null;
}

export interface DuplicateTarget {
  title: string;
  courseId: string;
  resourceTypeId: string;
  academicSessionId: string | null;
}

const terms = (title: string) =>
  new Set(
    title
      .toLocaleLowerCase("en")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter((term) => term.length > 1),
  );

export function rankDuplicateCandidates(
  target: DuplicateTarget,
  candidates: DuplicateCandidate[],
): WantedDuplicateSuggestion[] {
  const targetTerms = terms(target.title);
  return candidates
    .map((candidate) => {
      const reasons: WantedDuplicateSuggestion["reasons"] = [];
      let score = 0;
      if (candidate.courseId === target.courseId) {
        reasons.push("same_course");
        score += 8;
      }
      if (candidate.resourceTypeId === target.resourceTypeId) {
        reasons.push("same_resource_type");
        score += 4;
      }
      if (
        candidate.academicSessionId !== null &&
        candidate.academicSessionId === target.academicSessionId
      ) {
        reasons.push("same_session");
        score += 2;
      }
      const candidateTerms = terms(candidate.wanted.title);
      const overlap = [...targetTerms].filter((term) => candidateTerms.has(term)).length;
      if (overlap >= 2 || (targetTerms.size > 0 && overlap / targetTerms.size >= 0.6)) {
        reasons.push("similar_title");
        score += 3 + overlap / Math.max(targetTerms.size, candidateTerms.size);
      }
      return { reasons, score, wanted: candidate.wanted };
    })
    .filter(({ score }) => score > 0)
    .sort(
      (left, right) =>
        right.score - left.score || right.wanted.postedAt.localeCompare(left.wanted.postedAt),
    )
    .slice(0, 8)
    .map(({ reasons, wanted }) => ({ reasons, wanted }));
}
