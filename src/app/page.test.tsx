import { render, screen, within } from "@testing-library/react";
import HomePage from "./page";
import { aWanted } from "@/features/marketplace/test-support/wanted";
import { toSen } from "@/features/marketplace/money";

const listPublicWanted = vi.hoisted(() => vi.fn());
const readPublicWanted = vi.hoisted(() => vi.fn());

vi.mock("@/modules/wanted/loaders/wanted-operations", () => ({
  listPublicWanted,
  readPublicWanted,
}));

beforeEach(() => {
  listPublicWanted.mockReset().mockResolvedValue({ ok: true, data: [aWanted()] });
});

function refused(code: string) {
  listPublicWanted.mockResolvedValue({ ok: false, code, message: "server wording" });
}

async function renderPage() {
  return render(await HomePage());
}

describe("what the homepage always says", () => {
  test("leads with the proposition rather than a sign-in wall", async () => {
    refused("AUTH_REQUIRED");
    await renderPage();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Ask for it. Back it. Claim it.",
    );
    expect(screen.getByRole("list", { name: "How the hunt works" })).toBeInTheDocument();
  });

  test("explains what each verification unlocks, keeping the two states separate", async () => {
    await renderPage();

    expect(screen.getByText("Email verified")).toBeInTheDocument();
    expect(screen.getByText("Institution verified")).toBeInTheDocument();
    expect(screen.getByText(/Verify your email to browse the Board/i)).toBeInTheDocument();
    expect(screen.getByText(/fund a bounty, claim a request or download/i)).toBeInTheDocument();
  });

  test("carries no development fixture marker", async () => {
    await renderPage();

    expect(screen.queryByText("Development only")).not.toBeInTheDocument();
  });
});

describe("a populated marketplace", () => {
  test("shows the newest open requests from the real operation", async () => {
    listPublicWanted.mockResolvedValue({
      ok: true,
      data: [
        aWanted({ id: "one", title: "Past year questions" }),
        aWanted({ id: "two", title: "Worked solutions" }),
      ],
    });
    await renderPage();

    const list = screen.getByRole("list", { name: "Open Wanted requests" });

    expect(within(list).getByRole("link", { name: "Past year questions" })).toHaveAttribute(
      "href",
      "/wanted/one",
    );
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
  });

  test("asks the operation for the newest first", async () => {
    await renderPage();

    expect(listPublicWanted).toHaveBeenCalledWith({ sort: "newest" });
  });

  test("renders the bounty from integer sen through the money formatter", async () => {
    listPublicWanted.mockResolvedValue({
      ok: true,
      data: [aWanted({ grossBountySen: toSen(12.5) })],
    });
    await renderPage();

    expect(screen.getByText(/Total bounty RM 12\.50/)).toBeInTheDocument();
  });

  test("offers the way through to the whole Board", async () => {
    await renderPage();

    expect(screen.getByRole("link", { name: /See every open Wanted/ })).toHaveAttribute(
      "href",
      "/board",
    );
  });
});

describe("a successful but empty marketplace", () => {
  test("says nobody has asked for anything yet, and invites the first request", async () => {
    listPublicWanted.mockResolvedValue({ ok: true, data: [] });
    await renderPage();

    expect(screen.getByRole("heading", { name: "No open requests yet" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Post a Wanted" }).length).toBeGreaterThan(0);
  });

  test("does not present an empty marketplace as a failure", async () => {
    listPublicWanted.mockResolvedValue({ ok: true, data: [] });
    const { container } = await renderPage();

    expect(container.textContent).not.toMatch(/could not be loaded|try again/i);
  });
});

describe("a viewer who is not signed in", () => {
  test("is asked to sign in to see what is open", async () => {
    refused("AUTH_REQUIRED");
    await renderPage();

    expect(
      screen.getByRole("heading", { name: "Sign in to see open requests" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
  });

  test("still sees the marketplace explained, because browsing is the invitation", async () => {
    refused("AUTH_REQUIRED");
    await renderPage();

    expect(screen.getByRole("heading", { name: "How the hunt works" })).toBeInTheDocument();
  });
});

describe("a viewer whose email is not verified", () => {
  test("is sent to email verification rather than told to sign in again", async () => {
    refused("EMAIL_NOT_VERIFIED");
    await renderPage();

    expect(
      screen.getByRole("heading", { name: "Verify your email to browse" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /email verification/i })).toHaveAttribute(
      "href",
      "/verify-email",
    );
  });

  test("is not told to verify an institution it does not need to browse", async () => {
    refused("EMAIL_NOT_VERIFIED");
    await renderPage();

    expect(screen.queryByRole("link", { name: "Verify your institution" })).not.toBeInTheDocument();
  });
});

describe("when the marketplace cannot be read", () => {
  test("says so without blaming the account", async () => {
    refused("MARKETPLACE_UNAVAILABLE");
    await renderPage();

    expect(
      screen.getByRole("heading", { name: "Open requests could not be loaded" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/not a problem with your account/i)).toBeInTheDocument();
  });

  test("says so when the read itself throws", async () => {
    listPublicWanted.mockRejectedValue(new Error("connect ECONNREFUSED 127.0.0.1:54322"));
    await renderPage();

    expect(
      screen.getByRole("heading", { name: "Open requests could not be loaded" }),
    ).toBeInTheDocument();
  });

  test("leaks no server detail to the reader", async () => {
    listPublicWanted.mockRejectedValue(new Error("connect ECONNREFUSED 127.0.0.1:54322"));
    const { container } = await renderPage();

    expect(container.textContent).not.toMatch(/ECONNREFUSED|127\.0\.0\.1|supabase|service_role/i);
  });
});

test("claims no payment, entitlement or file access", async () => {
  const { container } = await renderPage();

  expect(container.textContent).not.toMatch(/successfully|payment (received|complete|confirmed)/i);
  expect(container.textContent).not.toMatch(/download now|your file is|you now have access/i);
});
