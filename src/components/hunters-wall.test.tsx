import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { HuntersWall } from "./hunters-wall";
import { aHuntersPage } from "@/features/presentation/test-support/hunters";

const fetchMock = vi.fn();

function reply(body: unknown) {
  return Promise.resolve({ json: () => Promise.resolve(body) });
}

function reduceMotion(reduce: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: reduce,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }) as unknown as typeof window.matchMedia;
}

function posters() {
  return within(screen.getByRole("list", { name: "Hunters" })).getAllByRole("link");
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  window.history.replaceState(null, "", "/board?view=hunters");
  reduceMotion(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("the wall as rendered", () => {
  test("names the count, the page size and the page", () => {
    render(<HuntersWall initial={aHuntersPage(1, 10, 24)} />);

    expect(screen.getByRole("heading", { level: 1, name: "Hunters on the Board" })).toBeVisible();
    expect(screen.getByText("24 Hunters")).toBeInTheDocument();
    const sizes = within(screen.getByRole("group", { name: "Posters per page" }));
    expect(sizes.getByRole("button", { name: "10" })).toHaveAttribute("aria-pressed", "true");
    expect(sizes.getByRole("button", { name: "15" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("Page 1 of 3")).toHaveAttribute("aria-live", "polite");
    expect(posters()).toHaveLength(10);
    expect(posters()[0]).toHaveAccessibleName("View profile of Hunter 1");
  });

  test("marks the ends of the wall without taking the buttons out of the tab order", () => {
    render(<HuntersWall initial={aHuntersPage(3, 10, 24)} />);

    expect(screen.getByRole("button", { name: "Previous" })).toHaveAttribute(
      "aria-disabled",
      "false",
    );
    const next = screen.getByRole("button", { name: "Next page" });
    expect(next).toHaveAttribute("aria-disabled", "true");
    expect(next).not.toBeDisabled();
    fireEvent.click(next);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("puts the first Hunter in the middle of the board", () => {
    render(<HuntersWall initial={aHuntersPage(1, 15, 15)} />);

    // jsdom is 1024px wide: four columns, four rows, the centre-most cell first.
    const first = posters()[0]!.closest("li")!;
    expect(first.style.gridColumn).toBe("2");
    expect(first.style.gridRow).toBe("2");
  });

  test("says so when nobody is on the wall yet", () => {
    render(<HuntersWall initial={aHuntersPage(1, 10, 0)} />);

    expect(screen.getByText("No Hunters on the Board yet")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Hunter pages" })).not.toBeInTheDocument();
  });
});

describe("paging with reduced motion", () => {
  test("swaps the page in place and records it in the URL", async () => {
    fetchMock.mockReturnValue(reply({ ok: true, data: aHuntersPage(2, 10, 24) }));
    render(<HuntersWall initial={aHuntersPage(1, 10, 24)} />);

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));

    expect(await screen.findByText("Page 2 of 3")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/hunters?per=10&page=2", { cache: "no-store" });
    expect(window.location.search).toBe("?view=hunters&page=2");
    expect(posters()[0]).toHaveAccessibleName("View profile of Hunter 11");
    // No transform beyond the poster's resting tilt, and no transition.
    expect(posters()[0]!.closest("li")!.style.transition).toBe("none");
  });

  test("a new page size starts again from page one", async () => {
    fetchMock.mockReturnValue(reply({ ok: true, data: aHuntersPage(1, 15, 24) }));
    render(<HuntersWall initial={aHuntersPage(2, 10, 24)} />);

    fireEvent.click(screen.getByRole("button", { name: "15" }));

    expect(await screen.findByText("Page 1 of 2")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/hunters?per=15&page=1", { cache: "no-store" });
    expect(screen.getByRole("button", { name: "15" })).toHaveAttribute("aria-pressed", "true");
  });

  test("keeps the current posters and offers a retry when a page fails", async () => {
    fetchMock.mockReturnValueOnce(
      reply({ ok: false, code: "PROFILE_UNAVAILABLE", message: "Temporarily unavailable." }),
    );
    render(<HuntersWall initial={aHuntersPage(1, 10, 24)} />);

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));

    expect(await screen.findByText("That page of Hunters could not be loaded")).toBeVisible();
    expect(posters()[0]).toHaveAccessibleName("View profile of Hunter 1");

    fetchMock.mockReturnValueOnce(reply({ ok: true, data: aHuntersPage(2, 10, 24) }));
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Page 2 of 3")).toBeInTheDocument();
    expect(screen.queryByText("That page of Hunters could not be loaded")).not.toBeInTheDocument();
  });

  test("follows the Back button to the page in the URL", async () => {
    fetchMock.mockReturnValue(reply({ ok: true, data: aHuntersPage(3, 10, 24) }));
    render(<HuntersWall initial={aHuntersPage(1, 10, 24)} />);

    window.history.pushState(null, "", "/board?view=hunters&page=3");
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(await screen.findByText("Page 3 of 3")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/hunters?per=10&page=3", { cache: "no-store" });
  });
});

describe("paging with motion", () => {
  beforeEach(() => {
    reduceMotion(false);
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "requestAnimationFrame", "cancelAnimationFrame"],
    });
  });

  test("fetches while the posters fly off, ignores clicks mid-flip, then grows the new page", async () => {
    fetchMock.mockReturnValue(reply({ ok: true, data: aHuntersPage(2, 10, 24) }));
    render(<HuntersWall initial={aHuntersPage(1, 10, 24)} />);

    // Opened in the browser, the wall grows from the centre, and a click
    // before the posters land is ignored.
    expect(posters()[0]!.closest("li")!.style.transform).toContain("scale(0.35)");
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(40);
    });
    expect(posters()[0]!.closest("li")!.style.opacity).toBe("1");

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));

    // The next page is requested at once, while the current one leaves.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(posters()[0]!.closest("li")!.style.opacity).toBe("0");
    expect(screen.getByText("Loading page 2…")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    fireEvent.click(screen.getByRole("button", { name: "20" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // 560ms + 10 × 22ms, then the new page is collapsed at the centre...
    await act(async () => {
      await vi.advanceTimersByTimeAsync(780);
    });
    expect(posters()[0]).toHaveAccessibleName("View profile of Hunter 11");
    expect(posters()[0]!.closest("li")!.style.transform).toContain("scale(0.35)");

    // ...and two frames later grows to rest.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(40);
    });
    expect(posters()[0]!.closest("li")!.style.opacity).toBe("1");
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
  });
});
