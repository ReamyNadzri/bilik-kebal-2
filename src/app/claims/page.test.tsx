import { render, screen, within } from "@testing-library/react";
import ClaimsPage from "./page";

async function renderClaims(params: Record<string, string> = {}) {
  return render(await ClaimsPage({ searchParams: Promise.resolve(params) }));
}

describe("Hunt workspace", () => {
  test("leads with open hunts and a separate claim ledger", async () => {
    await renderClaims();

    expect(screen.getByRole("heading", { level: 1, name: "Hunt" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Skip to a Hunt section" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Open hunts" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "My claims" })).toBeInTheDocument();
  });

  test("marks the screen as fixture-backed", async () => {
    await renderClaims();

    expect(screen.getByRole("note")).toHaveTextContent(/development fixture data/i);
  });

  test("shows useful hunt metadata and links to the Wanted", async () => {
    await renderClaims();
    const hunts = screen.getByRole("list", { name: "Open hunt opportunities" });
    const first = within(hunts).getAllByRole("listitem")[0]!;

    expect(first).toHaveTextContent("CSC584");
    expect(first).toHaveTextContent("Study pack");
    expect(first).toHaveTextContent("RM 60");
    expect(first).toHaveTextContent(/closes in/i);
    expect(first).toHaveTextContent(/claims competing/i);
    expect(first).toHaveTextContent(/institution verified/i);
    expect(within(first).getByRole("link", { name: /view hunt/i })).toHaveAttribute(
      "href",
      "/wanted/csc584-tutorial-solutions",
    );
  });

  test("renders all eight claim states in plain language", async () => {
    await renderClaims();
    const claims = screen.getByRole("list", { name: "My claim history" });

    for (const label of [
      "Draft",
      "Screening",
      "Needs information",
      "Under Sheriff review",
      "Not selected",
      "Approved",
      "Rejected",
      "Quarantined",
    ]) {
      expect(within(claims).getByText(label)).toBeInTheDocument();
    }
  });

  test("explains that not selected is valid while rejected is a policy outcome", async () => {
    await renderClaims();
    const claims = screen.getByRole("list", { name: "My claim history" });

    expect(
      within(claims).getByText(/your claim was valid.*another claim was chosen/i),
    ).toBeVisible();
    expect(within(claims).getByText(/did not meet the content policy/i)).toBeVisible();
  });

  test("does not pretend a fixture can submit or upload", async () => {
    await renderClaims();

    expect(screen.queryByRole("button", { name: /submit|upload/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/choose file|upload/i)).not.toBeInTheDocument();
  });
});

describe("Hunt read states", () => {
  test("distinguishes a genuinely empty workspace", async () => {
    await renderClaims({ preview: "empty" });

    expect(screen.getByRole("heading", { name: "No open hunts right now" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse the Wanted Board" })).toHaveAttribute(
      "href",
      "/board",
    );
    expect(screen.getByRole("heading", { name: "You have no claims yet" })).toBeInTheDocument();
  });

  test("reports an unavailable read without calling it empty", async () => {
    await renderClaims({ preview: "unavailable" });

    expect(screen.getByRole("heading", { name: "Hunt could not be loaded" })).toBeInTheDocument();
    expect(screen.queryByText(/no open hunts right now/i)).not.toBeInTheDocument();
  });
});

describe("presentation the direction requires", () => {
  test("marks neither section as selected, because both are on the page", async () => {
    await renderClaims();

    const jump = screen.getByRole("navigation", { name: "Skip to a Hunt section" });

    for (const link of within(jump).getAllByRole("link")) {
      expect(link).not.toHaveAttribute("aria-current");
    }
  });

  test("names each claim link by the request it opens", async () => {
    await renderClaims();

    const claims = screen.getByRole("list", { name: "My claim history" });

    expect(
      within(claims).getByRole("link", {
        name: "View Wanted: Final exam notes and summary for chapters 1 to 12",
      }),
    ).toBeInTheDocument();
  });

  test("states each hunt's eligibility requirement in words", async () => {
    await renderClaims();

    const hunts = screen.getByRole("list", { name: "Open hunt opportunities" });
    const first = within(hunts).getAllByRole("listitem")[0]!;
    const facts = within(first).getByRole("group", { name: "Hunt details" });

    expect(within(facts).getByText("Eligibility")).toBeInTheDocument();
    expect(within(facts).getByText("Institution verified students")).toBeInTheDocument();
  });

  test("shows how many claims a Hunter would be competing with", async () => {
    await renderClaims();

    const hunts = screen.getByRole("list", { name: "Open hunt opportunities" });
    const first = within(hunts).getAllByRole("listitem")[0]!;

    expect(within(first).getByText("3 active claims competing")).toBeInTheDocument();
  });

  test("leaves the empty claim ledger pointing at the Board", async () => {
    await renderClaims({ preview: "empty" });

    expect(screen.getByRole("link", { name: "Browse the Wanted Board" })).toHaveAttribute(
      "href",
      "/board",
    );
  });

  test("describes a draft as unsubmitted rather than inventing a date", async () => {
    await renderClaims();

    const claims = screen.getByRole("list", { name: "My claim history" });

    expect(within(claims).getByText("Not submitted")).toBeInTheDocument();
  });
});
