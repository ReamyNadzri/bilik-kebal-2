import { render, screen } from "@testing-library/react";
import MemberPage from "./page";
import { aWanted } from "@/features/marketplace/test-support/wanted";

const readPublicProfile = vi.fn();
const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
vi.mock("@/modules/profiles/loaders/profile-operations", () => ({
  readPublicProfile: (id: string) => readPublicProfile(id),
}));
vi.mock("next/navigation", () => ({ notFound: () => notFound() }));

const ID = "11111111-1111-4111-8111-111111111111";

async function renderPage(search: Record<string, string> = {}) {
  render(
    await MemberPage({
      params: Promise.resolve({ publicId: ID }),
      searchParams: Promise.resolve(search),
    }),
  );
}

function aProfile(overrides: Record<string, unknown> = {}) {
  return {
    publicId: ID,
    displayName: "Aina",
    avatarUrl: null,
    bio: "Final-year CS.",
    joinedAt: "2024-03-02T02:00:00.000Z",
    institutionName: "UiTM Shah Alam",
    institutionVerified: true,
    wanted: [aWanted({ id: "w1", title: "Past year answers" })],
    ...overrides,
  };
}

test("shows the member's public card and their requests", async () => {
  readPublicProfile.mockResolvedValue({
    ok: true,
    data: {
      publicId: ID,
      displayName: "Aina",
      avatarUrl: null,
      bio: null,
      joinedAt: "2026-09-02T02:00:00.000Z",
      institutionName: "UiTM",
      institutionVerified: true,
      wanted: [aWanted({ id: "w1", title: "Past year answers" })],
    },
  });
  await renderPage();

  expect(screen.getByRole("heading", { level: 1, name: "Aina" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Past year answers" })).toBeInTheDocument();
  expect(document.body.textContent).not.toMatch(/@|evidence/i);
});

test("asks a signed-out visitor to sign in", async () => {
  readPublicProfile.mockResolvedValue({ ok: false, code: "AUTH_REQUIRED", message: "" });
  await renderPage();

  expect(screen.getByText("Sign in to view member profiles")).toBeInTheDocument();
});

test("answers an unknown member with the real not-found page", async () => {
  readPublicProfile.mockResolvedValue({ ok: false, code: "PROFILE_NOT_FOUND", message: "" });

  await expect(renderPage()).rejects.toThrow("NEXT_NOT_FOUND");
});

describe("opened from the Hunters wall", () => {
  test("offers the way back to the wall only when the reader came from it", async () => {
    readPublicProfile.mockResolvedValue({ ok: true, data: aProfile() });
    await renderPage({ from: "hunters" });

    expect(screen.getByRole("link", { name: "Back to Hunters" })).toHaveAttribute(
      "href",
      "/board?view=hunters",
    );
  });

  test("shows no back link to a reader who came from anywhere else", async () => {
    readPublicProfile.mockResolvedValue({ ok: true, data: aProfile() });
    await renderPage();

    expect(screen.queryByRole("link", { name: "Back to Hunters" })).not.toBeInTheDocument();
  });

  test("hangs a verified member's poster beside the card, keeping what the page showed", async () => {
    readPublicProfile.mockResolvedValue({ ok: true, data: aProfile() });
    await renderPage({ from: "hunters" });

    expect(document.querySelector(".missing-poster--big")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("heading", { level: 1, name: "Aina" })).toBeInTheDocument();
    expect(screen.getByText("Final-year CS.")).toBeInTheDocument();
    expect(screen.getByText("Requests")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Past year answers" })).toBeInTheDocument();
    expect(screen.getByText(/never their email address/)).toBeInTheDocument();
    expect(screen.queryByText(/Claims approved|Bounties backed/)).not.toBeInTheDocument();
  });

  test("hangs no poster for a member without a verified institution", async () => {
    readPublicProfile.mockResolvedValue({
      ok: true,
      data: aProfile({ institutionVerified: false, institutionName: null }),
    });
    await renderPage();

    expect(document.querySelector(".missing-poster")).toBeNull();
    expect(screen.getByRole("heading", { level: 1, name: "Aina" })).toBeInTheDocument();
  });
});
