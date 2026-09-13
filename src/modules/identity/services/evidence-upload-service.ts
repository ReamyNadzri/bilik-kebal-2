import { z } from "zod";

import type { EvidenceUploadResult } from "@/contracts/identity";
import { failure, success } from "@/contracts/operation-result";

const evidenceTypes = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
} as const;

const uploadSchema = z.object({
  emailVerified: z.boolean(),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string(),
  userId: z.string().uuid(),
});

export interface EvidenceUploadGateway {
  createSignedUpload(input: {
    mimeType: keyof typeof evidenceTypes;
    objectPath: string;
  }): Promise<{ signedUrl: string; token: string }>;
}

export class EvidenceUploadService {
  constructor(
    private readonly gateway: EvidenceUploadGateway,
    private readonly generateId: () => string,
  ) {}

  async createUpload(input: unknown): Promise<EvidenceUploadResult> {
    const parsed = uploadSchema.safeParse(input);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0] ?? "form");
        fieldErrors[field] ??= [];
        fieldErrors[field].push(issue.message);
      }
      return failure("VALIDATION_ERROR", "Check the highlighted fields.", fieldErrors);
    }

    if (!parsed.data.emailVerified) {
      return failure("EMAIL_NOT_VERIFIED", "Verify your email before uploading evidence.");
    }

    if (!(parsed.data.mimeType in evidenceTypes)) {
      return failure("UNSUPPORTED_EVIDENCE_TYPE", "Evidence must be a PDF, JPEG, or PNG file.");
    }

    const mimeType = parsed.data.mimeType as keyof typeof evidenceTypes;
    const objectPath = `${parsed.data.userId}/${this.generateId()}.${evidenceTypes[mimeType]}`;

    try {
      const upload = await this.gateway.createSignedUpload({ mimeType, objectPath });
      return success({ objectPath, ...upload });
    } catch {
      return failure(
        "EVIDENCE_UPLOAD_UNAVAILABLE",
        "Evidence upload is temporarily unavailable. Try again.",
      );
    }
  }
}
