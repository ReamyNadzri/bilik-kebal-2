import { failure } from "@/contracts/operation-result";
import type { ListHuntersResult, SampleHuntersResult } from "@/contracts/profiles";
import { getRequestSupabaseClient, getRequestUser } from "@/lib/supabase/server";
import { SupabaseHuntersRepository } from "../repositories/supabase-hunters-repository";
import { HuntersService } from "../services/hunters-service";
import type { ProfileActor } from "../services/profile-service";

async function context(): Promise<{ actor: ProfileActor | null; service: HuntersService }> {
  const client = await getRequestSupabaseClient();
  const {
    data: { user },
  } = await getRequestUser();
  const actor = user ? { emailVerified: Boolean(user.email_confirmed_at), userId: user.id } : null;
  return { actor, service: new HuntersService(new SupabaseHuntersRepository(client)) };
}

const unavailable = () =>
  failure("PROFILE_UNAVAILABLE" as const, "The Hunters are temporarily unavailable.");

export async function listPublicHunters(input: unknown): Promise<ListHuntersResult> {
  try {
    const loaded = await context();
    return loaded.service.list(loaded.actor, input);
  } catch {
    return unavailable();
  }
}

export async function sampleHunters(count: number): Promise<SampleHuntersResult> {
  try {
    const loaded = await context();
    return loaded.service.sample(loaded.actor, count);
  } catch {
    return unavailable();
  }
}
