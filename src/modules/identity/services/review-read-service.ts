import { z } from "zod";

import type { EvidenceReadResult } from "@/contracts/identity";
import { failure, success } from "@/contracts/operation-result";

import type { VerificationActor } from "./verification-service";

export function canLoadReviewQueue(actor: VerificationActor): boolean {
  return actor.platformRole !== null || actor.institutionSheriffFor.length > 0;
}

export type EvidenceAuthorisation =
  | { status: "authorised"; objectPath: string }
  | { status: "expired" | "not_authorized" | "not_found" | "recent_auth_required" };

export interface EvidenceReadRepository {
  authoriseEvidenceRead(input: {
    actorUserId: string;
    requestId: string;
  }): Promise<EvidenceAuthorisation>;
}

export interface EvidenceReadSigner {
  createSignedReadUrl(objectPath: string, expiresInSeconds: number): Promise<string>;
}

export class EvidenceReadService {
  private static readonly URL_LIFETIME_SECONDS = 5 * 60;

  constructor(
    private readonly repository: EvidenceReadRepository,
    private readonly signer: EvidenceReadSigner,
    private readonly now: () => Date,
  ) {}

  async createEvidenceUrl(input: unknown, actor: VerificationActor): Promise<EvidenceReadResult> {
    const parsed = z.object({ requestId: z.string().uuid() }).safeParse(input);
    if (!parsed.success) {
      return failure("VALIDATION_ERROR", "A valid verification request is required.");
    }

    const access = await this.repository.authoriseEvidenceRead({
      actorUserId: actor.userId,
      requestId: parsed.data.requestId,
    });

    if (access.status === "expired") {
      return failure("EVIDENCE_EXPIRED", "This evidence is no longer available.");
    }
    if (access.status === "not_authorized") {
      return failure("NOT_AUTHORIZED", "You are not authorised to view this evidence.");
    }
    if (access.status === "not_found") {
      return failure("REQUEST_NOT_FOUND", "The verification request was not found.");
    }
    if (access.status === "recent_auth_required") {
      return failure("RECENT_AUTH_REQUIRED", "Sign in again before viewing this evidence.");
    }
    if (access.status !== "authorised") {
      return failure("AUTH_UNAVAILABLE", "Evidence access is temporarily unavailable.");
    }

    const signedUrl = await this.signer.createSignedReadUrl(
      access.objectPath,
      EvidenceReadService.URL_LIFETIME_SECONDS,
    );
    return success({
      expiresAt: new Date(
        this.now().getTime() + EvidenceReadService.URL_LIFETIME_SECONDS * 1000,
      ).toISOString(),
      signedUrl,
    });
  }
}
