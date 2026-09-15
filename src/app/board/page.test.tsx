import { render, screen, within } from "@testing-library/react";
import BoardPage from "./page";

async function renderBoard(params: Record<string, string> = {}) {
  return render(await BoardPage({ searchParams: Promise.resolve(params) }));
}

function results() {
  return screen.getByRole("list", { name: /wanted requests/i });
}

function titles() {
  return within(results())
    .getAllByRole("heading", { level: 3 })
    .map((heading) => heading.textContent);
}

describe("the Board itself", () => {
  test("names the screen", async () => {
    await renderBoard();

    expect(screen.getByRole("heading", { level: 1, name: "Wanted Board" })).toBeInTheDocument();
  });

  test("lists every open request when nothing is applied", async () => {
    await renderBoard();

    expect(within(results()).getAllByRole("listitem")).toHaveLength(12);
  });

  test("counts the requests in words the reader can act on", async () => {
    await renderBoard();

    expect(screen.getByText("12 Wanted requests")).toBeInTheDocument();
  });

  test("shows the metadata a reader needs to choose between requests", async () => {
    await renderBoard({ q: "csc510 final" });

    const card = within(results()).getAllByRole("listitem")[0]!;

    expect(within(card).getByText("CSC510")).toBeInTheDocument();
    expect(within(card).getByText("Database Systems")).toBeInTheDocument();
    expect(within(card).getByText("UiTM Shah Alam")).toBeInTheDocument();
    expect(within(card).getByText("Lecture notes")).toBeInTheDocument();
    expect(within(card).getByText("Semester 2, 2024/2025")).toBeInTheDocument();
    expect(within(card).getByText("Total bounty RM 85")).toBeInTheDocument();
    expect(within(card).getByText("6 backers")).toBeInTheDocument();
    expect(within(card).getByText("Closes in 2 days")).toBeInTheDocument();
    expect(within(card).getByText("Open")).toBeInTheDocument();
  });

  test("leads through to the Wanted", async () => {
    await renderBoard({ q: "csc510 final" });

    expect(
      within(results()).getByRole("link", { name: /View this Wanted: Final exam notes/ }),
    ).toHaveAttribute("href", "/wanted/csc510-final-exam-notes");
  });

  test("previews no file behind any request", async () => {
    const { container } = await renderBoard();

    expect(container.innerHTML).not.toMatch(/download|\.pdf|\.docx|object_key|bucket|storage/i);
  });
});

describe("search", () => {
  test("narrows the Board to what was typed", async () => {
    await renderBoard({ q: "past year" });

    expect(titles().every((title) => title?.includes("Past year"))).toBe(true);
    expect(titles().length).toBeGreaterThan(0);
  });

  test("says how many of the whole Board matched", async () => {
    await renderBoard({ q: "csc510" });

    expect(screen.getByText("3 of 12 Wanted requests")).toBeInTheDocument();
  });

  test("keeps what was typed in the field so it can be edited, not retyped", async () => {
    await renderBoard({ q: "calculus" });

    expect(screen.getByRole("searchbox", { name: /search wanted requests/i })).toHaveValue(
      "calculus",
    );
  });

  test("submits to the Board as a plain query", async () => {
    const { container } = await renderBoard();
    const form = container.querySelector("form");

    expect(form).toHaveAttribute("action", "/board");
    expect(form).toHaveAttribute("method", "get");
  });
});

