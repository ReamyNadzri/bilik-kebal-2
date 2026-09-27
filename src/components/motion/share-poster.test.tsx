import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { WantedDetail } from "@/contracts/marketplace";
import { toSen } from "@/features/marketplace/money";
import { aWanted } from "@/features/marketplace/test-support/wanted";
import { SharePoster } from "./share-poster";

const wanted: WantedDetail = {
  ...aWanted({ id: "11111111-1111-4111-8111-111111111111", grossBountySen: toSen(25) }),
  description: "Complete notes covering every chapter, with worked examples.",
  faculty: "Faculty of Computing",
  programme: "Bachelor of Computer Science",
  language: "English",
  tags: [],
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
  activity: [],
  similarIds: [],
};

describe("SharePoster", () => {
  it("drops the poster without any capture stamp", () => {
    render(<SharePoster wanted={wanted} onClose={() => {}} />);
    expect(screen.getByRole("dialog", { name: /Share this Wanted/ })).toBeInTheDocument();
    expect(screen.queryByText(/CAPTURED|BUSTED|SECURED|CAUGHT|BROUGHT IN/)).not.toBeInTheDocument();
    expect(document.querySelector(".capture-poster__stamp")).toBeNull();
  });

  it("focuses the first share button and closes on Escape", () => {
    const onClose = vi.fn();
    render(<SharePoster wanted={wanted} onClose={onClose} />);
    expect(screen.getByRole("button", { name: "WhatsApp" })).toHaveFocus();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("opens WhatsApp with the caption where files cannot be shared", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    render(<SharePoster wanted={wanted} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "WhatsApp" }));
    await waitFor(() => expect(open).toHaveBeenCalled());
    const url = new URL(String(open.mock.calls[0]![0]));
    expect(url.origin).toBe("https://wa.me");
    expect(url.searchParams.get("text")).toContain(`/wanted/${wanted.id}`);
    expect(screen.getByRole("status")).toHaveTextContent(/WhatsApp opened with the caption/);
    open.mockRestore();
  });
});
