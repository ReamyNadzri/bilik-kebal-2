import { failure } from "@/contracts/operation-result";
import type {
  SetWantedPictureResult,
  WantedPictureUploadResult,
} from "@/contracts/wanted-pictures";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SupabaseWantedPictureRepository } from "../repositories/supabase-wanted-picture-repository";
import { WantedPictureService } from "../services/wanted-picture-service";

async function context() {
  const client = await createSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  return {
    actor: user ? { userId: user.id } : null,
    service: new WantedPictureService(new SupabaseWantedPictureRepository(client)),
  };
}

const unavailable = () =>
  failure("PICTURE_UNAVAILABLE" as const, "Pictures are unavailable right now. Try again.");

export async function prepareWantedPictureUpload(): Promise<WantedPictureUploadResult> {
  try {
    const loaded = await context();
    return loaded.service.prepareUpload(loaded.actor);
  } catch {
    return unavailable();
  }
}

export async function setWantedPicture(
  ref: string,
  input: unknown,
): Promise<SetWantedPictureResult> {
  try {
    const loaded = await context();
    return loaded.service.set(loaded.actor, ref, input);
  } catch {
    return unavailable();
  }
}

export async function removeWantedPicture(
  ref: string,
  input: unknown,
): Promise<SetWantedPictureResult> {
  try {
    const loaded = await context();
    return loaded.service.remove(loaded.actor, ref, input);
  } catch {
    return unavailable();
  }
}
