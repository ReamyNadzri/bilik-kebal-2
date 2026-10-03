import { z } from "zod";

export const claimReviewInputSchema = z.object({
  claimId: z.string().uuid(),
  decision: z.enum(["approve", "reject", "request_information"]),
  reasonCode: z
    .string()
    .regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/)
    .max(80),
  notes: z.string().max(2000).nullable().optional(),
});

export type ClaimReviewInput = z.infer<typeof claimReviewInputSchema>;

export type ClaimReviewQueueItem = {
  claimId: string;
  wantedId: string;
  institutionId: string;
  status: "screening" | "needs_information" | "under_review";
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  /** For the reviewer's context and a link; null if the Wanted is not readable. */
  wantedPublicId: string | null;
  wantedTitle: string | null;
};

/** Reason codes offered per decision; the schema still accepts any snake_case code. */
export const CLAIM_REVIEW_REASONS = {
  approve: [
    { code: "meets_request", label: "Matches the request" },
    { code: "rights_confirmed", label: "Hunter's rights look clear" },
  ],
  request_information: [
    { code: "needs_review", label: "Needs a closer look" },
    { code: "rights_unclear", label: "Rights unclear" },
  ],
  reject: [
    { code: "wrong_file", label: "Wrong or unrelated file" },
    { code: "poor_quality", label: "Unreadable or incomplete" },
    { code: "rights_violation", label: "Not the Hunter's to share" },
  ],
} as const;
