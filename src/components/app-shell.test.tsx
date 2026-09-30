import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { AppShell } from "./app-shell";
import { SHERIFF_CONSOLE_NAV } from "@/features/presentation/navigation";

const pathname = vi.hoisted(() => ({ current: "/" }));
const router = vi.hoisted(() => ({
  prefetch: vi.fn(),
  refresh: vi.fn(),
  push: vi.fn(),
  back: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => pathname.current,
  useRouter: () => router,
}));

beforeEach(() => {
  pathname.current = "/";
  router.prefetch.mockClear();
  router.push.mockClear();
  router.back.mockClear();
  // jsdom has no Web Audio and no record of an interaction, so the shell's
  // theme music never starts here. Its behaviour is covered in
  // theme-music.test.tsx.
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderShell(props: Partial<React.ComponentProps<typeof AppShell>> = {}) {
  return render(
    <AppShell {...props}>
      <h1>Board</h1>
    </AppShell>,
  );
}

/**
 * The desktop rail's destinations. jsdom applies no media queries, so every
 * layout's controls are in the document at once; the rail is its landmark.
 */
function rail() {
  return within(screen.getByRole("navigation", { name: "Primary" }));
}

test("provides keyboard-first navigation landmarks", () => {
  renderShell();

  expect(screen.getByRole("link", { name: "Skip to content" })).toHaveAttribute(
    "href",
    "#main-content",
  );
  expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
  expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
});

test("keeps the skip link as the first focusable element", () => {
  const { container } = renderShell();

  const focusable = container.querySelectorAll("a, button, input, select, textarea");

  expect(focusable[0]).toHaveAttribute("href", "#main-content");
});

test("renders page content inside the main landmark", () => {
  renderShell();

  expect(screen.getByRole("main")).toContainElement(screen.getByRole("heading", { name: "Board" }));
});

describe("marketplace navigation", () => {
  test("leads with the three marketplace destinations", () => {
    renderShell();

    const primary = screen.getByRole("navigation", { name: "Primary" });

    for (const label of ["Wanted Board", "Hunt", "Archive"]) {
      expect(within(primary).getByRole("link", { name: label })).toBeInTheDocument();
    }
  });

  test("separates account utilities into their own landmark", () => {
    renderShell();

    const account = screen.getByRole("navigation", { name: "Account" });

    expect(within(account).getByRole("link", { name: "Notifications" })).toBeInTheDocument();
  });

  test("badges unread notifications and says the count in words", () => {
    renderShell({ unreadCount: 2 });

    expect(screen.getByRole("button", { name: "Notifications, 2 unread" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  test("shows no badge when nothing is unread", () => {
    renderShell({ unreadCount: 0 });

    expect(screen.getByRole("button", { name: "Notifications" })).toBeInTheDocument();
  });

  test("keeps account utilities out of the marketplace landmark", () => {
    renderShell();

    const primary = screen.getByRole("navigation", { name: "Primary" });

    expect(within(primary).queryByRole("link", { name: "Profile" })).not.toBeInTheDocument();
  });

  test("offers posting a Wanted as the one prominent action", () => {
    renderShell();

    // The desktop rail, the tablet row and the phone's tab bar each carry it;
    // CSS shows exactly one per layout.
    const posts = screen.getAllByRole("link", { name: "Post a Wanted" });

    expect(posts.length).toBeGreaterThan(0);
    for (const post of posts) expect(post).toHaveAttribute("href", "/wanted/new");
  });

  test("routes the wordmark home", () => {
    renderShell();

    expect(screen.getByRole("link", { name: "VAULTIX" })).toHaveAttribute("href", "/");
  });
});

describe("current destination", () => {
  test("marks the Board while the viewer is on it", () => {
    pathname.current = "/board";
    renderShell();

    expect(rail().getByRole("link", { name: "Wanted Board" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(rail().getByRole("link", { name: "Hunt" })).not.toHaveAttribute("aria-current");
  });

  test("keeps the Board marked while reading one of its Wanteds", () => {
    pathname.current = "/wanted/csc510-final-exam-notes";
    renderShell();

    expect(screen.getByRole("link", { name: "Wanted Board" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("marks Hunt on the claims route", () => {
    pathname.current = "/claims";
    renderShell();

    expect(rail().getByRole("link", { name: "Hunt" })).toHaveAttribute("aria-current", "page");
  });

  test("marks no destination on the homepage", () => {
    pathname.current = "/";
    renderShell();

    for (const label of ["Wanted Board", "Hunt", "Archive"]) {
      expect(rail().getByRole("link", { name: label })).not.toHaveAttribute("aria-current");
    }
    expect(screen.getByRole("link", { name: "Notifications" })).not.toHaveAttribute("aria-current");
  });

  test("accepts an explicit override from the caller", () => {
    pathname.current = "/board";
    renderShell({ currentNavId: "archive" });

    expect(rail().getByRole("link", { name: "Archive" })).toHaveAttribute("aria-current", "page");
    expect(rail().getByRole("link", { name: "Wanted Board" })).not.toHaveAttribute("aria-current");
  });
});

describe("prefetching", () => {
  /**
   * Every screen is rendered per request, so a prefetch buys a destination's
   * route and loading state only. The rail asks for one when the reader shows
   * intent, never merely because a link is on screen.
   */
  test("prefetches nothing merely by rendering", () => {
    renderShell();

    expect(router.prefetch).not.toHaveBeenCalled();
  });

  test("prefetches a destination when the pointer rests on it", () => {
    renderShell();

    fireEvent.mouseEnter(screen.getByRole("link", { name: "Wanted Board" }));

    expect(router.prefetch).toHaveBeenCalledWith("/board");
  });

  test("prefetches a destination when it takes keyboard focus", () => {
    renderShell();

    act(() => rail().getByRole("link", { name: "Hunt" }).focus());

    expect(router.prefetch).toHaveBeenCalledWith("/claims");
  });

  test("prefetches the Post action when it takes keyboard focus", () => {
    renderShell();

    const [railPost] = screen.getAllByRole("link", { name: "Post a Wanted" });
    act(() => railPost?.focus());

    expect(router.prefetch).toHaveBeenCalledWith("/wanted/new");
  });
});

describe("role destinations", () => {
  test("shows no console destination for an ordinary viewer", () => {
    renderShell();

    expect(screen.queryByRole("link", { name: "Sheriff Console" })).not.toBeInTheDocument();
  });

  test("adds role destinations beside the marketplace ones", () => {
    renderShell({ roleNav: [SHERIFF_CONSOLE_NAV] });

    const primary = screen.getByRole("navigation", { name: "Primary" });
    const console = within(primary).getByRole("link", { name: "Sheriff Console" });

    expect(console).toHaveAttribute("href", "/console");

    for (const label of ["Wanted Board", "Hunt", "Archive"]) {
      expect(within(primary).getByRole("link", { name: label })).toBeInTheDocument();
    }
  });

  test("marks a role destination as current when it is the active page", () => {
    pathname.current = "/console";
    renderShell({ roleNav: [SHERIFF_CONSOLE_NAV] });

    expect(screen.getByRole("link", { name: "Sheriff Console" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});

describe("account slot", () => {
  /**
   * The shell decides nothing about who is looking at it. It renders the slot
   * it was handed, which is what keeps it a Server Component and keeps it
   * renderable here without standing up a session.
   */
  test("renders whatever account control it is given", () => {
    renderShell({ accountMenu: <button type="button">Sign out</button> });

    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  test("renders no account control when it is given none", () => {
    renderShell();

    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
  });

  test("keeps the skip link ahead of the account control", () => {
    const { container } = renderShell({ accountMenu: <button type="button">Sign out</button> });

    const focusable = container.querySelectorAll("a, button, input, select, textarea");

    expect(focusable[0]).toHaveAttribute("href", "#main-content");
  });
});

describe("footer", () => {
  test("says what the product is rather than carrying a design disclaimer", () => {
    renderShell();

    expect(
      screen.getByText(/academic resource bounty marketplace for Malaysian university students/i),
    ).toBeInTheDocument();
  });

  test("states that a Sheriff reviews before access or payment", () => {
    renderShell();

    expect(screen.getByText(/Sheriff reviews every claim/i)).toBeInTheDocument();
  });

  test("no longer presents the provisional notice as product content", () => {
    renderShell();

    expect(
      screen.queryByText("Provisional interface. Final visual design pending external handoff."),
    ).not.toBeInTheDocument();
  });
});

describe("compact header", () => {
  test("offers a way back on every screen but the homepage", () => {
    pathname.current = "/";
    const { unmount } = renderShell();
    expect(screen.queryByRole("button", { name: "Go back" })).not.toBeInTheDocument();
    unmount();

    pathname.current = "/board";
    renderShell();
    expect(screen.getByRole("button", { name: "Go back" })).toBeInTheDocument();
  });

  test("goes home rather than out of the site when there is no in-app history", () => {
    pathname.current = "/wanted/csc510-final-exam-notes";
    renderShell();

    fireEvent.click(screen.getByRole("button", { name: "Go back" }));

    expect(router.back).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith("/");
  });

  test("renders the compact account slot it is given", () => {
    renderShell({ compactAccount: <a href="/notifications">Inbox</a> });

    expect(screen.getByRole("link", { name: "Inbox" })).toBeInTheDocument();
  });
});

describe("compact menu", () => {
  function toggle() {
    return screen.getByRole("button", { name: /menu/i, expanded: false }) as HTMLElement;
  }

  test("starts closed, with its panel out of the accessibility tree", () => {
    renderShell();

    expect(toggle()).toHaveAttribute("aria-controls", "vx-menu");
    expect(screen.getAllByRole("navigation", { name: "Primary" })).toHaveLength(1);
  });

  test("opens into the destinations, the title search and the account block", () => {
    pathname.current = "/board";
    renderShell({ menuAccount: <button type="button">Sign out</button> });

    fireEvent.click(toggle());

    const close = screen.getByRole("button", { name: "Close menu" });
    expect(close).toHaveAttribute("aria-expanded", "true");
    expect(close).toHaveTextContent("Close");

    const panel = within(document.getElementById("vx-menu") as HTMLElement);
    expect(panel.getByRole("searchbox", { name: "Quick search by request title" })).toBeVisible();
    expect(panel.getByRole("link", { name: /Wanted Board/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(panel.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    expect(panel.getByRole("button", { name: "Music" })).toBeInTheDocument();
  });

  test("closes on Escape and hands focus back to the toggle", () => {
    renderShell();

    fireEvent.click(toggle());
    const panel = document.getElementById("vx-menu") as HTMLElement;
    act(() => within(panel).getByRole("searchbox").focus());
    fireEvent.keyDown(document, { key: "Escape" });

    expect(panel).not.toBeVisible();
    expect(toggle()).toHaveFocus();
  });

  test("keeps keyboard focus between the toggle and the panel while open", () => {
    renderShell();

    fireEvent.click(toggle());
    const close = screen.getByRole("button", { name: "Close menu" });
    const focusable = document
      .getElementById("vx-menu")
      ?.querySelectorAll<HTMLElement>("a[href], button, input");
    const last = focusable?.[focusable.length - 1];

    act(() => last?.focus());
    fireEvent.keyDown(document, { key: "Tab" });
    expect(close).toHaveFocus();

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();
  });

  test("closes when the dimmed page behind it is tapped", () => {
    const { container } = renderShell();

    fireEvent.click(toggle());
    fireEvent.click(container.querySelector(".shell-menu__backdrop") as Element);

    expect(document.getElementById("vx-menu")).not.toBeVisible();
  });

  test("closes on navigation", () => {
    pathname.current = "/board";
    const { rerender } = renderShell();

    fireEvent.click(toggle());
    pathname.current = "/map";
    rerender(
      <AppShell>
        <h1>Map</h1>
      </AppShell>,
    );

    expect(document.getElementById("vx-menu")).not.toBeVisible();
  });

  test("never tucks the header away while the menu is open", () => {
    renderShell();

    fireEvent.click(toggle());

    expect(document.querySelector(".app-shell__header")).toHaveAttribute("data-tucked", "false");
  });
});

describe("phone tab bar", () => {
  function tabs() {
    return within(screen.getByRole("navigation", { name: "Quick" }));
  }

  test("reaches Board, Map, Post, Hunt and Archive", () => {
    renderShell();

    expect(tabs().getByRole("link", { name: "Board" })).toHaveAttribute("href", "/board");
    expect(tabs().getByRole("link", { name: "Map" })).toHaveAttribute("href", "/map");
    expect(tabs().getByRole("link", { name: "Post a Wanted" })).toHaveAttribute(
      "href",
      "/wanted/new",
    );
    expect(tabs().getByRole("link", { name: "Hunt" })).toHaveAttribute("href", "/claims");
    expect(tabs().getByRole("link", { name: "Archive" })).toHaveAttribute("href", "/archive");
  });

  test("marks the current tab", () => {
    pathname.current = "/claims";
    renderShell();

    expect(tabs().getByRole("link", { name: "Hunt" })).toHaveAttribute("aria-current", "page");
    expect(tabs().getByRole("link", { name: "Board" })).not.toHaveAttribute("aria-current");
  });
});
