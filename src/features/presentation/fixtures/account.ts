/**
 * Development fixture for the one screen whose backend operations are not yet
 * integrated.
 *
 * Never imported by a screen that has been connected to a real operation, and
 * never used to stand in for a policy decision. Delete a fixture in the same
 * slice that wires its screen to the Codex-owned identity operations.
 *
 * `/profile`, `/profile/institution-verification` and `/verify-email` were
 * connected and their fixtures removed with them. Only the Sheriff Console
 * still relies on this module.
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
