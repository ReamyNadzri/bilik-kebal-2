import { render, screen, within } from "@testing-library/react";
import { AppShell } from "./app-shell";
import { SHERIFF_CONSOLE_NAV } from "@/features/presentation/navigation";

const pathname = vi.hoisted(() => ({ current: "/" }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathname.current,
}));

beforeEach(() => {
  pathname.current = "/";
});

function renderShell(props: Partial<React.ComponentProps<typeof AppShell>> = {}) {
  return render(
    <AppShell {...props}>
      <h1>Board</h1>
    </AppShell>,
  );
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
    expect(within(account).getByRole("link", { name: "Profile" })).toBeInTheDocument();
  });

  test("keeps account utilities out of the marketplace landmark", () => {
    renderShell();

    const primary = screen.getByRole("navigation", { name: "Primary" });

    expect(within(primary).queryByRole("link", { name: "Profile" })).not.toBeInTheDocument();
  });

  test("offers posting a Wanted as the one prominent action", () => {
    renderShell();

    expect(screen.getByRole("link", { name: "Post a Wanted" })).toHaveAttribute(
      "href",
      "/wanted/new",
    );
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

    expect(screen.getByRole("link", { name: "Wanted Board" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Hunt" })).not.toHaveAttribute("aria-current");
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

    expect(screen.getByRole("link", { name: "Hunt" })).toHaveAttribute("aria-current", "page");
  });

  test("marks no destination on the homepage", () => {
    pathname.current = "/";
    renderShell();

    for (const label of ["Wanted Board", "Hunt", "Archive", "Notifications", "Profile"]) {
      expect(screen.getByRole("link", { name: label })).not.toHaveAttribute("aria-current");
    }
  });

  test("accepts an explicit override from the caller", () => {
    pathname.current = "/board";
    renderShell({ currentNavId: "archive" });

    expect(screen.getByRole("link", { name: "Archive" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Wanted Board" })).not.toHaveAttribute("aria-current");
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
