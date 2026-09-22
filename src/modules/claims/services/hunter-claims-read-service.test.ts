import { describe, expect, it, vi } from "vitest";
import { HunterClaimsReadService, toPresentationClaimStatus } from "./hunter-claims-read-service";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("HunterClaimsReadService", () => {
  it("maps claim database status to presentation claim status", () => {
    expect(toPresentationClaimStatus("uploading")).toBe("quarantined");
    expect(toPresentationClaimStatus("screening")).toBe("screening");
    expect(toPresentationClaimStatus("needs_information")).toBe("needs-information");
    expect(toPresentationClaimStatus("under_review")).toBe("under-review");
    expect(toPresentationClaimStatus("approved")).toBe("approved");
    expect(toPresentationClaimStatus("not_selected")).toBe("not-selected");
    expect(toPresentationClaimStatus("rejected")).toBe("rejected");
    expect(toPresentationClaimStatus("withdrawn")).toBe("rejected");
    expect(toPresentationClaimStatus("unknown")).toBe("quarantined");
  });

  it("queries claims filtered by hunter_user_id and maps to ClaimSummary models", async () => {
    const mockRows = [
      {
        id: "internal-id-1",
        public_id: "public-claim-1",
        status: "under_review",
        created_at: "2026-09-20T10:00:00.000Z",
        wanted_requests: {
          public_id: "wanted-pub-1",
          title: "Operating Systems Notes",
          courses: {
            code: "CSC510",
            name: "Operating Systems",
          },
        },
      },
      {
        id: "internal-id-2",
        public_id: "public-claim-2",
        status: "approved",
        created_at: "2026-09-18T14:00:00.000Z",
        wanted_requests: {
          public_id: "wanted-pub-2",
          title: "Calculus Past Papers",
          courses: {
            code: "MAT402",
            name: "Calculus I",
          },
        },
      },
    ];

    const orderMock = vi.fn().mockResolvedValue({ data: mockRows, error: null });
    const eqMock = vi.fn().mockReturnValue({ order: orderMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    const fromMock = vi.fn().mockReturnValue({ select: selectMock });

    const mockClient = {
      from: fromMock,
    } as unknown as SupabaseClient;

    const service = new HunterClaimsReadService(mockClient);
    const result = await service.listHunterClaims("user-123");

    expect(fromMock).toHaveBeenCalledWith("claims");
    expect(eqMock).toHaveBeenCalledWith("hunter_user_id", "user-123");
    expect(orderMock).toHaveBeenCalledWith("created_at", { ascending: false });

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: "public-claim-1",
      wantedId: "wanted-pub-1",
      wantedTitle: "Operating Systems Notes",
      courseCode: "CSC510",
      courseName: "Operating Systems",
      status: "under-review",
      submittedAt: "2026-09-20T10:00:00.000Z",
    });
    expect(result[1]).toEqual({
      id: "public-claim-2",
      wantedId: "wanted-pub-2",
      wantedTitle: "Calculus Past Papers",
      courseCode: "MAT402",
      courseName: "Calculus I",
      status: "approved",
      submittedAt: "2026-09-18T14:00:00.000Z",
    });
  });

  it("returns an empty array when userId is blank or query fails", async () => {
    const orderMock = vi.fn().mockResolvedValue({ data: null, error: new Error("DB error") });
    const eqMock = vi.fn().mockReturnValue({ order: orderMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    const fromMock = vi.fn().mockReturnValue({ select: selectMock });

    const mockClient = {
      from: fromMock,
    } as unknown as SupabaseClient;

    const service = new HunterClaimsReadService(mockClient);

    // Empty userId
    expect(await service.listHunterClaims("")).toEqual([]);

    // Query error
    expect(await service.listHunterClaims("user-123")).toEqual([]);
  });
});
