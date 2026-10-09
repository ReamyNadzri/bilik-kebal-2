import { fireEvent, render, screen } from "@testing-library/react";
import type { DuelLobby as DuelLobbyData } from "@/contracts/duel";
import { DuelLobby, type DuelLobbyProps } from "./duel-lobby";

const ghost = {
  publicId: "11111111-1111-4111-8111-111111111111",
  displayName: "Haziq Firdaus",
  avatarUrl: null,
  institutionName: "UMPSA Pekan",
  averageMs: 251,
  bestMs: 214,
  wins: 1,
  losses: 2,
  draws: 0,
};

const lobby: DuelLobbyData = {
  record: {
    kills: 5,
    deaths: 2,
    draws: 1,
    bestMs: 231,
    averageMs: 288,
    shots: 12,
    listed: true,
    history: [
      {
        opponentName: "Haziq Firdaus",
        opponentPublicId: ghost.publicId,
        outcome: "lose",
        youMs: null,
        themMs: 244,
        fouls: 2,
        at: "2026-10-09T07:00:00Z",
      },
    ],
    practice: { hard: { tries: 5, hits: 2, bestMs: 301, averageMs: 362 } },
  },
  opponents: [ghost],
  achievements: {
    month: "2026-10",
    resetsAt: "2026-10-31T16:00:00.000Z",
    rewardEligible: true,
    topicCredits: 2,
    items: [],
    topics: [],
  },
};

function renderLobby(overrides: Partial<DuelLobbyProps> = {}) {
  const props: DuelLobbyProps = {
    lobby,
    playerName: "Arif Rahman",
    playerPicture: null,
    notice: null,
    busy: false,
    onDuel: vi.fn(),
    onPractice: vi.fn(),
    onListing: vi.fn(),
    onReset: vi.fn(),
    ...overrides,
  };
  render(<DuelLobby {...props} />);
  return props;
}

describe("DuelLobby", () => {
  it("shows the member's record in words", () => {
    renderLobby();
    expect(screen.getByRole("heading", { name: "Duel", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("2.50")).toBeInTheDocument();
    expect(screen.getByText("71%")).toBeInTheDocument();
    expect(screen.getByText("231 ms")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText(/Lost/)).toBeInTheDocument();
    expect(screen.getByText("Too early")).toBeInTheDocument();
  });

  it("lists each ghost with their real numbers and the member's record against them", () => {
    const props = renderLobby();
    expect(screen.getByText("Avg draw 251 ms · best 214 ms")).toBeInTheDocument();
    expect(screen.getByText("DEADEYE", { selector: ".duel-rank" })).toBeInTheDocument();
    expect(screen.getByText("1W – 2L")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Duel Haziq Firdaus" }));
    expect(props.onDuel).toHaveBeenCalledWith(ghost);
  });

  it("starts practice on a level and shows its results", () => {
    const props = renderLobby();
    const hard = screen.getByRole("button", { name: /Practice Hard: beat 350 ms/ });
    expect(hard).toHaveTextContent("2/5 hits · best 301 ms");
    fireEvent.click(hard);
    expect(props.onPractice).toHaveBeenCalledWith("hard");
  });

  it("explains an empty opponent list", () => {
    renderLobby({ lobby: { ...lobby, opponents: [] } });
    expect(screen.getByText(/No ghosts to duel yet/)).toBeInTheDocument();
  });

  it("lets the member hide their ghost, and says where it stands", () => {
    const props = renderLobby();
    expect(screen.getByText(/Your ghost is on the board/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Let other hunters duel my ghost" }));
    expect(props.onListing).toHaveBeenCalledWith(false);
  });

  it("counts the shots a new ghost still needs", () => {
    renderLobby({ lobby: { ...lobby, record: { ...lobby.record, shots: 3 } } });
    expect(screen.getByText(/after 5 clean shots \(3 of 5 so far\)/)).toBeInTheDocument();
  });

  it("asks before resetting the record", () => {
    const props = renderLobby();
    fireEvent.click(screen.getByRole("button", { name: "Reset record" }));
    expect(props.onReset).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Yes, reset my record" }));
    expect(props.onReset).toHaveBeenCalledTimes(1);
  });

  it("announces a refusal", () => {
    renderLobby({ notice: "That hunter can no longer be challenged. Pick another opponent." });
    expect(screen.getByRole("alert")).toHaveTextContent("can no longer be challenged");
  });

  it("holds every action while a change is saving", () => {
    renderLobby({ busy: true });
    expect(screen.getByRole("button", { name: "Duel Haziq Firdaus" })).toBeDisabled();
    expect(screen.getByRole("checkbox")).toBeDisabled();
  });
});
