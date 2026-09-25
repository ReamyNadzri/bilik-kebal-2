import { render, screen, within } from "@testing-library/react";
import WantedDetailPage from "./page";
import type { WantedDetail } from "@/contracts/marketplace";
import { toSen } from "@/features/marketplace/money";
import { aWanted } from "@/features/marketplace/test-support/wanted";

const listPublicWanted = vi.hoisted(() => vi.fn());
const readPublicWanted = vi.hoisted(() => vi.fn());
const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
);

vi.mock("@/modules/wanted/loaders/wanted-operations", () => ({
  listPublicWanted,
  readPublicWanted,
}));

vi.mock("next/navigation", () => ({ notFound }));

function aDetail(overrides: Partial<WantedDetail> = {}): WantedDetail {
  return {
    ...aWanted({ id: "csc510-final-exam-notes", grossBountySen: toSen(85), backerCount: 6 }),
    description: "Complete notes covering every chapter, with worked examples.",
    faculty: "Faculty of Computing",
    programme: "Bachelor of Computer Science",
    language: "English",
    tags: ["Final exam", "Summary notes"],
    commissioner: {
      publicId: null,
      avatarUrl: null,
      joinedAt: null,
      displayName: "A classmate",
      emailVerified: true,
      institutionVerified: true,
    },
    feeRateBasisPoints: 1000,
    policyVersion: "2026-09-15.1",
    activity: [{ id: "event-1", at: "2026-09-12T09:00:00.000Z", summary: "Request published" }],
    similarIds: [],
    ...overrides,
  };
}

beforeEach(() => {
  readPublicWanted.mockReset().mockResolvedValue({ ok: true, data: aDetail() });
  notFound.mockClear();
});

async function renderPage(id = "csc510-final-exam-notes") {
  return render(await WantedDetailPage({ params: Promise.resolve({ id }) }));
}

