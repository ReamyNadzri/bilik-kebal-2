import { describe, expect, it } from "vitest";
import type { ListWantedQuery, WantedDetail, WantedSummary } from "@/contracts/marketplace";
import { WantedReadService } from "./wanted-read-service";
import type { WantedRepository } from "../repositories/wanted-repository";

const summary = (id: string): WantedSummary => ({
  id,
  title: "CSC510 Final Exam Notes",
  courseCode: "CSC510",
  courseName: "Advanced Computing",
  courseId: "course-1",
  campus: "Shah Alam",
  campusId: "campus-1",
  resourceType: "Notes",
  resourceTypeId: "type-1",
  session: "2026/1",
  sessionId: "session-1",
  grossBountySen: 1500 as never,
  backerCount: 2,
  status: "open",
  postedAt: "2026-09-15T00:00:00Z",
  closesAt: "2026-09-22T00:00:00Z",
});

const detail: WantedDetail = {
  ...summary("wanted-1"),
  description: "Detailed request description here.",
  faculty: "Computing",
  programme: "Computer Science",
  language: "English",
  tags: ["exam"],
  commissioner: { displayName: "A Student", emailVerified: true, institutionVerified: true },
  feeRateBasisPoints: 1000,
  policyVersion: "2026-09-01",
  activity: [],
  similarIds: [],
};

function repo(overrides: Partial<WantedRepository> = {}): WantedRepository {
  return {
    listPublicWanted: async () => [summary("wanted-1")],
    readPublicWanted: async () => detail,
    taxonomyMatchesInstitution: async () => true,
    createDraft: async () => {
      throw new Error();
    },
    findDraft: async () => null,
    updateDraft: async () => {
      throw new Error();
    },
    listDuplicateCandidates: async () => [],
    storeDuplicateCheck: async () => {},
    preparePublication: async () => "required",
    ...overrides,
  };
}

describe("WantedReadService", () => {
  it("rejects a viewer who has not verified email", async () => {
    const result = await new WantedReadService(repo()).list(null, {});
    expect(result).toMatchObject({ ok: false, code: "AUTH_REQUIRED" });
  });

  it("returns public summaries for an email-verified viewer", async () => {
    const query: ListWantedQuery = { sort: "newest", status: "open" };
    const result = await new WantedReadService(repo()).list({ emailVerified: true }, query);
    expect(result).toMatchObject({ ok: true, data: [summary("wanted-1")] });
  });

  it("maps an unknown public id to WANTED_NOT_FOUND", async () => {
    const result = await new WantedReadService(repo({ readPublicWanted: async () => null })).read(
      { emailVerified: true },
      "missing",
    );
    expect(result).toMatchObject({ ok: false, code: "WANTED_NOT_FOUND" });
  });
});
