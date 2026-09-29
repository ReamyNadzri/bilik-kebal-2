"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { ShotLink, useOptionalGunshot } from "./motion/gunshot-transition";
import { PixelIcon } from "./pixel-icon";
import { useIntentPrefetch } from "./shell-nav";
import { ThemeMusicToggle } from "./theme-music";
import {
  MARKETPLACE_NAV,
  activeNavId,
  type NavItem,
  type NavItemId,
} from "@/features/presentation/navigation";
import { COMPACT_QUERY } from "@/features/presentation/viewport";

/**
 * The compact header's drop-down menu (design_handoff_vaultix_mobile, §1).
 *
 * Below 1200 px the rail's destinations, title search and account controls
 * fold into one panel under the header, opened by the Menu toggle. The panel
 * is a disclosure rather than a modal dialog: the header above it stays live,
 * but keyboard focus is held between the toggle and the panel while it is
 * open, Esc closes it and hands focus back to the toggle, and a tap on the
 * dimmed page closes it too.
 *
 * The menu belongs to the path it was opened on, so any navigation closes it
 * without an effect having to notice.
 */

const MENU_ID = "vx-menu";
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

interface ShellMenuContextValue {
  readonly open: boolean;
  readonly setOpen: (next: boolean) => void;
  readonly toggleRef: RefObject<HTMLButtonElement | null>;
}

const ShellMenuContext = createContext<ShellMenuContextValue | null>(null);

export function ShellMenuProvider({ children }: { readonly children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const [openOn, setOpenOn] = useState<string | null>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const open = openOn === pathname;

  const setOpen = useCallback((next: boolean) => setOpenOn(next ? pathname : null), [pathname]);

  // Widening to the desktop rail retires the menu; its contents are on the rail.
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const compact = window.matchMedia(COMPACT_QUERY);
    const onChange = () => {
      if (!compact.matches) setOpenOn(null);
    };
    compact.addEventListener("change", onChange);
    return () => compact.removeEventListener("change", onChange);
  }, []);

  const value = useMemo(() => ({ open, setOpen, toggleRef }), [open, setOpen]);

  return <ShellMenuContext.Provider value={value}>{children}</ShellMenuContext.Provider>;
}

const CLOSED: ShellMenuContextValue = {
  open: false,
  setOpen: () => {},
  toggleRef: { current: null },
};

/** The menu state; closed and inert outside a provider, as in a bare test. */
export function useShellMenu(): ShellMenuContextValue {
  return useContext(ShellMenuContext) ?? CLOSED;
}

/**
 * The sticky header, which slides out of the way while the reader scrolls
 * down a compact screen and comes back as soon as they scroll up.
 *
 * Only the state lives here; the slide is applied in CSS below 1200 px, so the
 * desktop rail never moves. It never hides while the menu is open, and it
 * comes back when anything inside it takes keyboard focus.
 */
export function ShellHeader({ children }: { readonly children: ReactNode }) {
  const { open } = useShellMenu();
  const [tucked, setTucked] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY;
      if (Math.abs(delta) < 6) return;
      lastY = y;
      setTucked(y > 80 && delta > 0);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className="app-shell__header"
      data-tucked={tucked && !open}
      data-menu-open={open}
      onFocus={() => setTucked(false)}
    >
      {children}
    </header>
  );
}

/** Menu / Close, with three bars that fold into a cross. */
export function ShellMenuToggle() {
  const { open, setOpen, toggleRef } = useShellMenu();

  return (
    <button
      ref={toggleRef}
      type="button"
      className="shell-compact__menu"
      aria-expanded={open}
      aria-controls={MENU_ID}
      aria-label={open ? "Close menu" : "Open menu"}
      onClick={() => setOpen(!open)}
    >
      <span className="shell-compact__burger" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span>{open ? "Close" : "Menu"}</span>
    </button>
  );
}

function isShown(element: HTMLElement): boolean {
  return element.closest("[hidden]") === null && getComputedStyle(element).display !== "none";
}

export interface ShellMenuProps {
  readonly currentNavId?: NavItemId | null | undefined;
  readonly roleNav?: readonly NavItem[] | undefined;
  /** Who is signed in and the way out, or the ways in; supplied by the layout. */
  readonly account?: ReactNode;
}

export function ShellMenu({ account = null, currentNavId, roleNav = [] }: ShellMenuProps) {
  const { open, setOpen, toggleRef } = useShellMenu();
  const pathname = usePathname() ?? "";
  const current = currentNavId === undefined ? activeNavId(pathname) : currentNavId;
  const panelRef = useRef<HTMLDivElement>(null);
  const gunshot = useOptionalGunshot();

  const close = useCallback(
    (returnFocus: boolean) => {
      setOpen(false);
      if (returnFocus) toggleRef.current?.focus();
    },
    [setOpen, toggleRef],
  );

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close(true);
        return;
      }
      const panel = panelRef.current;
      const toggle = toggleRef.current;
      if (event.key !== "Tab" || panel === null || toggle === null) return;

      // Focus stays between the toggle and the panel while the menu is open.
      const ring = [toggle, ...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(isShown);
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (first === undefined || last === undefined) return;
      const active = document.activeElement;
      if (!ring.includes(active as HTMLElement)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, close, toggleRef]);

  return (
    <>
      {open ? (
        <div className="shell-menu__backdrop" aria-hidden="true" onClick={() => close(true)} />
      ) : null}
      <div
        ref={panelRef}
        id={MENU_ID}
        className="shell-menu"
        hidden={!open}
        // A link to the page already showing changes no path, so it would not
        // close the menu on its own.
        onClick={(event) => {
          if (event.target instanceof Element && event.target.closest("a[href]")) close(false);
        }}
      >
        <div className="shell-menu__inner">
          <form
            className="shell-menu__search"
            action="/board"
            method="get"
            role="search"
            onSubmit={() => close(false)}
          >
            <PixelIcon name="search" className="shell-nav__icon" />
            <label className="visually-hidden" htmlFor="shell-menu-search">
              Quick search by request title
            </label>
            <input
              className="shell-menu__search-input"
              id="shell-menu-search"
              name="q"
              type="search"
              placeholder="Search request titles"
            />
          </form>

          <nav aria-label="Primary">
            <ul className="shell-menu__nav">
              {[...MARKETPLACE_NAV, ...roleNav].map((item) => (
                <MenuLink key={item.id} item={item} current={current === item.id} />
              ))}
            </ul>
          </nav>

          <div className="shell-menu__account">
            {account}
            <ThemeMusicToggle variant="row" />
            {gunshot === null ? null : (
              // On a phone the floating Gunshot switch would sit on the tab
              // bar, so it moves in here. Hidden from 720 px, where it floats.
              <button
                type="button"
                className="shell-menu__setting shell-menu__setting--mobile"
                aria-pressed={gunshot.enabled}
                onClick={() => gunshot.setEnabled(!gunshot.enabled)}
              >
                <span className="shell-menu__setting-name">Gunshot transition</span>
                <span className="shell-menu__setting-state" aria-hidden="true">
                  <span className="shell-menu__setting-dot" />
                  {gunshot.enabled ? "On" : "Off"}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function MenuLink({ item, current }: { readonly item: NavItem; readonly current: boolean }) {
  const intentPrefetch = useIntentPrefetch(item.href);

  return (
    <li>
      <ShotLink
        href={item.href}
        {...intentPrefetch}
        className="shell-menu__link"
        aria-current={current ? "page" : undefined}
      >
        <span>{item.label}</span>
        <span className="shell-menu__arrow" aria-hidden="true">
          →
        </span>
      </ShotLink>
    </li>
  );
}
