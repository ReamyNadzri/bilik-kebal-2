import { randomUUID } from "node:crypto";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import { SupabaseEvidenceUploadGateway } from "../gateways/supabase-evidence-upload-gateway";
import { EvidenceUploadService } from "./evidence-upload-service";

export interface EvidenceUploadContext {
  emailVerified: boolean;
  service: EvidenceUploadService;
  userId: string;
}

export async function createEvidenceUploadContext(): Promise<EvidenceUploadContext | null> {
  const client = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user) {
    return null;
  }

  return {
    emailVerified: Boolean(user.email_confirmed_at),
    service: new EvidenceUploadService(new SupabaseEvidenceUploadGateway(client), randomUUID),
    userId: user.id,
  };
}
