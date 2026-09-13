import { UiStatus } from "./ui-status";

export interface ConsoleLandingProps {
  /**
   * Whether the viewer's role grants the console, as decided by the backend.
   * The frontend renders this decision; it never makes it.
   */
  hasConsoleAccess: boolean;
}

/**
 * Sheriff Console landing.
 *
 * The queues themselves arrive with claims and moderation in a later phase.
 * This screen exists so the role-aware navigation has a real destination and
 * so a refusal is presented properly rather than as a dead link.
 */
const PLANNED_QUEUES = [
  "Claims awaiting review",
  "Quarantined files",
  "Reports",
  "Appeals",
  "Institution verification requests",
];

export function ConsoleLanding({ hasConsoleAccess }: ConsoleLandingProps) {
  if (!hasConsoleAccess) {
    return (
      <>
        <UiStatus
          kind="restricted"
          heading="This console is for Sheriffs"
          message="Your account does not hold a Sheriff or Owner role, so there is nothing here for you to review."
        />
        <p>
          Access is checked on the server and in the database for every console operation. A hidden
          link is never what keeps a queue private.
        </p>
      </>
    );
  }

  return (
    <>
      <h2>Review queues</h2>

      <ul aria-label="Review queues">
        {PLANNED_QUEUES.map((queue) => (
          <li key={queue}>{queue}</li>
        ))}
      </ul>

      <UiStatus
        kind="empty"
        heading="The queues are not built yet"
        message="Claims, moderation, reports and appeals arrive in a later phase. Institution verification requests will appear here once their operation exists."
      />
    </>
  );
}
