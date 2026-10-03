import { TERMS_OF_USE_VERSION } from "@/contracts/legal";

const KEY = "vaultix.termsAgreement";

/**
 * The sign-up form's ticked box, carried to the first page after the account
 * exists. The agreement cannot be recorded earlier: there is no account to
 * record it against until Clerk finishes, possibly after a round trip to
 * Google. Session storage keeps it to this tab and this visit.
 */
export function rememberTermsAgreement(): void {
  try {
    window.sessionStorage.setItem(KEY, TERMS_OF_USE_VERSION);
  } catch {
    // Storage refused (private mode): the member ticks the box once more.
  }
}

/** True once if this tab agreed to the current version at sign-up; the memory is cleared. */
export function takeTermsAgreement(): boolean {
  try {
    const version = window.sessionStorage.getItem(KEY);
    window.sessionStorage.removeItem(KEY);
    return version === TERMS_OF_USE_VERSION;
  } catch {
    return false;
  }
}
