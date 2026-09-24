"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export interface TabItem {
  readonly id: string;
  readonly label: ReactNode;
  readonly panel: ReactNode;
}

export interface TabsProps {
  readonly label: string;
  readonly items: readonly TabItem[];
  readonly initialId?: string;
  readonly className?: string;
}

/**
 * WAI-ARIA tabs: one tab stop for the row, arrow keys and Home/End move
 * between tabs, and only the selected panel is rendered. Every panel stays in
 * the tab order through its own content; the panel itself is focusable so a
 * keyboard user can land on a panel that has no controls.
 */
export function Tabs({ label, items, initialId, className = "" }: TabsProps) {
  const baseId = useId();
  const [selected, setSelected] = useState(initialId ?? items[0]?.id ?? "");
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const current = items.find((item) => item.id === selected) ?? items[0];

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const index = items.findIndex((item) => item.id === selected);
    let next: TabItem | undefined;
    if (event.key === "ArrowRight") next = items[(index + 1) % items.length];
    else if (event.key === "ArrowLeft") next = items[(index - 1 + items.length) % items.length];
    else if (event.key === "Home") next = items[0];
    else if (event.key === "End") next = items[items.length - 1];
    if (!next) return;
    event.preventDefault();
    setSelected(next.id);
    refs.current[next.id]?.focus();
  }

  if (!current) return null;

  return (
    <div className={`tabs ${className}`.trim()}>
      <div role="tablist" aria-label={label} className="ops-tabs tabs__list">
        {items.map((item) => (
          <button
            key={item.id}
            ref={(node) => {
              refs.current[item.id] = node;
            }}
            type="button"
            role="tab"
            id={`${baseId}-tab-${item.id}`}
            aria-controls={`${baseId}-panel-${item.id}`}
            aria-selected={item.id === current.id}
            tabIndex={item.id === current.id ? 0 : -1}
            className="ops-tab"
            onClick={() => setSelected(item.id)}
            onKeyDown={onKeyDown}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`${baseId}-panel-${current.id}`}
        aria-labelledby={`${baseId}-tab-${current.id}`}
        tabIndex={0}
        className="tabs__panel"
      >
        {current.panel}
      </div>
    </div>
  );
}
