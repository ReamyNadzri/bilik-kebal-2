import { describe, expect, it, vi } from "vitest";
import { TaxonomyRequestService, type TaxonomyRequestRepository } from "./taxonomy-request-service";

const actor = { userId: "00000000-0000-4000-8000-000000000002" };
const programmeId = "00000000-0000-4000-8000-000000000009";
const requestId = "33333333-3333-4333-8333-333333333333";

function repository(overrides: Partial<TaxonomyRequestRepository> = {}): TaxonomyRequestRepository {
  return {
    submit: vi.fn().mockResolvedValue(requestId),
    listOwn: vi.fn().mockResolvedValue([]),
    listPendingForReview: vi.fn().mockResolvedValue([]),
    decide: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("TaxonomyRequestService", () => {
  it("sends a course request with an upper-cased code and its programme", async () => {
    const repo = repository();

    const result = await new TaxonomyRequestService(repo).submit(actor, {
      category: "course",
      label: "Data Structures",
      courseCode: "csc508",
      parentId: programmeId,
    });

    expect(result).toEqual({ ok: true, data: { requestId, state: "pending" } });
    expect(repo.submit).toHaveBeenCalledWith({
      category: "course",
      courseCode: "CSC508",
      label: "Data Structures",
      note: null,
      parentId: programmeId,
    });
  });

  it("requires a programme and code for a course, and a faculty for a programme", async () => {
    const service = new TaxonomyRequestService(repository());

    await expect(
      service.submit(actor, { category: "course", label: "Data Structures" }),
    ).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(
      service.submit(actor, { category: "programme", label: "Computer Science" }),
    ).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("reports the pending-request limit", async () => {
    const repo = repository({
      submit: vi.fn().mockRejectedValue({ message: "taxonomy_request_limit_reached" }),
    });

    const result = await new TaxonomyRequestService(repo).submit(actor, {
      category: "tag",
      label: "Past year",
    });

    expect(result).toMatchObject({ ok: false, code: "REQUEST_LIMIT_REACHED" });
  });

  it("opens a new campus only when the Sheriff says so", async () => {
    const repo = repository();

    await new TaxonomyRequestService(repo).decide(actor, requestId, { approve: true });

    expect(repo.decide).toHaveBeenCalledWith({
      approve: true,
      note: null,
      openRegion: false,
      requestId,
    });
  });

  it("refuses a non-Sheriff decision", async () => {
    const repo = repository({
      decide: vi.fn().mockRejectedValue({ message: "taxonomy_reviewer_not_authorized" }),
    });

    const result = await new TaxonomyRequestService(repo).decide(actor, requestId, {
      approve: false,
    });

    expect(result).toMatchObject({ ok: false, code: "NOT_AUTHORIZED" });
  });
});
