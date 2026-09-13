import { getApplicationUrl, createSupabaseServerClient } from "@/lib/supabase/server";

import { AuthService } from "./auth-service";
import { SupabaseAuthGateway } from "./supabase-auth-gateway";

export async function createAuthService(): Promise<AuthService> {
  const client = await createSupabaseServerClient();
  return new AuthService(new SupabaseAuthGateway(client.auth), getApplicationUrl());
}
