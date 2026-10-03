import { z } from "zod";
import {
  canViewClaimFileInBrowser,
  claimFilePurposeSchema,
  type ClaimFileAccess,
  type ClaimFileAccessCode,
  type ClaimFilePurpose,
} from "@/contracts/claim-reviews";
import { failure, success, type OperationResult } from "@/contracts/operation-result";
import type { ClaimFileLocation, SignOutcome } from "../storage/promote-approved-claim-file";

/** Five minutes: long enough to open the file, short enough not to be shared. */
export const CLAIM_FILE_URL_SECONDS = 300;

export interface ReviewClaimFile {
  readonly bucket: string;
  readonly objectKey: string;
  readonly fileName: string;
  readonly mimeType: string;
}

export type ClaimFileRefusal = "forbidden" | "not_found" | "auth" | "invalid" | "unavailable";

export interface ClaimFileReviewGateway {
  /** The database decides and audits (public.review_claim_file_access, member session). */
  authorise(
    claimId: string,
    purpose: ClaimFilePurpose,
  ): Promise<{ ok: true; file: ReviewClaimFile } | { ok: false; reason: ClaimFileRefusal }>;
  /** Service-role signing of an already authorised object. */
  sign(
    file: ClaimFileLocation,
    expiresInSeconds: number,
    options: { download: string } | undefined,
  ): Promise<SignOutcome>;
}

const REFUSAL: Record<ClaimFileRefusal, [ClaimFileAccessCode, string]> = {
  forbidden: ["NOT_AUTHORIZED", "You cannot open files for this claim."],
  not_found: ["CLAIM_NOT_FOUND", "This claim has no file to open."],
  auth: ["AUTH_REQUIRED", "Sign in to continue."],
  invalid: ["VALIDATION_ERROR", "Choose View or Download."],
  unavailable: ["FILE_UNAVAILABLE", "The file could not be opened. Try again."],
};

const inputSchema = z.object({ claimId: z.string().uuid(), purpose: claimFilePurposeSchema });

export class ClaimFileReviewService {
  constructor(
    private readonly gateway: ClaimFileReviewGateway,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async open(
    claimId: string,
    purpose: string,
  ): Promise<OperationResult<ClaimFileAccess, ClaimFileAccessCode>> {
    const parsed = inputSchema.safeParse({ claimId, purpose });
    if (!parsed.success) return failure(...REFUSAL.invalid);

    let authorised: Awaited<ReturnType<ClaimFileReviewGateway["authorise"]>>;
    try {
      authorised = await this.gateway.authorise(parsed.data.claimId, parsed.data.purpose);
    } catch {
      return failure(...REFUSAL.unavailable);
    }
    if (!authorised.ok) return failure(...REFUSAL[authorised.reason]);

    const { file } = authorised;
    if (parsed.data.purpose === "view" && !canViewClaimFileInBrowser(file.mimeType)) {
      return failure("PREVIEW_UNSUPPORTED", "This file type can only be downloaded.");
    }

    const issuedAt = this.now();
    let signed: SignOutcome;
    try {
      signed = await this.gateway.sign(
        // Only an approved claim's file is in the approved bucket.
        {
          bucket: file.bucket,
          objectKey: file.objectKey,
          status: file.bucket === "approved" ? "approved" : "under_review",
        },
        CLAIM_FILE_URL_SECONDS,
        parsed.data.purpose === "download" ? { download: file.fileName } : undefined,
      );
    } catch {
      return failure(...REFUSAL.unavailable);
    }
    if (!signed.ok) return failure(...REFUSAL.unavailable);

    return success({
      url: signed.url,
      expiresAt: new Date(issuedAt.getTime() + CLAIM_FILE_URL_SECONDS * 1000).toISOString(),
      mimeType: file.mimeType,
    });
  }
}
