import type {
  ListWantedQuery,
  ValidatedWantedDraftInput,
  WantedDraftView,
  WantedDetail,
  WantedSummary,
} from "@/contracts/marketplace";
import type { DuplicateCandidate } from "../domain/duplicate-ranking";

export interface StoredWantedDraft extends WantedDraftView {
  commissionerUserId: string;
  institutionId: string;
}

export interface PersistWantedDraft {
  commissionerUserId: string;
  institutionId: string;
  values: ValidatedWantedDraftInput;
  acceptedAt: string;
}

export interface WantedRepository {
  listPublicWanted(query: ListWantedQuery): Promise<WantedSummary[]>;
  readPublicWanted(publicId: string): Promise<WantedDetail | null>;
  taxonomyMatchesInstitution(
    institutionId: string,
    values: ValidatedWantedDraftInput,
  ): Promise<boolean>;
  createDraft(input: PersistWantedDraft): Promise<StoredWantedDraft>;
  findDraft(draftId: string, commissionerUserId: string): Promise<StoredWantedDraft | null>;
  updateDraft(input: PersistWantedDraft & { draftId: string }): Promise<StoredWantedDraft>;
  listDuplicateCandidates(draft: StoredWantedDraft): Promise<DuplicateCandidate[]>;
  storeDuplicateCheck(input: {
    draftId: string;
    tokenHash: string;
    criteriaHash: string;
    expiresAt: string;
  }): Promise<void>;
  preparePublication(input: {
    commissionerUserId: string;
    draftId: string;
    tokenHash: string;
    criteriaHash: string;
    amountSen: number;
    durationDays: 7 | 14 | 30;
    feeRateBasisPoints: number;
    policyVersion: string;
    accessBasis: "contributors_only";
  }): Promise<"prepared" | "required" | "expired">;
}
