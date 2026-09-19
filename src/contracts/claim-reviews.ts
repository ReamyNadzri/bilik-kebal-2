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
};
