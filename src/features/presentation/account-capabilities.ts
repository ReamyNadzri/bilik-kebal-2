/**
 * What the signed-in account may currently do, as decided by the backend.
 *
 * This is presentation input, not a policy. The identity module owns the
 * decision (canBrowseMetadata, canTransact, canSubmitClaim, canDownload) and
 * a view model will supply these booleans. The frontend must never recompute
 * them from a trust state, and must never import or restate `IdentityTrust`.
 */
export interface AccountCapabilities {
  browseMetadata: boolean;
  transact: boolean;
  submitClaim: boolean;
  download: boolean;
}
