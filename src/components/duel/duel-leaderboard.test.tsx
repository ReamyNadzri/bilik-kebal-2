import { render, screen, within } from "@testing-library/react";
import { DuelLeaderboard } from "./duel-leaderboard";

const leader = (name: string, kills: number, deaths: number) => ({
  publicId: `00000000-0000-4000-8000-0000000000${kills}`,
  displayName: name,
  avatarUrl: null,
  kills,
  deaths,
  draws: 0,
});

describe("DuelLeaderboard", () => {
  it("lists the top three in order with their K/D", () => {
    render(
      <DuelLeaderboard
        result={{
          ok: true,
          data: [leader("Haziq", 31, 1), leader("Sofea", 20, 4), leader("Aisyah", 10, 2)],
        }}
      />,
    );
    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("1st");
    expect(items[0]).toHaveTextContent("Haziq");
    expect(items[0]).toHaveTextContent("31.00");
    expect(items[2]).toHaveTextContent("3rd");
    expect(screen.getByRole("link", { name: "Sofea" })).toHaveAttribute(
      "href",
      "/u/00000000-0000-4000-8000-000000000020",
    );
  });

  it("says the top spot is open before anyone has 10 duels", () => {
    render(<DuelLeaderboard result={{ ok: true, data: [] }} />);
    expect(screen.getByText(/No hunter has 10 duels yet/)).toBeInTheDocument();
  });

  it("asks a visitor to sign in", () => {
    render(
      <DuelLeaderboard
        result={{ ok: false, code: "AUTH_REQUIRED", message: "Sign in to duel." }}
      />,
    );
    expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument();
  });
});
