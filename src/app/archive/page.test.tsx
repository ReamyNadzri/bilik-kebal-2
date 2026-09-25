import { fireEvent, render, screen } from "@testing-library/react";
import ArchivePage from "./page";
import { aWanted } from "@/features/marketplace/test-support/wanted";

const listArchivedWanted = vi.fn();
const listOwnLibrary = vi.fn();
vi.mock("@/modules/wanted/loaders/wanted-operations", () => ({
  listArchivedWanted: () => listArchivedWanted(),
  listOwnLibrary: () => listOwnLibrary(),
}));

async function renderPage() {
  render(await ArchivePage());
}

beforeEach(() => {
  listArchivedWanted.mockResolvedValue({
    ok: true,
    data: [aWanted({ id: "done-1", title: "Fulfilled notes", status: "closed" })],
  });
  listOwnLibrary.mockResolvedValue({
    ok: true,
    data: [
      {
        wanted: aWanted({ id: "mine-1", title: "Notes I backed", status: "closed" }),
        claimId: "claim-1",
        grantedAt: "2026-09-20T00:00:00.000Z",
        revoked: false,
      },
    ],
  });
});

test("lists fulfilled and resolved requests", async () => {
  await renderPage();

  expect(screen.getByRole("heading", { level: 1, name: "Archive" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Fulfilled notes" })).toBeInTheDocument();
});

test("offers a download for each resource in the viewer's library", async () => {
  await renderPage();

  fireEvent.click(screen.getByRole("tab", { name: /My library/ }));

  expect(screen.getByRole("button", { name: "Download Notes I backed" })).toBeInTheDocument();
});

test("asks a signed-out visitor to sign in", async () => {
  listArchivedWanted.mockResolvedValue({ ok: false, code: "AUTH_REQUIRED" });
  listOwnLibrary.mockResolvedValue({ ok: false, code: "AUTH_REQUIRED" });
  await renderPage();

  expect(screen.getByText("Sign in to browse the Archive")).toBeInTheDocument();
});
