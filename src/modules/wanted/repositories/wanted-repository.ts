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
  /** The course `values.courseCode` names. */
  courseId: string;
}

export interface PersistWantedDraft {
  commissionerUserId: string;
  institutionId: string;
  values: ValidatedWantedDraftInput;
  /** The course `values.courseCode` resolved to, from `ensureCourse`. */
  courseId: string;
  acceptedAt: string;
}

export interface WantedRepository {
  listPublicWanted(query: ListWantedQuery): Promise<WantedSummary[]>;
  readPublicWanted(publicId: string): Promise<WantedDetail | null>;
  /** Every chosen value except the typed course code, which `ensureCourse` resolves. */
  taxonomyMatchesInstitution(
    institutionId: string,
    values: ValidatedWantedDraftInput,
  ): Promise<boolean>;
  /**
   * The course a typed code names, filed under the programme when the code is
   * new. Null when a Sheriff has deactivated that code.
   */
  ensureCourse(programmeId: string, courseCode: string): Promise<string | null>;
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
    durationDays: number;
    feeRateBasisPoints: number;
    policyVersion: string;
    accessBasis: "contributors_only";
  }): Promise<"prepared" | "required" | "expired">;
}
