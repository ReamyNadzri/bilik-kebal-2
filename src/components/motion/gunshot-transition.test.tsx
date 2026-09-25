import { act, fireEvent, render, screen } from "@testing-library/react";
import { GunshotProvider, ShotLink } from "./gunshot-transition";

const router = vi.hoisted(() => ({ push: vi.fn(), prefetch: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));

function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduce && query === "(prefers-reduced-motion: reduce)",
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

function renderLink() {
  render(
    <GunshotProvider>
      <ShotLink href="/board">Wanted Board</ShotLink>
    </GunshotProvider>,
  );
  return screen.getByRole("link", { name: "Wanted Board" });
}

/** Whether anything before the browser's default action prevented it. */
function clickAndReportPrevented(link: HTMLElement, init: MouseEventInit = {}) {
  let prevented: boolean | null = null;
  const observe = (event: Event) => {
    prevented = event.defaultPrevented;
    // jsdom cannot navigate; stop it trying once the answer is recorded.
    event.preventDefault();
  };
  window.addEventListener("click", observe);
  fireEvent.click(link, init);
  window.removeEventListener("click", observe);
  return prevented;
}

beforeEach(() => {
  router.push.mockReset();
  router.prefetch.mockReset();
  window.localStorage.clear();
  stubReducedMotion(false);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("ShotLink", () => {
  test("plays the shot, then changes the route at 390 ms and clears the overlay at 1050 ms", () => {
    vi.useFakeTimers();
    const link = renderLink();

    expect(clickAndReportPrevented(link, { button: 0, clientX: 40, clientY: 60 })).toBe(true);
    expect(screen.getByTestId("gunshot-overlay")).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(389));
    expect(router.push).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(router.push).toHaveBeenCalledExactlyOnceWith("/board");

    act(() => vi.advanceTimersByTime(659));
    expect(screen.getByTestId("gunshot-overlay")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByTestId("gunshot-overlay")).not.toBeInTheDocument();
  });

  test("ignores further clicks while a shot is running", () => {
    vi.useFakeTimers();
    const link = renderLink();

    fireEvent.click(link, { button: 0 });
    fireEvent.click(link, { button: 0 });
    act(() => vi.advanceTimersByTime(1050));

    expect(router.push).toHaveBeenCalledOnce();
  });

  test.each([
    ["Ctrl", { ctrlKey: true }],
    ["Cmd", { metaKey: true }],
    ["Shift", { shiftKey: true }],
    ["Alt", { altKey: true }],
  ])("leaves a %s-click to the browser so a new tab still opens", (_, modifier) => {
    const link = renderLink();

    expect(clickAndReportPrevented(link, { button: 0, ...modifier })).toBe(false);
    expect(screen.queryByTestId("gunshot-overlay")).not.toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
  });

  test("navigates at once, with no effect, when the toggle is off", () => {
    window.localStorage.setItem("vaultix.gunshot", "off");
    const link = renderLink();

    fireEvent.click(link, { button: 0 });

    expect(router.push).toHaveBeenCalledExactlyOnceWith("/board");
    expect(screen.queryByTestId("gunshot-overlay")).not.toBeInTheDocument();
  });

  test("navigates at once, with no effect, when the viewer prefers reduced motion", () => {
    stubReducedMotion(true);
    const link = renderLink();

    fireEvent.click(link, { button: 0 });

    expect(router.push).toHaveBeenCalledExactlyOnceWith("/board");
    expect(screen.queryByTestId("gunshot-overlay")).not.toBeInTheDocument();
  });

  test("is a plain link outside a GunshotProvider", () => {
    render(<ShotLink href="/board">Wanted Board</ShotLink>);
    const link = screen.getByRole("link", { name: "Wanted Board" });

    expect(link).toHaveAttribute("href", "/board");
    expect(screen.queryByRole("button", { name: "Gunshot page transition" })).toBeNull();
  });
});

describe("GunshotToggle", () => {
  test("is on by default, and flips aria-pressed and the saved choice", () => {
    renderLink();
    const toggle = screen.getByRole("button", { name: "Gunshot page transition" });

    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(toggle).toHaveTextContent("Gunshot On");

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(toggle).toHaveTextContent("Gunshot Off");
    expect(window.localStorage.getItem("vaultix.gunshot")).toBe("off");

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(window.localStorage.getItem("vaultix.gunshot")).toBe("on");
  });

  test("starts from the saved choice", () => {
    window.localStorage.setItem("vaultix.gunshot", "off");
    renderLink();

    expect(screen.getByRole("button", { name: "Gunshot page transition" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});
