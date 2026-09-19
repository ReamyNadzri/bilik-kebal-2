import { render, screen, within } from "@testing-library/react";
import BoardPage from "./page";
import { aTaxonomy, TAXONOMY_ID } from "@/features/marketplace/test-support/taxonomy";
import { aWanted } from "@/features/marketplace/test-support/wanted";
import { toSen } from "@/features/marketplace/money";

const listPublicWanted = vi.hoisted(() => vi.fn());
const readPublicWanted = vi.hoisted(() => vi.fn());
const loadMarketplaceTaxonomy = vi.hoisted(() => vi.fn());

vi.mock("@/modules/wanted/loaders/wanted-operations", () => ({
  listPublicWanted,
  readPublicWanted,
}));

vi.mock("@/modules/taxonomy/loaders/taxonomy-read", () => ({
  loadMarketplaceTaxonomy,
}));

beforeEach(() => {
  listPublicWanted.mockReset().mockResolvedValue({ ok: true, data: [aWanted()] });
  loadMarketplaceTaxonomy.mockReset().mockResolvedValue({ ok: true, data: aTaxonomy() });
});

async function renderPage(params: Record<string, string> = {}) {
  return render(await BoardPage({ searchParams: Promise.resolve(params) }));
}

function sentQuery() {
  return listPublicWanted.mock.calls.at(-1)?.[0] as Record<string, unknown>;
}

describe("sending the URL filters to the backend", () => {
  test("asks for the newest order when the URL names none", async () => {
    await renderPage();

    expect(sentQuery()).toEqual({ sort: "newest" });
  });

  test("forwards every identifier under the name the contract uses", async () => {
    await renderPage({
      q: "past year",
      campus: TAXONOMY_ID.campus,
      course: TAXONOMY_ID.course,
      resource: TAXONOMY_ID.resourceType,
      session: TAXONOMY_ID.session,
      status: "reviewing",
    });

    expect(sentQuery()).toEqual({
      sort: "newest",
      query: "past year",
      campusId: TAXONOMY_ID.campus,
      courseId: TAXONOMY_ID.course,
      resourceTypeId: TAXONOMY_ID.resourceType,
      academicSessionId: TAXONOMY_ID.session,
      status: "reviewing",
    });
  });

  test.each([
    ["newest", "newest"],
    ["highest-bounty", "highest_bounty"],
    ["ending-soon", "ending_soon"],
  ])("translates the %s URL order into %s", async (url, contract) => {
    await renderPage({ sort: url });

    expect(sentQuery()["sort"]).toBe(contract);
  });

  test("sends no status the contract cannot accept", async () => {
    await renderPage({ status: "well-funded" });

    expect(sentQuery()).not.toHaveProperty("status");
  });

  test("selects nothing itself: whatever came back is what is rendered", async () => {
    listPublicWanted.mockResolvedValue({
      ok: true,
      data: [aWanted({ id: "a", title: "Kept" }), aWanted({ id: "b", title: "Also kept" })],
    });
    await renderPage({ q: "nothing like these titles" });

    const list = screen.getByRole("list", { name: "Wanted requests" });

    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
  });
});

describe("keeping the reader's filters", () => {
  test("puts what was searched back into the search field", async () => {
    await renderPage({ q: "past year" });

    expect(screen.getByLabelText("Search Wanted requests")).toHaveValue("past year");
  });

  test("keeps the chosen sort selected", async () => {
    await renderPage({ sort: "ending-soon" });

    expect(screen.getByLabelText("Sort by")).toHaveValue("ending-soon");
  });

  test("keeps the chosen catalogue filters selected", async () => {
    await renderPage({ campus: TAXONOMY_ID.campus, status: "reviewing" });

    expect(screen.getByLabelText("Campus")).toHaveValue(TAXONOMY_ID.campus);
    expect(screen.getByLabelText("Status")).toHaveValue("reviewing");
  });

  test("reports how many filters narrow the Board", async () => {
    await renderPage({ campus: TAXONOMY_ID.campus, status: "open" });

    expect(screen.getAllByText("2 filters applied").length).toBeGreaterThan(0);
  });

  test("offers a way back to the unfiltered Board that keeps the search", async () => {
    await renderPage({ q: "notes", campus: TAXONOMY_ID.campus });

    expect(screen.getByRole("link", { name: "Clear all filters" })).toHaveAttribute(
      "href",
      "/board?q=notes",
    );
  });
});

