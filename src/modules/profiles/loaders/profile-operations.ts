import type { SupabaseClient } from "@supabase/supabase-js";
import { failure } from "@/contracts/operation-result";
import type { OwnPaymentDetails, SavePaymentDetailsResult } from "@/contracts/payment-details";
import type {
  AvatarUploadResult,
  ReadPublicProfileResult,
  SetAvatarResult,
  UpdateProfileResult,
} from "@/contracts/profiles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getRequestSupabaseClient, getRequestUser } from "@/lib/supabase/server";
import { SupabaseProfileRepository } from "../repositories/supabase-profile-repository";
import { ProfileService, type ProfileActor } from "../services/profile-service";
import { SupabasePaymentDetailsRepository } from "../repositories/supabase-payment-details-repository";
import { PaymentDetailsService } from "../services/payment-details-service";

async function context(): Promise<{ actor: ProfileActor | null; service: ProfileService }> {
  const client = await getRequestSupabaseClient();
  const {
    data: { user },
  } = await getRequestUser();
  const actor = user ? { emailVerified: Boolean(user.email_confirmed_at), userId: user.id } : null;
  // Public profile reads use the admin client only after the viewer's email is
  // verified, the same bar as browsing the Board.
  const readClient = actor?.emailVerified ? createSupabaseAdminClient() : client;
  return { actor, service: new ProfileService(new SupabaseProfileRepository(client, readClient)) };
}

const unavailable = () =>
  failure("PROFILE_UNAVAILABLE" as const, "Profiles are temporarily unavailable. Try again.");

export async function updateOwnProfile(input: unknown): Promise<UpdateProfileResult> {
  try {
    const loaded = await context();
    return loaded.service.update(loaded.actor, input);
  } catch {
    return unavailable();
  }
}

export async function setOwnAvatar(input: unknown): Promise<SetAvatarResult> {
  try {
    const loaded = await context();
    return loaded.service.setAvatar(loaded.actor, input);
  } catch {
    return unavailable();
  }
}

export async function setOwnAvatarPreset(input: unknown): Promise<SetAvatarResult> {
  try {
    const loaded = await context();
    return loaded.service.setAvatarPreset(loaded.actor, input);
  } catch {
    return unavailable();
  }
}

export async function chooseOwnExternalAvatar(): Promise<SetAvatarResult> {
  try {
    const loaded = await context();
    return loaded.service.chooseExternalAvatar(loaded.actor);
  } catch {
    return unavailable();
  }
}

export async function readPublicProfile(publicId: string): Promise<ReadPublicProfileResult> {
  try {
    const loaded = await context();
    return loaded.service.readPublic(loaded.actor, publicId);
  } catch {
    return unavailable();
  }
}

export async function requestAvatarUpload(): Promise<AvatarUploadResult> {
  try {
    const loaded = await context();
    return loaded.service.requestAvatarUpload(loaded.actor);
  } catch {
    return unavailable();
  }
}

async function paymentDetailsContext() {
  const client = await getRequestSupabaseClient();
  const {
    data: { user },
  } = await getRequestUser();
  return {
    actor: user ? { userId: user.id } : null,
    service: new PaymentDetailsService(
      new SupabasePaymentDetailsRepository(client as unknown as SupabaseClient),
    ),
  };
}

/** The signed-in member's phone and bank, account number masked; null when none is on file. */
export async function readOwnPaymentDetails(): Promise<OwnPaymentDetails | null> {
  const loaded = await paymentDetailsContext();
  return loaded.service.readOwn(loaded.actor);
}

export async function saveOwnPaymentDetails(input: unknown): Promise<SavePaymentDetailsResult> {
  try {
    const loaded = await paymentDetailsContext();
    return loaded.service.save(loaded.actor, input);
  } catch {
    return failure(
      "PAYMENT_DETAILS_UNAVAILABLE" as const,
      "Your payment details could not be saved. Try again.",
    );
  }
}
