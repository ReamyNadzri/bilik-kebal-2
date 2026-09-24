import { failure } from "@/contracts/operation-result";
import type {
  ReadPublicProfileResult,
  SetAvatarResult,
  UpdateProfileResult,
} from "@/contracts/profiles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SupabaseProfileRepository } from "../repositories/supabase-profile-repository";
import { ProfileService, type ProfileActor } from "../services/profile-service";

async function context(): Promise<{ actor: ProfileActor | null; service: ProfileService }> {
  const client = await createSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
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

export async function readPublicProfile(publicId: string): Promise<ReadPublicProfileResult> {
  try {
    const loaded = await context();
    return loaded.service.readPublic(loaded.actor, publicId);
  } catch {
    return unavailable();
  }
}
