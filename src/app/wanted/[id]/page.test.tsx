import { render, screen, within } from "@testing-library/react";
import WantedDetailPage from "./page";

const notFound = vi.hoisted(() => vi.fn(() => new Error("NEXT_NOT_FOUND")));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw notFound();
  },
}));

async function renderWanted(id = "csc510-final-exam-notes", params: Record<string, string> = {}) {
  return render(
    await WantedDetailPage({
      params: Promise.resolve({ id }),
      searchParams: Promise.resolve(params),
    }),
  );
}

/**
 * The case file, excluding the similar-request cards, which are articles of
 * their own and repeat the same kinds of words.
 */
function caseFile() {
  return within(
    screen.getByRole("article", { name: "Final exam notes and summary for chapters 1 to 12" }),
  );
}

function ledger() {
  return within(screen.getByRole("complementary", { name: "Bounty and actions" }));
}

describe("the request", () => {
  test("leads with the request title", async () => {
    await renderWanted();

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Final exam notes and summary for chapters 1 to 12",
      }),
    ).toBeInTheDocument();
  });

  test("shows the lifecycle status and how long it has been posted", async () => {
    await renderWanted();

    // The similar-request cards carry stamps of their own, so the request's own
    // stamp is identified by the context it names rather than by its word.
    expect(screen.getByText("This Wanted status:").parentElement).toHaveTextContent("Open");
    expect(screen.getByText("Posted 3 days ago")).toBeInTheDocument();
  });

  test("shows what the Commissioner asked for", async () => {
    await renderWanted();

    expect(screen.getByText(/Looking for complete notes or a summary/)).toBeInTheDocument();
  });

  test("lists the academic metadata a Hunter needs to judge the request", async () => {
    await renderWanted();

    const details = screen.getByRole("group", { name: "Full request details" });

    expect(within(details).getByText("CSC510 Database Systems")).toBeInTheDocument();
    expect(within(details).getByText("UiTM Shah Alam")).toBeInTheDocument();
    expect(
      within(details).getByText("Faculty of Computer and Mathematical Sciences"),
    ).toBeInTheDocument();
    expect(within(details).getByText("Bachelor of Computer Science")).toBeInTheDocument();
    expect(within(details).getByText("Semester 2, 2024/2025")).toBeInTheDocument();
    expect(within(details).getByText("Lecture notes")).toBeInTheDocument();
    expect(within(details).getByText("English")).toBeInTheDocument();
  });

  test("shows the tags the Commissioner chose", async () => {
    await renderWanted();

    const tags = screen.getByRole("list", { name: /tags/i });

    expect(within(tags).getByText("Final exam")).toBeInTheDocument();
    expect(within(tags).getByText("Summary notes")).toBeInTheDocument();
  });

  test("summarises what has happened to the bounty so far", async () => {
    await renderWanted();

    const activity = screen.getByRole("list", { name: /activity/i });

    expect(
      within(activity).getByText("Wanted published with the first contribution"),
    ).toBeInTheDocument();
    expect(within(activity).getAllByRole("listitem").length).toBeGreaterThan(1);
  });
});

describe("the bounty ledger", () => {
  test("shows the gross bounty and who is behind it", async () => {
    await renderWanted();

    expect(ledger().getByText("Total bounty RM 85")).toBeInTheDocument();
    expect(ledger().getByText("6 backers")).toBeInTheDocument();
  });

  test("shows how long is left in a form precise enough to act on", async () => {
    await renderWanted();

    expect(screen.getByText("2 days 15 hours left")).toBeInTheDocument();
  });

  test("states the contribution range", async () => {
    await renderWanted();

    expect(screen.getByText(/RM1 to RM50 per Backer/i)).toBeInTheDocument();
  });

  test("explains the fee, and that its rate was fixed at publication", async () => {
    await renderWanted();

    expect(screen.getByText(/10% platform fee/i)).toBeInTheDocument();
    expect(screen.getByText(/fixed when this Wanted was published/i)).toBeInTheDocument();
  });

  test("says the provider fee is paid on top of the contribution", async () => {
    await renderWanted();

    expect(screen.getByText(/payment provider adds its own charge/i)).toBeInTheDocument();
  });
});