describe("reading one request", () => {
  test("names who posted it with their joined date and a link to their profile", async () => {
    readPublicWanted.mockResolvedValue({
      ok: true,
      data: aDetail({
        commissioner: {
          publicId: "11111111-1111-4111-8111-111111111111",
          avatarUrl: null,
          joinedAt: "2026-09-02T02:00:00.000Z",
          displayName: "Aina",
          emailVerified: true,
          institutionVerified: true,
        },
      }),
    });
    await renderPage();

    expect(screen.getByRole("link", { name: "Aina" })).toHaveAttribute(
      "href",
      "/u/11111111-1111-4111-8111-111111111111",
    );
    expect(screen.getByText("September 2026")).toBeInTheDocument();
  });

  test("offers no way to add money to a free request", async () => {
    readPublicWanted.mockResolvedValue({ ok: true, data: aDetail({ isFree: true }) });
    await renderPage();

    expect(screen.queryByRole("link", { name: "Back this Wanted" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Back this Wanted" })).toBeNull();
    expect(screen.getAllByText("Free request").length).toBeGreaterThan(0);
  });

  test("asks by the opaque public identifier from the address", async () => {
    await renderPage("csc510-final-exam-notes");

    expect(readPublicWanted).toHaveBeenCalledWith("csc510-final-exam-notes");
  });

  test("shows the request, its course and its description", async () => {
    await renderPage();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Final exam notes and summary for chapters 1 to 12",
    );
    expect(screen.getByText(/Complete notes covering every chapter/)).toBeInTheDocument();
  });

  test("renders the bounty from integer sen and the backer count", async () => {
    await renderPage();

    expect(screen.getByText("Total bounty RM 85.00")).toBeInTheDocument();
    expect(screen.getByText("6 backers")).toBeInTheDocument();
  });

  test("keeps sen precision for a part-Ringgit bounty", async () => {
    readPublicWanted.mockResolvedValue({
      ok: true,
      data: aDetail({ grossBountySen: toSen(12.5) }),
    });
    await renderPage();

    expect(screen.getByText("Total bounty RM 12.50")).toBeInTheDocument();
  });

  test("shows the snapshotted fee rate and policy version", async () => {
    readPublicWanted.mockResolvedValue({
      ok: true,
      data: aDetail({ feeRateBasisPoints: 750, policyVersion: "2026-09-15.1" }),
    });
    await renderPage();

    expect(screen.getByText(/7\.5% platform fee/)).toBeInTheDocument();
    expect(screen.getByText(/2026-09-15\.1/)).toBeInTheDocument();
  });

  test("shows the publication and closing times", async () => {
    await renderPage();

    expect(document.querySelector('time[datetime="2026-09-11T09:00:00.000Z"]')).not.toBeNull();
    expect(document.querySelector('time[datetime="2026-09-17T00:00:00.000Z"]')).not.toBeNull();
  });

  test("lists the public activity", async () => {
    await renderPage();

    const activity = screen.getByRole("list", { name: "Activity on this Wanted" });

    expect(within(activity).getByText("Request published")).toBeInTheDocument();
  });

  test("lists the tags", async () => {
    await renderPage();

    const tags = screen.getByRole("list", { name: "Tags" });

    expect(within(tags).getByText("Final exam")).toBeInTheDocument();
    expect(within(tags).getByText("Summary notes")).toBeInTheDocument();
  });

  test("carries no development fixture marker", async () => {
    await renderPage();

    expect(screen.queryByText("Development only")).not.toBeInTheDocument();
  });
});

describe("the Commissioner as the reader sees them", () => {
  test("shows only the safe display name", async () => {
    await renderPage();

    expect(screen.getByText("A classmate")).toBeInTheDocument();
  });

  test("keeps the two trust states separate rather than merging them", async () => {
    readPublicWanted.mockResolvedValue({
      ok: true,
      data: aDetail({
        commissioner: {
          publicId: null,
          avatarUrl: null,
          joinedAt: null,
          displayName: "A classmate",
          emailVerified: true,
          institutionVerified: false,
        },
      }),
    });
    await renderPage();

    expect(screen.getByText(/This proves control of an email/)).toBeInTheDocument();
    expect(screen.getByText(/This permits funding a/)).toBeInTheDocument();
  });

  test("exposes no email address, contributor identity or internal row identifier", async () => {
    const { container } = await renderPage();
    const shown = container.textContent ?? "";

    expect(shown).not.toMatch(/@/);
    expect(shown).not.toMatch(/user_id|commissioner_user_id|institution_id|storage|bucket/i);
    expect(shown).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });
});

describe("the requests suggested beside it", () => {
  test("shows nothing when the operation supplied no identifiers", async () => {
    await renderPage();

    expect(screen.queryByRole("list", { name: /similar/i })).not.toBeInTheDocument();
  });

  test("links each supplied identifier to its own request", async () => {
    readPublicWanted.mockImplementation(async (id: string) =>
      id === "csc510-final-exam-notes"
        ? { ok: true, data: aDetail({ similarIds: ["csc510-past-year"] }) }
        : { ok: true, data: aDetail({ id, title: "Past year questions" }) },
    );
    await renderPage();

    expect(screen.getByRole("link", { name: "Past year questions" })).toHaveAttribute(
      "href",
      "/wanted/csc510-past-year",
    );
  });
});

describe("a request that is not there", () => {
  test("renders the real not-found page rather than an offline error", async () => {
    readPublicWanted.mockResolvedValue({ ok: false, code: "WANTED_NOT_FOUND", message: "no" });

    await expect(renderPage("never-existed")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });
});

describe("when the request cannot be read", () => {
  test("says so without blaming the account, and does not call not-found", async () => {
    readPublicWanted.mockResolvedValue({
      ok: false,
      code: "MARKETPLACE_UNAVAILABLE",
      message: "connect ECONNREFUSED 127.0.0.1:54322",
    });
    const { container } = await renderPage();

    expect(
      screen.getByRole("heading", { name: "This Wanted could not be loaded" }),
    ).toBeInTheDocument();
    expect(notFound).not.toHaveBeenCalled();
    expect(container.textContent).not.toMatch(/ECONNREFUSED|127\.0\.0\.1|supabase/i);
  });

  test("asks a signed-out visitor to sign in", async () => {
    readPublicWanted.mockResolvedValue({ ok: false, code: "AUTH_REQUIRED", message: "no" });
    await renderPage();

    expect(
      screen.getByRole("heading", { name: "Sign in to read this request" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
  });

  test("sends an unverified email address to verification", async () => {
    readPublicWanted.mockResolvedValue({ ok: false, code: "EMAIL_NOT_VERIFIED", message: "no" });
    await renderPage();

    expect(
      screen.getByRole("heading", { name: "Verify your email to read this request" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /email verification/i })).toHaveAttribute(
      "href",
      "/verify-email",
    );
  });
});

test("claims no payment, entitlement or file access", async () => {
  const { container } = await renderPage();
  const shown = container.textContent ?? "";

  expect(shown).not.toMatch(/successfully|payment (received|complete|confirmed)/i);
  expect(shown).not.toMatch(/download now|your file is|you now have access/i);
});
