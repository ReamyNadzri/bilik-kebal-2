import { z } from "zod";

export const claimScreeningStatusSchema = z.enum(["clean", "blocked", "needs_review", "error"]);

export type ClaimScreeningStatus = z.infer<typeof claimScreeningStatusSchema>;

/** Queue payload contains identifiers only. File bytes never enter the web runtime. */
export const claimScreeningJobSchema = z
  .object({
    claimId: z.string().uuid(),
    bucket: z.literal("quarantine"),
    objectKey: z.string().min(1).max(512),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    mimeType: z.string().min(1).max(100),
    sizeBytes: z
      .number()
      .int()
      .positive()
      .max(50 * 1024 * 1024),
  })
  .strict();

export type ClaimScreeningJob = z.infer<typeof claimScreeningJobSchema>;

export const claimScreeningResultSchema = z.object({
  claimId: z.string().uuid(),
  status: claimScreeningStatusSchema,
  scannerName: z.string().min(1).max(100),
  scannerVersion: z.string().min(1).max(100),
  reasonCodes: z.array(z.string().regex(/^[a-z0-9_]+$/)).max(20),
  completedAt: z.string().datetime({ offset: true }),
});

export type ClaimScreeningResult = z.infer<typeof claimScreeningResultSchema>;
