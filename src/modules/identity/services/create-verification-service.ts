import { createSupabaseServerClient } from "@/lib/supabase/server";

import { SupabaseVerificationRepository } from "../repositories/supabase-verification-repository";
import {
  VerificationService,
  type PlatformRole,
  type VerificationActor,
} from "./verification-service";

export interface AuthenticatedIdentityContext {
  actor: VerificationActor;
  email: string;
  emailVerified: boolean;
  service: VerificationService;
  userId: string;
}

export async function createVerificationContext(): Promise<AuthenticatedIdentityContext | null> {
  const client = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user?.email) {
    return null;
  }

  const [platformRolesResult, institutionRolesResult] = await Promise.all([
    client.from("platform_role_assignments").select("role").eq("user_id", user.id),
    client
      .from("institution_role_assignments")
      .select("institution_id")
      .eq("user_id", user.id)
      .eq("role", "institution_sheriff"),
  ]);

  if (platformRolesResult.error || institutionRolesResult.error) {
    throw new Error("Identity role lookup failed");
  }

  const roles = platformRolesResult.data.map(({ role }) => role);
  const platformRole: PlatformRole | null = roles.includes("owner")
    ? "owner"
    : roles.includes("platform_sheriff")
      ? "platform_sheriff"
      : null;

  return {
    actor: {
      authenticatedAt: user.last_sign_in_at ?? user.created_at,
      institutionSheriffFor: institutionRolesResult.data.map(
        ({ institution_id }) => institution_id,
      ),
      platformRole,
      userId: user.id,
    },
    email: user.email,
    emailVerified: Boolean(user.email_confirmed_at),
    service: new VerificationService(new SupabaseVerificationRepository(client), () => new Date()),
    userId: user.id,
  };
}
