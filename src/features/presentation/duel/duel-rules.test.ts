import {
  duelResultCopy,
  heartbeatInterval,
  killDeathRatio,
  newRound,
  practiceResultCopy,
  press,
  rankOf,
  recordedReaction,
  signalDelay,
  timeout,
  winRate,
} from "./duel-rules";

const SIGNAL = 3000;

function round(opponentMs = 300, practice = false) {
  const made = newRound(0, practice, opponentMs, () => 0);
  return { ...made, signalAt: SIGNAL };
}

describe("signalDelay", () => {
  it("waits 2.8–9.3 s in a duel and 2.2–7.2 s on the practice field", () => {
    expect(signalDelay(false, () => 0)).toBe(2800);
    expect(signalDelay(false, () => 1)).toBe(9300);
    expect(signalDelay(true, () => 0)).toBe(2200);
    expect(signalDelay(true, () => 1)).toBe(7200);
  });
});

describe("press", () => {
  it("wins when faster by more than 15 ms", () => {
    const r = round(300);
    expect(press(r, SIGNAL + 284, 0)).toBe("win");
    expect(r.winner).toBe("you");
    expect(recordedReaction(r)).toBe(284);
  });

  it("draws within 15 ms either side in a duel", () => {
    expect(press(round(300), SIGNAL + 285, 0)).toBe("draw");
    expect(press(round(300), SIGNAL + 315, 0)).toBe("draw");
  });

  it("has no draw window on the practice field", () => {
    expect(press(round(350, true), SIGNAL + 349, 0)).toBe("win");
    const slow = round(350, true);
    expect(press(slow, SIGNAL + 351, 0)).toBe("late");
    expect(slow.winner).toBe("opp");
  });

  it("loses when slower, and still records the late reaction", () => {
    const r = round(300);
    expect(press(r, SIGNAL + 316, 0)).toBe("late");
    expect(r.winner).toBe("opp");
    expect(r.shotAt).toBe(SIGNAL + 300);
    expect(recordedReaction(r)).toBe(316);
  });

  it("drops the gun on a first foul and loses on the second", () => {
    const first = round();
    expect(press(first, SIGNAL - 1, 0)).toBe("foul");
    expect(first.foulRetry).toBe(true);
    expect(first.winner).toBeNull();
    expect(press(first, SIGNAL + 200, 1)).toBe("ignored");

    const second = round();
    expect(press(second, 500, 1)).toBe("foul-out");
    expect(second.winner).toBe("opp");
    expect(recordedReaction(second)).toBeNull();
  });

  it("treats a press under 100 ms after the signal as a guess", () => {
    expect(press(round(), SIGNAL + 99, 0)).toBe("foul");
    expect(press(round(), SIGNAL + 100, 0)).toBe("win");
  });

  it("records a press after the opponent already won on time", () => {
    const r = round(300);
    expect(timeout(r, SIGNAL + 315)).toBe(true);
    expect(press(r, SIGNAL + 420, 0)).toBe("late");
    expect(recordedReaction(r)).toBe(420);
    expect(press(r, SIGNAL + 500, 0)).toBe("ignored");
  });
});

describe("timeout", () => {
  it("lets the opponent fire only after the draw window", () => {
    const r = round(300);
    expect(timeout(r, SIGNAL + 314)).toBe(false);
    expect(timeout(r, SIGNAL + 315)).toBe(true);
    expect(r.winner).toBe("opp");
    expect(recordedReaction(r)).toBeNull();
  });

  it("waits while a foul restarts the standoff", () => {
    const r = round(300);
    press(r, 100, 0);
    expect(timeout(r, SIGNAL + 2000)).toBe(false);
  });
});

describe("copy", () => {
  it("words each duel result", () => {
    const won = round(300);
    press(won, SIGNAL + 250, 0);
    expect(duelResultCopy(won, "Haziq")).toMatchObject({
      title: "YOU WIN",
      line: "Haziq is eliminated.",
      you: "250 ms",
      them: "300 ms",
    });
    const fouled = round();
    press(fouled, 100, 1);
    expect(duelResultCopy(fouled, "Haziq")).toMatchObject({ title: "ELIMINATED", you: "Foul ×2" });
    const silent = round();
    timeout(silent, SIGNAL + 400);
    expect(duelResultCopy(silent, "Haziq")).toMatchObject({
      you: "No shot",
      line: "Haziq drew first.",
    });
    const tied = round(300);
    press(tied, SIGNAL + 305, 0);
    expect(duelResultCopy(tied, "Haziq").title).toBe("DRAW");
  });

  it("words each practice result against its target", () => {
    const hit = round(350, true);
    press(hit, SIGNAL + 300, 0);
    expect(practiceResultCopy(hit)).toMatchObject({
      title: "HIT",
      line: "Under the 350 ms target.",
    });
    const slow = round(350, true);
    timeout(slow, SIGNAL + 360);
    expect(practiceResultCopy(slow)).toMatchObject({ title: "TOO SLOW", you: "No shot" });
  });
});

describe("numbers", () => {
  it("ranks by average draw", () => {
    expect(rankOf(265)).toBe("DEADEYE");
    expect(rankOf(335)).toBe("GUNSLINGER");
    expect(rankOf(336)).toBe("GREENHORN");
  });

  it("works out K/D and win rate, with nothing played yet", () => {
    expect(killDeathRatio({ kills: 0, deaths: 0 })).toBe("0.00");
    expect(killDeathRatio({ kills: 3, deaths: 0 })).toBe("3.00");
    expect(killDeathRatio({ kills: 5, deaths: 2 })).toBe("2.50");
    expect(winRate({ kills: 0, deaths: 0 })).toBe("—");
    expect(winRate({ kills: 5, deaths: 2 })).toBe("71%");
  });

  it("tightens the heartbeat from 1 s to 330 ms", () => {
    expect(heartbeatInterval(900)).toBe(1000);
    expect(heartbeatInterval(20000)).toBe(330);
  });
});
