import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
});

export type PublicEnv = z.infer<typeof publicSchema>;

export function parsePublicEnv(input: Record<string, unknown>): PublicEnv {
  return publicSchema.parse(input);
}

export function resolveSupabasePublicConfig(input: Record<string, unknown>): {
  key: string;
  url: string;
} {
  const env = parsePublicEnv(input);
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!env.NEXT_PUBLIC_SUPABASE_URL || !key) {
    throw new Error("Supabase public configuration is incomplete");
  }

  return { key, url: env.NEXT_PUBLIC_SUPABASE_URL };
}
