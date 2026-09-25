import type { Metadata } from "next";
import { ConsoleNav } from "@/components/console-nav";
import { SheriffAppealConsole } from "@/components/claims/sheriff-appeal-console";
import { requireAccount } from "@/features/presentation/auth/require-account";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Appeals | VAULTIX",
};

export const dynamic = "force-dynamic";

/**
 * Claim appeals. The appeal operations authorise the reviewer and enforce
 * that the original decision-maker cannot decide the appeal; the reviewer id
 * passed here only lets the screen say so before they try.
 */
export default async function AppealsPage() {
  await requireAccount("/console/appeals");
  const client = await createSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  return (
    <>
      <ConsoleNav current="appeals" />
      <SheriffAppealConsole currentSheriffUserId={user?.id ?? ""} />
    </>
  );
}
