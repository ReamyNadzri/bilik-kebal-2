import { claimStages, claimStatusPresentation, wantedStatusPresentation } from "./status";
import type { ClaimStatus, WantedStatus } from "./types";

const WANTED_STATUSES: readonly WantedStatus[] = [
  "open",
  "ending-soon",
  "well-funded",
  "reviewing",
  "closed",
];

const CLAIM_STATUSES: readonly ClaimStatus[] = [
  "draft",
  "screening",
  "needs-information",
  "under-review",
  "not-selected",
  "approved",
  "rejected",
  "quarantined",
];

describe("Wanted status", () => {
  test("names each lifecycle state in plain words", () => {
    expect(wantedStatusPresentation("open").label).toBe("Open");
    expect(wantedStatusPresentation("ending-soon").label).toBe("Ending soon");
    expect(wantedStatusPresentation("well-funded").label).toBe("Well funded");
    expect(wantedStatusPresentation("reviewing").label).toBe("Under review");
    expect(wantedStatusPresentation("closed").label).toBe("Closed");
  });

  test("gives every state a label, so none is carried by colour alone", () => {
    for (const status of WANTED_STATUSES) {
      expect(wantedStatusPresentation(status).label).not.toBe("");
    }
  });

  test("distinguishes states by emphasis as well as tone", () => {
    const emphases = new Set(WANTED_STATUSES.map((s) => wantedStatusPresentation(s).emphasis));

    expect(emphases.size).toBeGreaterThan(1);
  });
});

describe("claim status", () => {
  test("names each state the way a Hunter would be told it", () => {
    expect(claimStatusPresentation("draft").label).toBe("Draft");
    expect(claimStatusPresentation("screening").label).toBe("Screening");
    expect(claimStatusPresentation("needs-information").label).toBe("Needs information");
    expect(claimStatusPresentation("under-review").label).toBe("Under Sheriff review");
    expect(claimStatusPresentation("not-selected").label).toBe("Not selected");
    expect(claimStatusPresentation("approved").label).toBe("Approved");
    expect(claimStatusPresentation("rejected").label).toBe("Rejected");
    expect(claimStatusPresentation("quarantined").label).toBe("Quarantined");
  });

  test("keeps Not selected and Rejected apart in label, meaning and presentation", () => {
    const notSelected = claimStatusPresentation("not-selected");
    const rejected = claimStatusPresentation("rejected");

    expect(notSelected.label).not.toBe(rejected.label);
    expect(notSelected.nextStep).not.toBe(rejected.nextStep);
    expect(notSelected.tone).not.toBe(rejected.tone);
    expect(notSelected.emphasis).not.toBe(rejected.emphasis);
  });

  test("says a not-selected claim was valid and lost, not that it broke a rule", () => {
    const { nextStep } = claimStatusPresentation("not-selected");

    expect(nextStep).toMatch(/valid/i);
    expect(nextStep).toMatch(/another claim was chosen/i);
    expect(nextStep).not.toMatch(/polic(y|ies)|breach|violat/i);
  });

  test("says a rejected claim failed the content policy", () => {
    expect(claimStatusPresentation("rejected").nextStep).toMatch(/content policy/i);
  });

  test("tells a Hunter what happens next in every state", () => {
    for (const status of CLAIM_STATUSES) {
      expect(claimStatusPresentation(status).nextStep.length).toBeGreaterThan(0);
    }
  });

  test("never promises money before the Owner has paid it", () => {
    expect(claimStatusPresentation("approved").nextStep).toMatch(/Owner/);
    expect(claimStatusPresentation("approved").nextStep).not.toMatch(/paid|transferred|received/i);
  });

  test("describes screening as automated checking, not a decision", () => {
    const { nextStep } = claimStatusPresentation("screening");

    expect(nextStep).toMatch(/checking/i);
    expect(nextStep).not.toMatch(/approv|reject/i);
  });
});

describe("claim stage track", () => {
  const statesOf = (status: ClaimStatus) => claimStages(status).map((stage) => stage.state);

  test("walks every claim through the same five stations", () => {
    for (const status of CLAIM_STATUSES) {
      expect(claimStages(status).map((stage) => stage.label)).toEqual([
        "Draft",
        "Screening",
        "Sheriff review",
        "Decision",
        "Payout",
      ]);
    }
  });

  test("places a claim under Sheriff review at the review station", () => {
    expect(statesOf("under-review")).toEqual(["done", "done", "current", "ahead", "ahead"]);
  });

  test("never paints a claim that was not selected as one that was rejected", () => {
    expect(statesOf("not-selected")).toEqual(["done", "done", "done", "ended", "ahead"]);
    expect(statesOf("rejected")).toEqual(["done", "done", "done", "stopped", "ahead"]);
  });

  test("stops a quarantined claim at screening", () => {
    expect(statesOf("quarantined")).toEqual(["done", "stopped", "ahead", "ahead", "ahead"]);
  });

  test("leaves an approved claim waiting at payout rather than marking it paid", () => {
    expect(statesOf("approved")).toEqual(["done", "done", "done", "done", "current"]);
  });
});
