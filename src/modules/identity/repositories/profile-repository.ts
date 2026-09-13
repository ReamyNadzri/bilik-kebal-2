import type { Enums } from "@/lib/supabase/database.types";

import type { IdentityTrust } from "../domain/trust-state";

export interface ProfileRecord {
  userId: string;
  displayName: string;
  emailConfirmedAt: string | null;
  institutionVerificationState: Enums<"institution_verification_state"> | null;
  hasActiveRestriction: boolean;
}

export interface ProfileReader {
  findProfileByUserId(userId: string): Promise<ProfileRecord | null>;
}

export interface ProfileViewModel {
  userId: string;
  displayName: string;
  trust: IdentityTrust;
}

/** Maps server-only persistence records into the browser-safe identity view model. */
export class ProfileRepository {
  constructor(private readonly reader: ProfileReader) {}

  async findByUserId(userId: string): Promise<ProfileViewModel | null> {
    const profile = await this.reader.findProfileByUserId(userId);

    if (!profile) {
      return null;
    }

    return {
      userId: profile.userId,
      displayName: profile.displayName,
      trust: {
        email: profile.emailConfirmedAt ? "verified" : "unverified",
        institution: profile.institutionVerificationState ?? "unverified",
        restricted: profile.hasActiveRestriction,
      },
    };
  }
}
