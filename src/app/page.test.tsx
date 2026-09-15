import { render, screen, within } from "@testing-library/react";
import HomePage from "./page";

async function renderHome(params: Record<string, string> = {}) {
  return render(await HomePage({ searchParams: Promise.resolve(params) }));
}

describe("marketplace identity", () => {
  test("opens with the marketplace proposition, not the product name", async () => {
    await renderHome();

    expect(
      screen.getByRole("heading", { level: 1, name: "Find the notes worth hunting for." }),
    ).toBeInTheDocument();
  });

  test("explains the loop in one supporting sentence", async () => {
    await renderHome();

    expect(
      screen.getByText(
        "Post what your class needs, build a shared bounty, and reward an authorised resource after review.",
      ),
    ).toBeInTheDocument();
  });

  test("is not a sign-in page", async () => {
    await renderHome();

    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /sign in/i })).not.toBeInTheDocument();
  });

  test("claims no figure it cannot substantiate", async () => {
    const { container } = await renderHome();

    expect(container.textContent).not.toMatch(
      /\d[\d,.]*\s*(students|users|members|universities|resources shared|paid out|success rate)/i,
    );
    expect(container.textContent).not.toMatch(/trusted by|join \d|% success|testimonial/i);
  });
});

describe("search", () => {
  test("offers a labelled Wanted search", async () => {
    await renderHome();

    expect(screen.getByRole("searchbox", { name: /search wanted requests/i })).toBeInTheDocument();
  });

  test("guides the reader on what can be searched", async () => {
    await renderHome();

    expect(screen.getByRole("searchbox", { name: /search wanted requests/i })).toHaveAttribute(
      "placeholder",
      "Search course, campus, semester, or resource type",
    );
  });

  test("submits to the Board as a plain query so it works without JavaScript", async () => {
    const { container } = await renderHome();
    const form = container.querySelector("form");

    expect(form).toHaveAttribute("action", "/board");
    expect(form).toHaveAttribute("method", "get");
    expect(screen.getByRole("searchbox", { name: /search wanted requests/i })).toHaveAttribute(
      "name",
      "q",
    );
  });

  test("names the submit control by what it does", async () => {
    await renderHome();

    expect(screen.getByRole("button", { name: "Search the Board" })).toBeInTheDocument();
  });
});

describe("primary actions", () => {
  test("leads to the Board", async () => {
    await renderHome();

    expect(screen.getByRole("link", { name: "Browse the Board" })).toHaveAttribute(
      "href",
      "/board",
    );
  });

  test("offers posting a Wanted as the secondary action", async () => {
    await renderHome();

    expect(screen.getByRole("link", { name: "Post a Wanted" })).toHaveAttribute(
      "href",
      "/wanted/new",
    );
  });
});

describe("live Wanted previews", () => {
  test("shows several real requests rather than an empty hero", async () => {
    await renderHome();

    const preview = screen.getByRole("list", { name: /open wanted requests/i });

    expect(within(preview).getAllByRole("listitem").length).toBeGreaterThanOrEqual(4);
  });

  test("each preview carries its course, campus, bounty and status", async () => {
    await renderHome();

    const preview = screen.getByRole("list", { name: /open wanted requests/i });
    const first = within(preview).getAllByRole("listitem")[0]!;

    expect(within(first).getByText("CSC584")).toBeInTheDocument();
    expect(within(first).getByText("UiTM Shah Alam")).toBeInTheDocument();
    expect(within(first).getByText("Total bounty RM 60")).toBeInTheDocument();
    expect(within(first).getByText("Open")).toBeInTheDocument();
  });

  test("shows no closed request in the preview", async () => {
    await renderHome();

    const preview = screen.getByRole("list", { name: /open wanted requests/i });

    expect(within(preview).queryByText("Closed")).not.toBeInTheDocument();
  });

  test("links from a preview through to the Wanted", async () => {
    await renderHome();

    const preview = screen.getByRole("list", { name: /open wanted requests/i });

    expect(
      within(preview).getByRole("link", { name: /View this Wanted: Tutorial solutions/ }),
    ).toHaveAttribute("href", "/wanted/csc584-tutorial-solutions");
  });

  test("offers the whole Board beyond the preview", async () => {
    await renderHome();

    expect(screen.getByRole("link", { name: /See every open Wanted/ })).toHaveAttribute(
      "href",
      "/board",
    );
  });
});

describe("verification explanation", () => {
  test("separates browsing from transacting", async () => {
    await renderHome();

    expect(screen.getByText(/verify your email to browse/i)).toBeInTheDocument();
    expect(
      screen.getByText(/verify your institution to fund a bounty, claim a request or download/i),
    ).toBeInTheDocument();
  });

  test("says a Sheriff decides before access or payment", async () => {
    await renderHome();

    expect(screen.getByText(/A Sheriff reviews every claim/i)).toBeInTheDocument();
  });
});

describe("how it works", () => {
  test("describes the loop as three ordered steps", async () => {
    await renderHome();

    const steps = screen.getByRole("list", { name: /how VAULTIX works/i });

    expect(within(steps).getAllByRole("listitem")).toHaveLength(3);
  });

  test("ends on the Sheriff decision rather than on payment", async () => {
    await renderHome();

    const steps = screen.getByRole("list", { name: /how VAULTIX works/i });
    const last = within(steps).getAllByRole("listitem")[2]!;

    expect(last.textContent).toMatch(/Sheriff reviews/i);
  });
});

describe("states the reader can reach", () => {
  test("says so when the Board cannot be read, instead of showing an empty one", async () => {
    await renderHome({ preview: "unavailable" });

    expect(
      screen.getByRole("heading", { name: "Open requests could not be loaded" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: /open wanted requests/i })).not.toBeInTheDocument();
  });

  test("keeps the search and both actions usable when the preview fails", async () => {
    await renderHome({ preview: "unavailable" });

    expect(screen.getByRole("link", { name: "Browse the Board" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: /search wanted requests/i })).toBeInTheDocument();
  });

  test("invites the first request when nothing is open", async () => {
    await renderHome({ preview: "empty" });

    expect(screen.getByRole("heading", { name: "No open requests yet" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Post a Wanted" }).length).toBeGreaterThan(0);
  });
});

test("marks the screen as fixture-backed while Phase 3 has no operations", async () => {
  await renderHome();

  expect(screen.getByText("Development only")).toBeInTheDocument();
});
