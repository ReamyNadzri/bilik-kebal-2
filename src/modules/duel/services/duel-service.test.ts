import type { DuelAchievements, DuelRecord, DuelRoomState } from "@/contracts/duel";
import { DuelService, type DuelRepository } from "./duel-service";

const actor = { userId: "00000000-0000-4000-8000-000000000002", emailVerified: true };
const roundId = "33333333-3333-4333-8333-333333333333";
const opponentPublicId = "44444444-4444-4444-8444-444444444444";

const emptyRecord: DuelRecord = {
  kills: 0,
  deaths: 0,
  draws: 0,
  bestMs: null,
  averageMs: null,
  shots: 0,
  listed: true,
  history: [],
  practice: {},
};

const achievements: DuelAchievements = {
  month: "2026-10",
  resetsAt: "2026-10-31T16:00:00.000Z",
  rewardEligible: true,
  topicCredits: 2,
  items: [],
  topics: [],
};

const roomState: DuelRoomState = {
  roomId: "55555555-5555-4555-8555-555555555555",
  code: "ABC234",
  status: "open",
  role: "host",
  opponent: null,
  duelNo: 0,
  round: null,
  result: null,
  rematch: { you: false, them: false },
  serverNow: 1,
};

function repository(overrides: Partial<DuelRepository> = {}): DuelRepository {
  return {
    record: vi.fn().mockResolvedValue(emptyRecord),
    opponents: vi.fn().mockResolvedValue([]),
    startDuel: vi.fn().mockResolvedValue({ roundId, opponentMs: 300 }),
    finishDuel: vi.fn().mockResolvedValue({
      outcome: "win",
      youMs: 250,
      themMs: 300,
      fouls: 0,
      kills: 1,
      deaths: 0,
      draws: 0,
    }),
    recordPractice: vi.fn().mockResolvedValue({ hit: true, targetMs: 350, youMs: 300 }),
    setListing: vi.fn().mockImplementation((listed: boolean) => Promise.resolve(listed)),
    reset: vi.fn().mockResolvedValue(undefined),
    achievements: vi.fn().mockResolvedValue(achievements),
    claimTopic: vi.fn().mockResolvedValue("claimed"),
    openRoom: vi.fn().mockResolvedValue(roomState),
    openRooms: vi.fn().mockResolvedValue([]),
    joinRoom: vi.fn().mockResolvedValue(roomState),
    roomState: vi.fn().mockResolvedValue(roomState),
    roomShot: vi.fn().mockResolvedValue(roomState),
    rematchRoom: vi.fn().mockResolvedValue(roomState),
    leaveRoom: vi.fn().mockResolvedValue(undefined),
    leaderboard: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

const databaseError = (message: string) => Object.assign(new Error(message), { message });

describe("DuelService guards", () => {
  it("refuses a visitor and an unverified email before the database", async () => {
    const repo = repository();
    const service = new DuelService(repo);
    await expect(service.lobby(null)).resolves.toMatchObject({ code: "AUTH_REQUIRED" });
    await expect(
      service.start({ ...actor, emailVerified: false }, { opponentPublicId }),
    ).resolves.toMatchObject({ code: "EMAIL_NOT_VERIFIED" });
    expect(repo.record).not.toHaveBeenCalled();
    expect(repo.startDuel).not.toHaveBeenCalled();
  });
});

describe("DuelService.lobby", () => {
  it("reads the record and the opponents together", async () => {
    const repo = repository();
    await expect(new DuelService(repo).lobby(actor)).resolves.toEqual({
      ok: true,
      data: { record: emptyRecord, opponents: [], achievements },
    });
  });

  it("never passes database wording to the browser", async () => {
    const service = new DuelService(
      repository({
        opponents: vi.fn().mockRejectedValue(databaseError("relation does not exist")),
      }),
    );
    const result = await service.lobby(actor);
    expect(result).toMatchObject({ code: "DUEL_UNAVAILABLE" });
    expect(JSON.stringify(result)).not.toContain("relation");
  });
});

describe("DuelService rounds", () => {
  it("starts a round against a ghost by public id", async () => {
    const repo = repository();
    await expect(new DuelService(repo).start(actor, { opponentPublicId })).resolves.toEqual({
      ok: true,
      data: { roundId, opponentMs: 300 },
    });
    expect(repo.startDuel).toHaveBeenCalledWith(opponentPublicId);
  });

  it("checks the opponent id", async () => {
    const repo = repository();
    await expect(
      new DuelService(repo).start(actor, { opponentPublicId: "not-an-id" }),
    ).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(repo.startDuel).not.toHaveBeenCalled();
  });

  it("explains an opponent who left the list and a duel started too soon", async () => {
    const hidden = new DuelService(
      repository({
        startDuel: vi.fn().mockRejectedValue(databaseError("duel_opponent_unavailable")),
      }),
    );
    await expect(hidden.start(actor, { opponentPublicId })).resolves.toMatchObject({
      code: "OPPONENT_UNAVAILABLE",
    });
    const hurried = new DuelService(
      repository({ startDuel: vi.fn().mockRejectedValue(databaseError("duel_too_soon")) }),
    );
    await expect(hurried.start(actor, { opponentPublicId })).resolves.toMatchObject({
      code: "TOO_SOON",
    });
  });

  it("finishes a round with the reaction and fouls", async () => {
    const repo = repository();
    const result = await new DuelService(repo).finish(actor, roundId, {
      reactionMs: 250,
      fouls: 0,
    });
    expect(result).toMatchObject({ ok: true, data: { outcome: "win" } });
    expect(repo.finishDuel).toHaveBeenCalledWith(roundId, 250, 0);
  });

  it("accepts no shot, and refuses impossible reactions and too many fouls", async () => {
    const repo = repository();
    const service = new DuelService(repo);
    await service.finish(actor, roundId, { reactionMs: null, fouls: 2 });
    expect(repo.finishDuel).toHaveBeenCalledWith(roundId, null, 2);
    for (const input of [
      { reactionMs: 99, fouls: 0 },
      { reactionMs: 5001, fouls: 0 },
      { reactionMs: 250.5, fouls: 0 },
      { reactionMs: 250, fouls: 3 },
      { reactionMs: 250 },
    ]) {
      await expect(service.finish(actor, roundId, input)).resolves.toMatchObject({
        code: "VALIDATION_ERROR",
      });
    }
    await expect(
      service.finish(actor, "../other", { reactionMs: 250, fouls: 0 }),
    ).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(repo.finishDuel).toHaveBeenCalledTimes(1);
  });

  it("reads an expired or scripted round as one that did not count", async () => {
    for (const reason of ["duel_round_expired", "duel_round_too_fast"]) {
      const service = new DuelService(
        repository({ finishDuel: vi.fn().mockRejectedValue(databaseError(reason)) }),
      );
      await expect(
        service.finish(actor, roundId, { reactionMs: 250, fouls: 0 }),
      ).resolves.toMatchObject({ code: "ROUND_EXPIRED" });
    }
  });
});

describe("DuelService practice, listing and reset", () => {
  it("records a practice shot on a known level only", async () => {
    const repo = repository();
    const service = new DuelService(repo);
    await expect(
      service.practice(actor, { level: "hard", reactionMs: 300, foul: false }),
    ).resolves.toMatchObject({ ok: true, data: { hit: true } });
    expect(repo.recordPractice).toHaveBeenCalledWith("hard", 300, false);
    await expect(
      service.practice(actor, { level: "godlike", reactionMs: 300, foul: false }),
    ).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("shows or hides the ghost", async () => {
    const repo = repository();
    await expect(new DuelService(repo).setListing(actor, { listed: false })).resolves.toEqual({
      ok: true,
      data: { listed: false },
    });
    await expect(new DuelService(repo).setListing(actor, { listed: "no" })).resolves.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("resets the member's own record", async () => {
    const repo = repository();
    await expect(new DuelService(repo).reset(actor)).resolves.toEqual({
      ok: true,
      data: { reset: true },
    });
    expect(repo.reset).toHaveBeenCalledTimes(1);
  });
});

describe("DuelService achievements and leaderboard", () => {
  it("claims a finished topic by its name", async () => {
    const repo = repository();
    await expect(new DuelService(repo).claimTopic(actor, "Streaks")).resolves.toEqual({
      ok: true,
      data: { outcome: "claimed" },
    });
    expect(repo.claimTopic).toHaveBeenCalledWith("Streaks");
  });

  it("refuses a malformed topic before the database", async () => {
    const repo = repository();
    await expect(new DuelService(repo).claimTopic(actor, "../streaks")).resolves.toMatchObject({
      code: "TOPIC_NOT_FOUND",
    });
    expect(repo.claimTopic).not.toHaveBeenCalled();
  });

  it("explains an unfinished topic and a member who is not institution verified", async () => {
    const unfinished = new DuelService(
      repository({ claimTopic: vi.fn().mockRejectedValue(databaseError("duel_topic_incomplete")) }),
    );
    await expect(unfinished.claimTopic(actor, "Streaks")).resolves.toMatchObject({
      code: "TOPIC_INCOMPLETE",
    });
    const unverified = new DuelService(
      repository({
        claimTopic: vi.fn().mockRejectedValue(databaseError("duel_reward_not_eligible")),
      }),
    );
    const result = await unverified.claimTopic(actor, "Streaks");
    expect(result).toMatchObject({ code: "REWARD_NOT_ELIGIBLE" });
    expect(result.ok ? "" : result.message).toContain("institution");
  });

  it("shows the leaderboard only to a member who may see the Hunters", async () => {
    const repo = repository();
    await expect(new DuelService(repo).leaderboard(null)).resolves.toMatchObject({
      code: "AUTH_REQUIRED",
    });
    await expect(new DuelService(repo).leaderboard(actor)).resolves.toEqual({ ok: true, data: [] });
  });
});

describe("DuelService.lobby without achievements", () => {
  it("still opens when this month's achievements cannot be read", async () => {
    const service = new DuelService(
      repository({
        achievements: vi.fn().mockRejectedValue(databaseError("function does not exist")),
      }),
    );
    await expect(service.lobby(actor)).resolves.toMatchObject({
      ok: true,
      data: { achievements: null },
    });
  });
});

describe("DuelService online rooms", () => {
  const roomId = roomState.roomId;

  it("opens, reads and leaves a room for a signed-in member only", async () => {
    const repo = repository();
    const service = new DuelService(repo);
    await expect(service.openRoom(null)).resolves.toMatchObject({ code: "AUTH_REQUIRED" });
    await expect(service.openRoom(actor)).resolves.toEqual({ ok: true, data: roomState });
    await expect(service.roomState(actor, roomId)).resolves.toMatchObject({ ok: true });
    await expect(service.leaveRoom(actor, roomId)).resolves.toEqual({
      ok: true,
      data: { left: true },
    });
    expect(repo.leaveRoom).toHaveBeenCalledWith(roomId);
  });

  it("joins by a 6-character code, in capitals", async () => {
    const repo = repository();
    const service = new DuelService(repo);
    await service.joinRoom(actor, { code: "abc234" });
    expect(repo.joinRoom).toHaveBeenCalledWith("ABC234");
    await expect(service.joinRoom(actor, { code: "ABC" })).resolves.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    await expect(service.joinRoom(actor, { code: "ABC10O" })).resolves.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("sends a shot or a foul, and refuses a shot without a time", async () => {
    const repo = repository();
    const service = new DuelService(repo);
    await service.roomShot(actor, roomId, { roundNumber: 2, reactionMs: 240, foul: false });
    expect(repo.roomShot).toHaveBeenCalledWith(roomId, 2, 240, false);
    await service.roomShot(actor, roomId, { roundNumber: 2, reactionMs: null, foul: true });
    expect(repo.roomShot).toHaveBeenCalledWith(roomId, 2, null, true);
    await expect(
      service.roomShot(actor, roomId, { roundNumber: 2, reactionMs: null, foul: false }),
    ).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(
      service.roomShot(actor, "not-a-room", { roundNumber: 2, reactionMs: 240, foul: false }),
    ).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("explains a room that is gone or taken", async () => {
    const taken = new DuelService(
      repository({ joinRoom: vi.fn().mockRejectedValue(databaseError("duel_room_unavailable")) }),
    );
    await expect(taken.joinRoom(actor, { code: "ABC234" })).resolves.toMatchObject({
      code: "ROOM_UNAVAILABLE",
    });
    const gone = new DuelService(
      repository({ roomState: vi.fn().mockRejectedValue(databaseError("duel_room_not_found")) }),
    );
    await expect(gone.roomState(actor, roomId)).resolves.toMatchObject({ code: "ROOM_NOT_FOUND" });
  });
});
