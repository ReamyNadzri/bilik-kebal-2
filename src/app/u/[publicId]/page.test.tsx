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

async function renderPage() {
  render(await MemberPage({ params: Promise.resolve({ publicId: ID }) }));
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
