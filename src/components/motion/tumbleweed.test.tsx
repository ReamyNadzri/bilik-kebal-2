/**
 * jsdom has no AnimationEvent, so React DOM, which checks for it once as it
 * loads, would listen for the prefixed `webkitAnimationEnd` instead and never
 * see `fireEvent.animationEnd`. Give it one before anything imports React DOM.
 */
vi.hoisted(() => {
  if (!("AnimationEvent" in window)) {
    Object.defineProperty(window, "AnimationEvent", {
      configurable: true,
      value: class AnimationEvent extends Event {},
    });
  }
});

import { act, fireEvent, render, screen } from "@testing-library/react";
import { Tumbleweed } from "./tumbleweed";

function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduce && query === "(prefers-reduced-motion: reduce)",
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

function stubHidden(hidden: boolean) {
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
}

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

beforeEach(() => {
  vi.useFakeTimers();
  stubReducedMotion(false);
  stubHidden(false);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  // Back to the Document.prototype getter.
  delete (document as { hidden?: boolean }).hidden;
});

describe("Tumbleweed", () => {
  test("rolls nothing before 15 s, one pass by 40 s, and removes it when the roll ends", () => {
    render(<Tumbleweed />);

    advance(14_999);
    expect(screen.queryByTestId("tumbleweed")).not.toBeInTheDocument();

    advance(25_001);
    const pass = screen.getByTestId("tumbleweed");
    expect(pass).toHaveAttribute("aria-hidden", "true");
    expect(pass.parentElement).toBe(document.body);

    fireEvent.animationEnd(pass);
    expect(screen.queryByTestId("tumbleweed")).not.toBeInTheDocument();
  });

  test("ignores the hop and spin ending; only the outer roll removes the pass", () => {
    render(<Tumbleweed />);
    advance(40_000);

    fireEvent.animationEnd(document.querySelector(".tumbleweed__img")!);
    expect(screen.getByTestId("tumbleweed")).toBeInTheDocument();
  });

  test("schedules the next pass 50–120 s after the first", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    render(<Tumbleweed />);

    advance(15_000);
    fireEvent.animationEnd(screen.getByTestId("tumbleweed"));

    advance(49_999);
    expect(screen.queryByTestId("tumbleweed")).not.toBeInTheDocument();
    advance(1);
    expect(screen.getByTestId("tumbleweed")).toBeInTheDocument();
  });

  test("skips a pass while the tab is hidden but keeps scheduling", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    stubHidden(true);
    render(<Tumbleweed />);

    advance(15_000);
    expect(screen.queryByTestId("tumbleweed")).not.toBeInTheDocument();

    stubHidden(false);
    advance(50_000);
    expect(screen.getByTestId("tumbleweed")).toBeInTheDocument();
  });

  test("takes the high end of every range and rolls right to left with the spin reversed", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    render(<Tumbleweed />);
    advance(40_000);

    const pass = screen.getByTestId("tumbleweed");
    // 0.99 lands near the top of each range and fails the 60% left-to-right draw.
    expect(pass.style.width).toBe("124px");
    expect(pass.style.getPropertyValue("--tw-x0")).toBe("calc(100vw + 164px)");
    expect(pass.style.getPropertyValue("--tw-x1")).toBe("-164px");
    expect(document.querySelector(".tumbleweed__img")).toHaveClass("tumbleweed__img--rev");
    expect(document.querySelector(".tumbleweed__img")).toHaveAttribute(
      "src",
      "/brand/tumbleweed-3.webp",
    );
  });

  test("takes the low end of every range and rolls left to right from off-screen", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    render(<Tumbleweed />);
    advance(15_000);

    const pass = screen.getByTestId("tumbleweed");
    expect(pass.style.width).toBe("70px");
    expect(pass.style.height).toBe("70px");
    expect(pass.style.bottom).toBe("4px");
    expect(pass.style.getPropertyValue("--tw-x0")).toBe("-110px");
    expect(pass.style.getPropertyValue("--tw-x1")).toBe("calc(100vw + 110px)");
    expect(pass.style.getPropertyValue("--tw-dur")).toBe("7s");
    expect(pass.style.getPropertyValue("--tw-hop")).toBe("18px");
    expect(document.querySelector(".tumbleweed__img")).not.toHaveClass("tumbleweed__img--rev");
  });

  test("never rolls under reduced motion", () => {
    stubReducedMotion(true);
    render(<Tumbleweed />);
    advance(10 * 60_000);
    expect(screen.queryByTestId("tumbleweed")).not.toBeInTheDocument();
  });

  test("never rolls when disabled", () => {
    render(<Tumbleweed enabled={false} />);
    advance(10 * 60_000);
    expect(screen.queryByTestId("tumbleweed")).not.toBeInTheDocument();
  });
});
