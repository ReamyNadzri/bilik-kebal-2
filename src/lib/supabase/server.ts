import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { parsePublicEnv, resolveSupabasePublicConfig } from "@/lib/config/public-env";

import type { Database } from "./database.types";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const config = resolveSupabasePublicConfig(process.env);

  return createServerClient<Database>(config.url, config.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, options, value } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot write cookies. The root proxy refreshes them.
        }
      },
    },
  });
}

export function getApplicationUrl(): string {
  return parsePublicEnv(process.env).NEXT_PUBLIC_APP_URL;
}
