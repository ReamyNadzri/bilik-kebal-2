import { createClient } from "@supabase/supabase-js";
import { resolveSupabasePublicConfig } from "@/lib/config/public-env";
import type { Database } from "./database.types";

export function createSupabaseAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey)
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for privileged server operations");
  const config = resolveSupabasePublicConfig(process.env);
  return createClient<Database>(config.url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
