/** The part of Clerk's `UserResource` read here. */
interface ClerkUserLike {
  readonly externalAccounts?: ReadonlyArray<{
    readonly provider: string;
    readonly imageUrl?: string | null;
    readonly verification?: { readonly status?: string | null } | null;
  }> | null;
}

/**
 * The photo of the verified Google account a member signed in with, or null.
 *
 * Deliberately not Clerk's `imageUrl`: for an email-only member that is a
 * placeholder Clerk generates, and VAULTIX shows its own drawn avatar instead.
 */
export function googlePhotoUrl(user: ClerkUserLike | null | undefined): string | null {
  const google = user?.externalAccounts?.find(
    (account) => account.provider === "google" && account.verification?.status === "verified",
  );
  return google?.imageUrl || null;
}

const SYNCED_KEY = "vaultix_google_photo_synced";

/**
 * Once per browser session, for a Google member still on the default drawing:
 * copies their Clerk account (and so their Google photo) to VAULTIX. Accounts
 * that existed before Google photos were kept, or whose webhook has not
 * arrived, pick the photo up this way. Returns whether anything was sent.
 */
export async function syncGooglePhotoOnce(): Promise<boolean> {
  try {
    if (window.sessionStorage.getItem(SYNCED_KEY)) return false;
    window.sessionStorage.setItem(SYNCED_KEY, "1");
  } catch {
    return false;
  }
  try {
    const response = await fetch("/api/identity/clerk-sync", { method: "POST" });
    return response.ok;
  } catch {
    return false;
  }
}
