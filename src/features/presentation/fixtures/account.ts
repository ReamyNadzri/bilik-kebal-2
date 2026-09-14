/**
 * Development fixtures for screens whose backend operation is not yet
 * integrated.
 *
 * Never imported by a screen that has been connected to a real operation, and
 * never used to stand in for a policy decision. Delete a fixture in the same
 * slice that wires its screen to the Codex-owned identity operations.
 *
 * `/profile` and `/profile/institution-verification` were connected and their
 * fixtures removed with them. Only the Sheriff Console and the email
 * verification screen still rely on this module.
 */

/**
 * The signed-in viewer for the Sheriff Console fixture.
 *
 * A plain student with no console role, so the screen renders its refusal path.
 * Console access is a backend decision surfaced through the view model; the
 * frontend only renders it.
 */
export const VIEWER = {
  hasConsoleAccess: false,
} as const;

/**
 * Address shown on the fixture email verification screen. Deliberately an
 * example domain: the approved institution domains are still an open question,
 * and a realistic-looking one could be mistaken for a confirmed value.
 */
export const PENDING_VERIFICATION_ADDRESS = "student@example.edu.my";
