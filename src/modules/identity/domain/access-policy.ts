import type { IdentityTrust } from "./trust-state";

function hasInstitutionAccess(trust: IdentityTrust): boolean {
  return trust.email === "verified" && trust.institution === "verified" && !trust.restricted;
}

export function canBrowseMetadata(trust: IdentityTrust): boolean {
  return trust.email === "verified";
}

export function canTransact(trust: IdentityTrust): boolean {
  return hasInstitutionAccess(trust);
}

export function canSubmitClaim(trust: IdentityTrust): boolean {
  return hasInstitutionAccess(trust);
}

export function canDownload(trust: IdentityTrust): boolean {
  return hasInstitutionAccess(trust);
}
