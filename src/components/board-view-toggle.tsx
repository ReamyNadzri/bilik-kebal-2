"use client";

import { useRouter } from "next/navigation";

export type BoardView = "wanted" | "hunters";

const VIEWS: ReadonlyArray<{ id: BoardView; label: string; href: string }> = [
  { id: "wanted", label: "Wanted requests", href: "/board" },
  { id: "hunters", label: "Hunters", href: "/board?view=hunters" },
];

/**
 * Switches the Board between Wanted requests and the Hunters wall. The view
 * is in the URL, so each is linkable and Back returns to the other; the
 * pressed button says which one is showing.
 */
export function BoardViewToggle({ current }: { readonly current: BoardView }) {
  const router = useRouter();

  return (
    <div className="board-view-toggle" role="group" aria-label="Board view">
      {VIEWS.map((view) => (
        <button
          key={view.id}
          type="button"
          className="board-view-toggle__option"
          aria-pressed={view.id === current}
          onClick={() => {
            if (view.id !== current) router.push(view.href);
          }}
        >
          {view.label}
        </button>
      ))}
    </div>
  );
}
