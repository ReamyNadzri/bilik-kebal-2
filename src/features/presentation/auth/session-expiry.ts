type Listener = () => void;

const listeners = new Set<Listener>();

/**
 * Announces that an operation was refused because the session is gone.
 *
 * Only `AUTH_REQUIRED` reaches here. A `401` on its own does not mean the
 * session expired: sign-in answers `401 INVALID_CREDENTIALS` for a wrong
 * password, and treating that as an expiry would sign the viewer out of a
 * session they were still trying to start. The machine code is the signal, not
 * the status (docs/integration/identity-http-contract.md).
 */
export function reportSessionExpired(): void {
  for (const listener of [...listeners]) {
    listener();
  }
}

export function onSessionExpired(listener: Listener): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}
