import type { ListWantedQuery, ListWantedResult, ReadWantedResult } from "@/contracts/marketplace";
import { failure, success } from "@/contracts/operation-result";
import type { WantedRepository } from "../repositories/wanted-repository";

export interface WantedReadActor {
  emailVerified: boolean;
}

export class WantedReadService {
  constructor(private readonly repository: WantedRepository) {}
  async list(actor: WantedReadActor | null, query: ListWantedQuery): Promise<ListWantedResult> {
    if (!actor) return failure("AUTH_REQUIRED", "Sign in and verify your email to browse Wanteds.");
    if (!actor.emailVerified)
      return failure("EMAIL_NOT_VERIFIED", "Verify your email to browse Wanteds.");
    try {
      return success(await this.repository.listPublicWanted(query));
    } catch {
      return failure(
        "MARKETPLACE_UNAVAILABLE",
        "The Wanted Board is temporarily unavailable. Try again.",
      );
    }
  }
  async read(actor: WantedReadActor | null, publicId: string): Promise<ReadWantedResult> {
    if (!actor) return failure("AUTH_REQUIRED", "Sign in and verify your email to browse Wanteds.");
    if (!actor.emailVerified)
      return failure("EMAIL_NOT_VERIFIED", "Verify your email to browse Wanteds.");
    try {
      const wanted = await this.repository.readPublicWanted(publicId);
      return wanted ? success(wanted) : failure("WANTED_NOT_FOUND", "Wanted request not found.");
    } catch {
      return failure(
        "MARKETPLACE_UNAVAILABLE",
        "The Wanted request is temporarily unavailable. Try again.",
      );
    }
  }
}
