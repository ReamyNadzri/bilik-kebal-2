import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { NextRequest } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { clerkWebhookHttp } from "@/modules/identity/delivery/clerk-webhook-http";
import { SupabaseClerkUserSyncRepository } from "@/modules/identity/repositories/supabase-clerk-user-sync-repository";
import { handleClerkWebhook } from "@/modules/identity/services/clerk-user-sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Signed by Clerk with `CLERK_WEBHOOK_SIGNING_SECRET`; see clerk-webhook-http.ts. */
export async function POST(request: NextRequest): Promise<Response> {
  return clerkWebhookHttp(request, {
    verify: () => verifyWebhook(request),
    handle: (event) =>
      handleClerkWebhook(event, new SupabaseClerkUserSyncRepository(createSupabaseAdminClient())),
  });
}
