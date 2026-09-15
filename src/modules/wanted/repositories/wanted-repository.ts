import type { ValidatedWantedDraftInput, WantedDraftView } from "@/contracts/marketplace";

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
  taxonomyMatchesInstitution(
    institutionId: string,
    values: ValidatedWantedDraftInput,
  ): Promise<boolean>;
  createDraft(input: PersistWantedDraft): Promise<StoredWantedDraft>;
  findDraft(draftId: string, commissionerUserId: string): Promise<StoredWantedDraft | null>;
  updateDraft(input: PersistWantedDraft & { draftId: string }): Promise<StoredWantedDraft>;
}
