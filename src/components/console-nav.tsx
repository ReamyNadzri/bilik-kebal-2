import Link from "next/link";

export type ConsoleSection = "overview" | "claims" | "appeals" | "operations";

const SECTIONS: readonly { id: ConsoleSection; label: string; href: string }[] = [
  { id: "overview", label: "Overview & verification", href: "/console" },
  { id: "claims", label: "Claim reviews", href: "/console/claims" },
  { id: "appeals", label: "Appeals", href: "/console/appeals" },
  { id: "operations", label: "Payouts & refunds", href: "/console/operations" },
];

/**
 * The Sheriff Console's own navigation: one row of section links, the current
 * one marked. Links only — each section authorises its own operations on the
 * server and through RLS.
 */
export function ConsoleNav({ current }: { readonly current: ConsoleSection }) {
  return (
    <nav aria-label="Sheriff Console sections" className="console-nav">
      <p className="pixel-label console-nav__label">Sheriff Console</p>
      <ul className="ops-tabs console-nav__list">
        {SECTIONS.map((section) => (
          <li key={section.id}>
            <Link
              className="ops-tab console-nav__link"
              href={section.href}
              aria-current={section.id === current ? "page" : undefined}
            >
              {section.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
