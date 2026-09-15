import { UiStatus } from "./ui-status";

/**
 * The Sheriff Console refusal.
 *
 * Rendered when the console operations refuse the viewer. It states that the
 * refusal came from the server rather than from a missing link, because the
 * one audience most likely to probe a hidden navigation entry is the audience
 * reading this.
 */
export function ConsoleLanding() {
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