describe("the filter catalogue", () => {
  test("offers the institution's real published options", async () => {
    await renderPage();

    expect(
      within(screen.getByLabelText("Campus")).getByRole("option", { name: "Main Campus" }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByLabelText("Course")).getByRole("option", {
        name: "CSC510 Database Systems",
      }),
    ).toBeInTheDocument();
  });

  test("offers only the two statuses the contract accepts", async () => {
    await renderPage();

    const status = screen.getByLabelText("Status");

    expect(
      within(status)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["Any status", "Open", "Under review"]);
  });

  test("still lists the Board when the catalogue cannot be read", async () => {
    loadMarketplaceTaxonomy.mockResolvedValue({ ok: false, code: "MARKETPLACE_UNAVAILABLE" });
    await renderPage();

    expect(screen.getByRole("list", { name: "Wanted requests" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Campus")).not.toBeInTheDocument();
    expect(screen.getByText(/filter lists could not be loaded/i)).toBeInTheDocument();
  });
});

describe("promising only what the server searches", () => {
  /**
   * `GET /api/marketplace/wanted` matches `query` against the request title and
   * nothing else. Offering to search a campus or a semester would promise a
   * result the operation cannot return, and re-implementing the wider search in
   * the browser would select rows the server did not.
   */
  test("asks for a title rather than a campus or a semester", async () => {
    await renderPage();

    const search = screen.getByLabelText("Search Wanted requests");

    expect(search).toHaveAttribute("placeholder", expect.stringMatching(/title/i));
    expect(search.getAttribute("placeholder")).not.toMatch(/campus|semester|resource type/i);
  });
});

describe("what the Board shows", () => {
  test("renders each request as a card with its bounty in integer sen", async () => {
    listPublicWanted.mockResolvedValue({
      ok: true,
      data: [
        aWanted({ id: "one", title: "Past year questions", grossBountySen: toSen(85) }),
        aWanted({ id: "two", title: "Worked solutions", grossBountySen: toSen(12.5) }),
      ],
    });
    await renderPage();

    expect(screen.getByRole("link", { name: "Past year questions" })).toHaveAttribute(
      "href",
      "/wanted/one",
    );
    expect(screen.getByText("Total bounty RM 85")).toBeInTheDocument();
    expect(screen.getByText("Total bounty RM 12.50")).toBeInTheDocument();
  });

  test("carries no development fixture marker", async () => {
    await renderPage();

    expect(screen.queryByText("Development only")).not.toBeInTheDocument();
  });
});

describe("an empty result", () => {
  test("says nobody has posted anything when nothing was filtered", async () => {
    listPublicWanted.mockResolvedValue({ ok: true, data: [] });
    await renderPage();

    expect(
      screen.getByRole("heading", { name: "Nothing is on the Board yet" }),
    ).toBeInTheDocument();
  });

  test("says the search hid everything when the reader searched", async () => {
    listPublicWanted.mockResolvedValue({ ok: true, data: [] });
    await renderPage({ q: "quantum" });

    expect(
      screen.getByRole("heading", { name: "No request matches this search" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Clear the search and filters/ })).toBeInTheDocument();
  });

  test("says the filters hid everything when the reader filtered", async () => {
    listPublicWanted.mockResolvedValue({ ok: true, data: [] });
    await renderPage({ campus: TAXONOMY_ID.campus });

    expect(
      screen.getByRole("heading", { name: "No request matches these filters" }),
    ).toBeInTheDocument();
  });

  test("never presents an empty filtered result as an unavailable Board", async () => {
    listPublicWanted.mockResolvedValue({ ok: true, data: [] });
    const { container } = await renderPage({ campus: TAXONOMY_ID.campus });

    expect(container.textContent).not.toMatch(/could not be loaded/i);
  });
});

describe("who may read the Board", () => {
  test("asks a signed-out visitor to sign in", async () => {
    listPublicWanted.mockResolvedValue({ ok: false, code: "AUTH_REQUIRED", message: "no" });
    await renderPage();

    expect(
      screen.getByRole("heading", { name: "Sign in to browse the Board" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
    expect(screen.queryByRole("list", { name: "Wanted requests" })).not.toBeInTheDocument();
  });

  test("sends an unverified email address to verification, not to institution verification", async () => {
    listPublicWanted.mockResolvedValue({ ok: false, code: "EMAIL_NOT_VERIFIED", message: "no" });
    await renderPage();

    expect(
      screen.getByRole("heading", { name: "Verify your email to browse the Board" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /email verification/i })).toHaveAttribute(
      "href",
      "/verify-email",
    );
    expect(screen.queryByRole("link", { name: "Verify your institution" })).not.toBeInTheDocument();
  });

  test("says the Board is unavailable without blaming the account", async () => {
    listPublicWanted.mockResolvedValue({
      ok: false,
      code: "MARKETPLACE_UNAVAILABLE",
      message: "connect ECONNREFUSED 127.0.0.1:54322",
    });
    const { container } = await renderPage();

    expect(
      screen.getByRole("heading", { name: "The Wanted Board could not be loaded" }),
    ).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/ECONNREFUSED|127\.0\.0\.1|supabase/i);
  });
});