describe("filters", () => {
  test("offers every filter the Board promises", async () => {
    await renderBoard();

    for (const label of ["Campus", "Course", "Resource type", "Academic session", "Status"]) {
      expect(screen.getByRole("combobox", { name: label })).toBeInTheDocument();
    }
  });

  test("narrows to a campus", async () => {
    await renderBoard({ campus: "arau" });

    const cards = within(results()).getAllByRole("listitem");

    expect(cards.length).toBeGreaterThan(0);
    expect(cards.every((card) => within(card).queryByText("UiTM Arau") !== null)).toBe(true);
  });

  test("narrows to a resource type", async () => {
    await renderBoard({ resource: "case-notes" });

    expect(titles()).toEqual(["Case summary pack for the whole syllabus"]);
  });

  test("narrows to a lifecycle state", async () => {
    await renderBoard({ status: "ending-soon" });

    const cards = within(results()).getAllByRole("listitem");

    expect(cards.every((card) => within(card).queryByText("Ending soon") !== null)).toBe(true);
  });

  test("holds the applied value in its control so the reader can see what is on", async () => {
    await renderBoard({ campus: "arau", status: "closed" });

    expect(screen.getByRole("combobox", { name: "Campus" })).toHaveValue("arau");
    expect(screen.getByRole("combobox", { name: "Status" })).toHaveValue("closed");
  });

  /**
   * The count is rendered twice — once as the rail's caption for wide screens
   * and once inside the disclosure summary for narrow ones. Only one is
   * displayed at any width, but a DOM-only test sees both, so these assert
   * that the wording exists rather than that it is unique.
   */
  test("says in text how many filters are applied", async () => {
    await renderBoard({ campus: "arau", status: "closed" });

    expect(screen.getAllByText(/2 filters applied/i).length).toBeGreaterThan(0);
  });

  test("says so in the singular for one filter", async () => {
    await renderBoard({ campus: "arau" });

    expect(screen.getAllByText(/1 filter applied/i).length).toBeGreaterThan(0);
  });

  test("says when nothing is applied rather than leaving the count blank", async () => {
    await renderBoard();

    expect(screen.getAllByText("No filters applied").length).toBeGreaterThan(0);
  });

  test("words the wide and narrow counts identically so they cannot drift", async () => {
    await renderBoard({ campus: "arau" });

    const counts = screen.getAllByText(/filter.? applied/i).map((node) => node.textContent);

    expect(new Set(counts).size).toBe(1);
  });

  test("offers no clear action when there is nothing to clear", async () => {
    await renderBoard();

    expect(screen.queryByRole("link", { name: /clear all filters/i })).not.toBeInTheDocument();
  });

  test("clears every filter while keeping the search text", async () => {
    await renderBoard({ q: "notes", campus: "arau" });

    expect(screen.getByRole("link", { name: /clear all filters/i })).toHaveAttribute(
      "href",
      "/board?q=notes",
    );
  });

  test("keeps a working submit so filtering does not depend on JavaScript", async () => {
    await renderBoard();

    expect(screen.getByRole("button", { name: "Apply filters" })).toHaveAttribute("type", "submit");
  });
});

describe("sort", () => {
  test("offers the three orders the Board promises", async () => {
    await renderBoard();

    const sort = screen.getByRole("combobox", { name: "Sort by" });

    expect(within(sort).getByRole("option", { name: "Newest first" })).toBeInTheDocument();
    expect(within(sort).getByRole("option", { name: "Highest bounty" })).toBeInTheDocument();
    expect(within(sort).getByRole("option", { name: "Ending soonest" })).toBeInTheDocument();
  });

  test("puts the biggest bounty first when asked", async () => {
    await renderBoard({ sort: "highest-bounty" });

    expect(titles()[0]).toBe("Final exam notes and summary for chapters 1 to 12");
  });

  test("puts the nearest deadline first when asked", async () => {
    await renderBoard({ sort: "ending-soon" });

    expect(titles()[0]).toBe("Formula sheet and worked examples");
  });

  test("defaults to the newest request", async () => {
    await renderBoard();

    expect(titles()[0]).toBe("Tutorial solutions for sets 1 to 6");
  });

  test("holds the chosen order in its control", async () => {
    await renderBoard({ sort: "ending-soon" });

    expect(screen.getByRole("combobox", { name: "Sort by" })).toHaveValue("ending-soon");
  });

  test("submits with the filters rather than as a second form", async () => {
    const { container } = await renderBoard();
    const form = container.querySelector("form");

    expect(screen.getByRole("combobox", { name: "Sort by" })).toHaveAttribute(
      "form",
      form?.getAttribute("id"),
    );
  });
});

describe("states the reader can reach", () => {
  test("offers a way back when a search matches nothing", async () => {
    await renderBoard({ q: "zzzz" });

    expect(
      screen.getByRole("heading", { name: "No request matches this search" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Clear the search and filters/ })).toHaveAttribute(
      "href",
      "/board",
    );
    expect(screen.queryByRole("list", { name: /wanted requests/i })).not.toBeInTheDocument();
  });

  test("names the filters as the reason when they are what excluded everything", async () => {
    await renderBoard({ campus: "samarahan", resource: "case-notes" });

    expect(
      screen.getByRole("heading", { name: "No request matches these filters" }),
    ).toBeInTheDocument();
  });

  test("invites the first request when the whole Board is empty", async () => {
    await renderBoard({ preview: "empty" });

    expect(
      screen.getByRole("heading", { name: "Nothing is on the Board yet" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Post a Wanted" })).toHaveAttribute(
      "href",
      "/wanted/new",
    );
  });

  test("says the Board could not be read rather than showing it as empty", async () => {
    await renderBoard({ preview: "unavailable" });

    expect(
      screen.getByRole("heading", { name: "The Wanted Board could not be loaded" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: /wanted requests/i })).not.toBeInTheDocument();
  });

  test("does not claim a result count it could not read", async () => {
    await renderBoard({ preview: "unavailable" });

    expect(screen.queryByText(/Wanted requests$/)).not.toBeInTheDocument();
  });
});

test("marks the screen as fixture-backed while Phase 3 has no operations", async () => {
  await renderBoard();

  expect(screen.getByText("Development only")).toBeInTheDocument();
});
