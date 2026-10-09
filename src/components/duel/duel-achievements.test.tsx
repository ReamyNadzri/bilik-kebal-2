import { fireEvent, render, screen } from "@testing-library/react";
import type { DuelAchievement, DuelAchievements, DuelTopic } from "@/contracts/duel";
import { DuelAchievementsSection, badgeSrc } from "./duel-achievements";

function achievement(overrides: Partial<DuelAchievement>): DuelAchievement {
  return {
    id: "first_blood",
    number: 1,
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

const topic = (overrides: Partial<DuelTopic>): DuelTopic => ({
  category: "Showdowns",
  total: 2,
  done: 0,
  claimed: false,
  expiresAt: null,
  ...overrides,
});

const month: DuelAchievements = {
  month: "2026-10",
  resetsAt: "2026-10-31T16:00:00.000Z",
  rewardEligible: true,
  topicCredits: 2,
  items: [
    achievement({ progress: 1, done: true }),
    achievement({ id: "duels_10", number: 2, title: "Saddle Up", target: 10, progress: 4 }),
    achievement({
      id: "streak_3",
      number: 20,
      category: "Streaks",
      title: "Hot Hand",
      target: 3,
      progress: 3,
      done: true,
    }),
  ],
  topics: [topic({ done: 1 }), topic({ category: "Streaks", total: 1, done: 1 })],
};

function renderSection(overrides: Partial<Parameters<typeof DuelAchievementsSection>[0]> = {}) {
  const onClaim = vi.fn();
  const view = render(
    <DuelAchievementsSection
      achievements={month}
      claiming={null}
      message={null}
      onClaim={onClaim}
      {...overrides}
    />,
  );
  return { onClaim, container: view.container };
}

describe("DuelAchievementsSection", () => {
  it("names the month, the count done and when it resets", () => {
    renderSection();
    expect(
      screen.getByRole("heading", { name: "Achievements · October 2026" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/2 of 3 done · resets 1 November/)).toBeInTheDocument();
  });

  it("groups achievements by topic with how many are done", () => {
    renderSection();
    expect(screen.getByRole("heading", { name: "SHOWDOWNS · 1/2" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "STREAKS · 1/1" })).toBeInTheDocument();
    expect(screen.getByText("4/10")).toBeInTheDocument();
  });

  it("shows each badge in colour once earned and grey until then", () => {
    const { container } = renderSection();
    const badges = [...container.querySelectorAll("img.duel-ach__badge")];
    expect(badges.map((img) => img.getAttribute("src"))).toEqual([
      badgeSrc(1),
      badgeSrc(2),
      badgeSrc(20),
    ]);
    expect(badges[0]).not.toHaveClass("duel-ach__badge--locked");
    expect(badges[1]).toHaveClass("duel-ach__badge--locked");
    expect(badgeSrc(20)).toBe("/duel/badges/20.webp");
  });

  it("offers the free requests only for a finished topic", () => {
    const { onClaim } = renderSection();
    expect(screen.getByText("Finish all 2 for 2 free requests")).toBeInTheDocument();
    const claims = screen.getAllByRole("button", { name: /Claim 2 free requests/ });
    expect(claims).toHaveLength(1);
    fireEvent.click(claims[0]!);
    expect(onClaim).toHaveBeenCalledWith("Streaks");
  });

  it("says when a topic was claimed and when its free requests expire", () => {
    renderSection({
      achievements: {
        ...month,
        topics: [
          month.topics[0]!,
          topic({
            category: "Streaks",
            total: 1,
            done: 1,
            claimed: true,
            expiresAt: "2026-11-09T04:00:00.000Z",
          }),
        ],
      },
    });
    expect(screen.getByText("2 free requests claimed · expire 9 November")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Claim 2 free requests/ })).not.toBeInTheDocument();
  });

  it("sends a member who is not institution verified to verification instead", () => {
    renderSection({ achievements: { ...month, rewardEligible: false } });
    expect(screen.queryByRole("button", { name: /Claim 2 free requests/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Verify your institution" })).toHaveAttribute(
      "href",
      "/profile/institution-verification",
    );
  });

  it("announces the answer to a claim", () => {
    renderSection({
      message: { ok: false, text: "Finish every achievement in this topic first." },
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Finish every achievement");
  });
});
