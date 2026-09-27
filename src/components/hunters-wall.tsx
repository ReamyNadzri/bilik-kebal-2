"use client";

import {
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { HuntersWallScraps } from "./hunters-wall-scraps";
import { MissingPoster } from "./missing-poster";
import { usePrefersReducedMotion } from "./motion/gunshot-transition";
import { UiStatus } from "./ui-status";
import {
  HUNTERS_PAGE_SIZES,
  type ListHuntersResult,
  type PublicHuntersPage,
} from "@/contracts/profiles";
import {
  huntersHref,
  parseHuntersParams,
  type HuntersParams,
} from "@/features/presentation/hunters-params";
import {
  centreOutCells,
  flipOutDuration,
  posterKey,
  posterLook,
  posterMotion,
  wallColumns,
  wallZIndex,
  type WallPhase,
} from "@/features/presentation/hunters-wall-layout";
import { useHydrated } from "@/features/presentation/use-hydrated";

export interface HuntersWallProps {
  /** The page the server rendered, from the Board's URL. */
  readonly initial: PublicHuntersPage;
}

function subscribeToWidth(onChange: () => void): () => void {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}
const readWidth = () => window.innerWidth;
/** The server has no viewport; it lays out for a desktop and the browser corrects it. */
const serverWidth = () => 1440;

async function fetchHunters({ per, page }: HuntersParams): Promise<ListHuntersResult> {
  try {
    const response = await fetch(`/api/hunters?per=${per}&page=${page}`, { cache: "no-store" });
    return (await response.json()) as ListHuntersResult;
  } catch {
    return {
      ok: false,
      code: "PROFILE_UNAVAILABLE",
      message: "The Hunters could not be reached. Check your connection.",
    };
  }
}

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

/**
 * The Hunters wall: verified members as "MISSING" posters on a wooden board,
 * laid out from the centre outward.
 *
 * Paging is a flip. The posters fly off the board while the next page is
 * fetched, then the new page grows from the centre. The page lives in the URL
 * (`?view=hunters&per=15&page=2`), pushed without a server round trip, so a
 * page is linkable and Back returns to the one before. With reduced motion
 * the page is swapped in place.
 */
export function HuntersWall({ initial }: HuntersWallProps) {
  const still = usePrefersReducedMotion();
  const hydrated = useHydrated();
  const width = useSyncExternalStore(subscribeToWidth, readWidth, serverWidth);
  const perLabelId = useId();
  const [shown, setShown] = useState(initial);
  // Opening the wall after a client navigation grows it from the centre. A
  // server-rendered wall is already on screen, so it is not collapsed again.
  const [phase, setPhase] = useState<WallPhase>(() => (hydrated && !still ? "pre" : "in"));
  const [pending, setPending] = useState<HuntersParams | null>(null);
  const [failure, setFailure] = useState<{ target: HuntersParams; message: string } | null>(null);
  const flipping = useRef(phase !== "in");

  useEffect(() => {
    if (phase !== "pre") return;
    let second = 0;
    const first = window.requestAnimationFrame(() => {
      second = window.requestAnimationFrame(() => {
        flipping.current = false;
        setPhase("in");
      });
    });
    return () => {
      window.cancelAnimationFrame(first);
      window.cancelAnimationFrame(second);
    };
  }, [phase]);

  async function flip(target: HuntersParams, history: "push" | "none") {
    if (flipping.current) return;
    if (target.per === shown.pageSize && target.page === shown.page) return;
    flipping.current = true;
    setFailure(null);
    setPending(target);
    if (history === "push") window.history.pushState(null, "", huntersHref(target));
    // Fetched while the posters fly off, so the new page rarely waits.
    const request = fetchHunters(target);
    if (!still) {
      setPhase("out");
      await wait(flipOutDuration(shown.pageSize));
    }
    const result = await request;
    setPending(null);
    if (!result.ok) {
      flipping.current = false;
      setFailure({ target, message: result.message });
      setPhase("in");
      return;
    }
    if (result.data.page !== target.page) {
      window.history.replaceState(
        null,
        "",
        huntersHref({ per: result.data.pageSize, page: result.data.page }),
      );
    }
    setShown(result.data);
    if (still) {
      flipping.current = false;
      setPhase("in");
    } else {
      setPhase("pre");
    }
  }

  const onHistory = useEffectEvent(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("view") !== "hunters") return;
    void flip(
      parseHuntersParams((name) => params.get(name)),
      "none",
    );
  });

  useEffect(() => {
    const listener = () => onHistory();
    window.addEventListener("popstate", listener);
    return () => window.removeEventListener("popstate", listener);
  }, []);

  const count = shown.items.length;
  const columns = wallColumns(count, width);
  const cells = centreOutCells(count, columns);
  const pages = Math.max(1, Math.ceil(shown.total / shown.pageSize));
  const atFirst = shown.page <= 1;
  const atLast = shown.page >= pages;
  const go = (target: HuntersParams) => void flip(target, "push");

  return (
    <div className="hunters-wall">
      <div className="panel page-heading hunters-heading">
        <div className="hunters-heading__intro">
          <p className="pixel-label">UiTM · Hunters</p>
          <h1 className="hunters-heading__title">Hunters on the Board</h1>
          <p className="page-heading__lede">
            Verified students who hunt and back bounties. Open a poster to see their profile.
          </p>
        </div>
        <div className="hunters-heading__controls">
          <p className="hunters-heading__count numeric">
            {shown.total} {shown.total === 1 ? "Hunter" : "Hunters"}
          </p>
          <div className="hunters-per-page" role="group" aria-labelledby={perLabelId}>
            <span className="hunters-per-page__label" id={perLabelId}>
              Posters per page
            </span>
            {HUNTERS_PAGE_SIZES.map((size) => (
              <button
                key={size}
                type="button"
                className="hunters-per-page__option numeric"
                aria-pressed={size === shown.pageSize}
                onClick={() => go({ per: size, page: 1 })}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="hunters-board">
        <HuntersWallScraps />
        <div className="hunters-board__light" aria-hidden="true" />
        {count === 0 ? (
          <div className="hunters-board__status">
            <UiStatus
              kind="empty"
              heading="No Hunters on the Board yet"
              message="Members appear here once they verify their institution."
            />
          </div>
        ) : (
          <ul
            className="hunters-board__grid"
            aria-label="Hunters"
            aria-busy={pending !== null}
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {shown.items.map((hunter, index) => {
              const key = posterKey(hunter.publicId);
              const cell = cells[index]!;
              const look = posterLook(key);
              const motion = posterMotion(still ? "in" : phase, {
                index,
                count,
                key,
                cell,
                look,
              });
              return (
                <li
                  key={hunter.publicId}
                  className="hunters-board__slot"
                  style={
                    {
                      gridColumn: cell.column,
                      gridRow: cell.row,
                      "--wall-z": wallZIndex(index, key),
                      transform: motion.transform,
                      opacity: motion.opacity,
                      transition: still ? "none" : motion.transition,
                    } as CSSProperties
                  }
                >
                  <MissingPoster hunter={hunter} variant="wall" />
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {failure ? (
        <UiStatus
          kind="offline"
          heading="That page of Hunters could not be loaded"
          message={`${failure.message} The posters above are still page ${shown.page}.`}
          action={
            <button
              type="button"
              className="button button--ghost"
              onClick={() => void flip(failure.target, "none")}
            >
              Try again
            </button>
          }
        />
      ) : null}

      {count > 0 ? (
        <nav className="hunters-pager" aria-label="Hunter pages">
          <button
            type="button"
            className="button button--ghost hunters-pager__button"
            aria-disabled={atFirst}
            onClick={() => {
              if (!atFirst) go({ per: shown.pageSize, page: shown.page - 1 });
            }}
          >
            <span aria-hidden="true">←</span> Previous
          </button>
          <p className="hunters-pager__label" aria-live="polite">
            {pending ? `Loading page ${pending.page}…` : `Page ${shown.page} of ${pages}`}
          </p>
          <button
            type="button"
            className="button button--primary hunters-pager__button hunters-pager__next"
            aria-disabled={atLast}
            onClick={() => {
              if (!atLast) go({ per: shown.pageSize, page: shown.page + 1 });
            }}
          >
            Next page <span aria-hidden="true">→</span>
          </button>
        </nav>
      ) : null}
    </div>
  );
}
