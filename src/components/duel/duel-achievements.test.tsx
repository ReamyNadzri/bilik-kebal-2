import { fireEvent, render, screen } from "@testing-library/react";
import type { DuelAchievement, DuelAchievements } from "@/contracts/duel";
import { DuelAchievementsSection } from "./duel-achievements";

function achievement(overrides: Partial<DuelAchievement>): DuelAchievement {
  return {
    id: "first_blood",
    category: "Showdowns",
    title: "First Blood",
    description: "Win a duel.",
    target: 1,
    progress: 0,
    done: false,
    grantsFreeRequest: false,
    claimed: false,
    ...overrides,
  };
}

const month: DuelAchievements = {
  month: "2026-10",
  resetsAt: "2026-10-31T16:00:00.000Z",
  rewardEligible: true,
  items: [
    achievement({ progress: 1, done: true }),
    achievement({
      id: "wins_30",
      title: "Legend of the West",
      description: "Win 30 duels.",
      target: 30,
      progress: 30,
      done: true,
      grantsFreeRequest: true,
    }),
    achievement({
      id: "beaten_10",
      category: "Rivals",
      title: "Town Tamer",
      description: "Beat 10 different hunters.",
      target: 10,
      progress: 4,
      grantsFreeRequest: true,
    }),
  ],
};

function renderSection(overrides: Partial<Parameters<typeof DuelAchievementsSection>[0]> = {}) {
  const onClaim = vi.fn();
  render(
    <DuelAchievementsSection
      achievements={month}
      claiming={null}
      message={null}
      onClaim={onClaim}
      {...overrides}
    />,
  );
  return onClaim;
}

describe("DuelAchievementsSection", () => {
  it("names the month, the count done and when it resets", () => {
    renderSection();
    expect(
      screen.getByRole("heading", { name: "Achievements · October 2026" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/2 of 3 done · resets 1 November/)).toBeInTheDocument();
  });

  it("groups achievements by kind and shows progress in numbers", () => {
    renderSection();
    expect(screen.getByRole("heading", { name: "SHOWDOWNS" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "RIVALS" })).toBeInTheDocument();
    expect(screen.getByText("4/10")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Town Tamer progress" })).toHaveAttribute(
      "value",
      "4",
    );
  });

  it("offers the free request only for a finished reward achievement", () => {
    const onClaim = renderSection();
    const claims = screen.getAllByRole("button", { name: /Claim the free request/ });
    expect(claims).toHaveLength(1);
    fireEvent.click(claims[0]!);
    expect(onClaim).toHaveBeenCalledWith("wins_30");
  });

  it("says when the free request was already claimed", () => {
    renderSection({
      achievements: {
        ...month,
        items: month.items.map((item) =>
          item.id === "wins_30" ? { ...item, claimed: true } : item,
        ),
      },
    });
    expect(screen.getByText("Free request claimed")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Claim the free request/ }),
    ).not.toBeInTheDocument();
  });

  it("sends a member who is not institution verified to verification instead", () => {
    renderSection({ achievements: { ...month, rewardEligible: false } });
    expect(
      screen.queryByRole("button", { name: /Claim the free request/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Verify your institution" })).toHaveAttribute(
      "href",
      "/profile/institution-verification",
    );
  });

  it("announces the answer to a claim", () => {
    renderSection({ message: { ok: false, text: "Finish this achievement first." } });
    expect(screen.getByRole("alert")).toHaveTextContent("Finish this achievement first.");
  });
});
