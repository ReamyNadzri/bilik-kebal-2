import { deleteOwnAccount } from "@/modules/profiles/loaders/profile-operations";

export const dynamic = "force-dynamic";

const STATUS: Record<string, number> = {
  AUTH_REQUIRED: 401,
  ACCOUNT_TOO_NEW: 409,
  ACCOUNT_HAS_OPEN_ITEMS: 409,
  PROFILE_UNAVAILABLE: 503,
};

/** Deletes the signed-in member's own account (anonymised; ledger and audit kept). */
export async function DELETE(): Promise<Response> {
  const result = await deleteOwnAccount();
  return Response.json(result, {
    headers: { "Cache-Control": "private, no-store" },
    status: result.ok ? 200 : (STATUS[result.code] ?? 400),
  });
}
