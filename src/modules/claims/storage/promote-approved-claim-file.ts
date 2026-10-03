/**
 * Server-only Storage operations on a claim's file, by key. Nothing here reads,
 * parses, converts or proxies the file: Storage copies it and signs URLs for it.
 * Pass the service-role client's `storage`, and only after the caller has been
 * authorised (an RPC or the entitlement policy). Errors carry no object keys.
 */

export interface StorageErrorLike {
  readonly message?: string | undefined;
  readonly status?: number | undefined;
  readonly statusCode?: string | number | undefined;
}

interface ClaimStorageBucket {
  copy(
    fromPath: string,
    toPath: string,
    options?: { destinationBucket?: string },
  ): Promise<{ error: StorageErrorLike | null }>;
  createSignedUrl(
    path: string,
    expiresIn: number,
    options?: { download?: string | boolean },
  ): Promise<{ data: { signedUrl: string } | null; error: StorageErrorLike | null }>;
}

/** The slice of `SupabaseClient["storage"]` these operations use. */
export interface ClaimStorage {
  from(bucket: string): ClaimStorageBucket;
}

export interface ClaimFileLocation {
  readonly bucket: string;
  readonly objectKey: string;
  /** The claim's status; only an approved claim's file is repaired. */
  readonly status: string;
}

const QUARANTINE_BUCKET = "quarantine";
const APPROVED_BUCKET = "approved";

export type PromotionOutcome = "copied" | "already_present" | "failed";

function code(error: StorageErrorLike): string {
  return String(error.statusCode ?? error.status ?? "");
}

function isNotFound(error: StorageErrorLike): boolean {
  return code(error) === "404" || error.status === 404 || /not.?found/i.test(error.message ?? "");
}

function isAlreadyPresent(error: StorageErrorLike): boolean {
  return (
    code(error) === "409" ||
    error.status === 409 ||
    /already exists|duplicate/i.test(error.message ?? "")
  );
}

/**
 * Copies an approved claim's file from quarantine to the same key in the
 * approved bucket. Idempotent: an object already there counts as success. The
 * quarantined original is kept, as retention requires. Never throws.
 */
export async function promoteApprovedClaimFile(
  storage: ClaimStorage,
  objectKey: string,
): Promise<PromotionOutcome> {
  try {
    const { error } = await storage
      .from(QUARANTINE_BUCKET)
      .copy(objectKey, objectKey, { destinationBucket: APPROVED_BUCKET });
    if (!error) return "copied";
    return isAlreadyPresent(error) ? "already_present" : "failed";
  } catch {
    return "failed";
  }
}

export type SignOutcome = { ok: true; url: string } | { ok: false; reason: "not_found" | "failed" };

async function sign(
  storage: ClaimStorage,
  bucket: string,
  objectKey: string,
  expiresInSeconds: number,
  options: { download?: string } | undefined,
): Promise<SignOutcome> {
  try {
    const { data, error } = await storage
      .from(bucket)
      .createSignedUrl(objectKey, expiresInSeconds, options);
    if (!error && data?.signedUrl) return { ok: true, url: data.signedUrl };
    return { ok: false, reason: error && isNotFound(error) ? "not_found" : "failed" };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

/**
 * Signs a short-lived URL for a claim's file. When an approved claim's file is
 * missing from the approved bucket (the copy after approval failed, or predates
 * it), the file is promoted from quarantine and signed once more.
 */
export async function signClaimFile(
  storage: ClaimStorage,
  file: ClaimFileLocation,
  expiresInSeconds: number,
  options?: { download?: string },
): Promise<SignOutcome> {
  const first = await sign(storage, file.bucket, file.objectKey, expiresInSeconds, options);
  if (
    first.ok ||
    first.reason !== "not_found" ||
    file.status !== "approved" ||
    file.bucket !== APPROVED_BUCKET
  ) {
    return first;
  }
  const promotion = await promoteApprovedClaimFile(storage, file.objectKey);
  if (promotion === "failed") return { ok: false, reason: "failed" };
  return sign(storage, file.bucket, file.objectKey, expiresInSeconds, options);
}
