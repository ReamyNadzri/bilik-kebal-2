import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SupabaseEntitlementRepository } from "../repositories/supabase-entitlement-repository";
import { EntitlementService } from "./entitlement-service";

export async function createEntitlementService(): Promise<{
  service: EntitlementService;
  userId: string;
} | null> {
  const client = await createSupabaseServerClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return null;
  return {
    service: new EntitlementService(new SupabaseEntitlementRepository(client)),
    userId: auth.user.id,
  };
}
