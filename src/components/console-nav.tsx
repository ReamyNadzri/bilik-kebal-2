import Link from "next/link";

export type ConsoleSection =
  | "overview"
  | "claims"
  | "appeals"
  | "requests"
  | "operations"
  | "people"
  | "moderation"
  | "badges";

const SECTIONS: readonly { id: ConsoleSection; label: string; href: string }[] = [
  { id: "overview", label: "Overview & verification", href: "/console" },
  { id: "claims", label: "Claim reviews", href: "/console/claims" },
  { id: "appeals", label: "Appeals", href: "/console/appeals" },
  { id: "requests", label: "Entries & releases", href: "/console/requests" },
  { id: "operations", label: "Payouts & refunds", href: "/console/operations" },
  { id: "people", label: "People", href: "/console/people" },
  { id: "moderation", label: "Hidden messages", href: "/console/moderation" },
  { id: "badges", label: "Badges", href: "/console/badges" },
];

/**
 * The one header every Sheriff Console page shares: the same "Sheriff
 * Console" heading at the same size, the current section named under it, and
 * the section tabs. Pages add no heading of their own above it, so switching
 * tabs never changes the title. Links only — each section authorises its own
 * operations on the server and through RLS.
 */
export function ConsoleNav({
  current,
  showTabs = true,
}: {
  readonly current: ConsoleSection;
  /** False where the viewer has no console access: the heading stays, the tabs go. */
  readonly showTabs?: boolean;
}) {
  const section = SECTIONS.find((item) => item.id === current);

  return (
    <header className="console-head">
      <h1 className="console-head__title">Sheriff Console</h1>
      {showTabs ? (
        <>
          <p className="pixel-label console-head__section">{section?.label}</p>
          <nav aria-label="Sheriff Console sections" className="console-nav">
            <ul className="ops-tabs console-nav__list">
              {SECTIONS.map((item) => (
                <li key={item.id}>
                  <Link
                    className="ops-tab console-nav__link"
                    href={item.href}
                    aria-current={item.id === current ? "page" : undefined}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </>
      ) : null}
    </header>
  );
}