describe("actions", () => {
  test("offers backing the request", async () => {
    await renderWanted();

    expect(screen.getByRole("link", { name: /^Back this Wanted/ })).toBeInTheDocument();
  });

  test("offers claiming the request", async () => {
    await renderWanted();

    expect(screen.getByRole("link", { name: /^Submit a Claim/ })).toBeInTheDocument();
  });

  test("routes a protected action to verification rather than pretending it worked", async () => {
    await renderWanted();

    expect(screen.getByRole("link", { name: /^Back this Wanted/ })).toHaveAttribute(
      "href",
      "/profile/institution-verification",
    );
  });

  test("says why the action is not available rather than disabling it silently", async () => {
    await renderWanted();

    expect(screen.getByText(/Both actions need institution verification/i)).toBeInTheDocument();
    expect(screen.getByText(/payment is disabled in this build/i)).toBeInTheDocument();
  });

  test("offers no control that downloads, pays or decides", async () => {
    await renderWanted();

    for (const control of [...screen.getAllByRole("link"), ...screen.queryAllByRole("button")]) {
      expect(control).not.toHaveAccessibleName(/download|pay|checkout|approve|reject/i);
    }
  });

  test("names no file, object key or bucket anywhere in the markup", async () => {
    const { container } = await renderWanted();

    expect(container.innerHTML).not.toMatch(
      /\.pdf|\.docx|\.pptx|object_key|objectKey|bucket|signed url|storage\//i,
    );
  });
});

describe("trust and policy", () => {
  test("presents the Commissioner without exposing anything private", async () => {
    const { container } = await renderWanted();

    expect(screen.getByText("A verified student")).toBeInTheDocument();
    expect(container.innerHTML).not.toMatch(/@|matric|student id|phone/i);
  });

  test("separates what email verification proves from what institution verification permits", async () => {
    await renderWanted();

    expect(screen.getByText(/proves control of an email address/i)).toBeInTheDocument();
    expect(
      screen.getByText(/permits funding a bounty, submitting a claim and downloading/i),
    ).toBeInTheDocument();
  });

  test("says institution verification is not a quality guarantee", async () => {
    await renderWanted();

    expect(screen.getByText(/does not guarantee the quality of any resource/i)).toBeInTheDocument();
  });

  test("says a human Sheriff decides before access or reward", async () => {
    await renderWanted();

    expect(
      caseFile().getByText(/A Sheriff must approve a claim before any resource is released/i),
    ).toBeInTheDocument();
    expect(ledger().getByText(/No automated check can approve a claim/i)).toBeInTheDocument();
  });

  test("states the content policy the request is bound by", async () => {
    await renderWanted();

    expect(screen.getByText(/only material the Hunter is allowed to share/i)).toBeInTheDocument();
  });

  test("previews no unverified file", async () => {
    await renderWanted();

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByText(/preview/i)).not.toBeInTheDocument();
  });
});

describe("similar requests", () => {
  test("suggests other requests for the same course", async () => {
    await renderWanted();

    const similar = screen.getByRole("list", { name: /similar wanted requests/i });

    expect(within(similar).getAllByRole("listitem").length).toBeGreaterThan(0);
  });

  test("links a suggestion through to its own page", async () => {
    await renderWanted();

    const similar = screen.getByRole("list", { name: /similar wanted requests/i });

    expect(
      within(similar).getByRole("link", { name: /View this Wanted: Past year questions/ }),
    ).toHaveAttribute("href", "/wanted/csc510-past-year-questions");
  });

  test("never suggests the request being read", async () => {
    await renderWanted();

    const similar = screen.getByRole("list", { name: /similar wanted requests/i });

    expect(
      within(similar).queryByText("Final exam notes and summary for chapters 1 to 12"),
    ).not.toBeInTheDocument();
  });
});

describe("states the reader can reach", () => {
  test("returns to the Board", async () => {
    await renderWanted();

    expect(screen.getByRole("link", { name: /Back to the Wanted Board/ })).toHaveAttribute(
      "href",
      "/board",
    );
  });

  test("says the request could not be read rather than showing it as missing", async () => {
    await renderWanted("csc510-final-exam-notes", { preview: "unavailable" });

    expect(
      screen.getByRole("heading", { name: "This Wanted could not be loaded" }),
    ).toBeInTheDocument();
  });

  test("treats an unknown identifier as not found, not as a failure", async () => {
    await expect(renderWanted("no-such-request")).rejects.toThrow();
    expect(notFound).toHaveBeenCalled();
  });
});

test("marks the screen as fixture-backed while Phase 3 has no operations", async () => {
  await renderWanted();

  expect(screen.getByText("Development only")).toBeInTheDocument();
});
