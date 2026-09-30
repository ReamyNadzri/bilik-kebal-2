/**
 * Clerk user webhook → VAULTIX identity.
 *
 * Only the verified webhook reaches this: the signature is checked in the
 * delivery layer. The database function does the idempotent work (replays,
 * out-of-order deliveries, linking imported accounts by `external_id`); this
 * service only picks the facts it needs out of Clerk's payload.
 */

/** The part of Clerk's `UserJSON` this service reads. */
export interface ClerkUserPayload {
  id: string;
  external_id: string | null;
  primary_email_address_id: string | null;
  email_addresses: ReadonlyArray<{
    id: string;
    email_address: string;
    verification: { status: string } | null;
  }>;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  /** Sign-in providers linked to the account; absent in older payloads. */
  external_accounts?: ReadonlyArray<{
    provider: string;
    image_url?: string | null;
    verification?: { status: string } | null;
  }>;
  updated_at: number;
}

export interface ClerkUserSyncInput {
  clerkUserId: string;
  externalId: string | null;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  /** The linked Google account's photo (Clerk's copy), or null. */
  googleAvatarUrl: string | null;
  clerkUpdatedAt: Date;
}

export interface ClerkUserSyncRepository {
  syncUser(input: ClerkUserSyncInput): Promise<void>;
}

export type ClerkWebhookEventLike =
  | { type: "user.created" | "user.updated"; data: ClerkUserPayload }
  | { type: string; data: unknown };

export type ClerkWebhookOutcome = "synced" | "ignored";

export function toClerkUserSyncInput(user: ClerkUserPayload): ClerkUserSyncInput {
  const primary = user.email_addresses.find(
    (address) => address.id === user.primary_email_address_id,
  );
  const fullName = [user.first_name, user.last_name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  // Only a verified Google account's photo: an email-only member keeps the
  // drawn avatars, and a Google link still being verified is not theirs yet.
  const google = (user.external_accounts ?? []).find(
    (account) => account.provider === "oauth_google" && account.verification?.status === "verified",
  );

  return {
    clerkUserId: user.id,
    externalId: user.external_id,
    email: primary?.email_address ?? null,
    emailVerified: primary?.verification?.status === "verified",
    displayName: fullName || user.username?.trim() || null,
    googleAvatarUrl: google?.image_url?.trim() || null,
    clerkUpdatedAt: new Date(user.updated_at),
  };
}

function isUserUpsert(
  event: ClerkWebhookEventLike,
): event is { type: "user.created" | "user.updated"; data: ClerkUserPayload } {
  return event.type === "user.created" || event.type === "user.updated";
}

/**
 * `user.deleted` is acknowledged but not acted on: what deleting an account
 * does to ledger, audit and archive references is an open question
 * (docs/superpowers/plans/2026-09-29-clerk-auth-migration.md). A deleted Clerk
 * user can no longer obtain a token, so nothing is reachable meanwhile.
 */
export async function handleClerkWebhook(
  event: ClerkWebhookEventLike,
  repository: ClerkUserSyncRepository,
): Promise<ClerkWebhookOutcome> {
  if (!isUserUpsert(event)) return "ignored";
  await repository.syncUser(toClerkUserSyncInput(event.data));
  return "synced";
}
