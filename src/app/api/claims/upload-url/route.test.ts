import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const getActor = vi.fn();
const create = vi.fn();

vi.mock("@/modules/claims/services/create-claim-upload-service", () => ({
  createClaimUploadContext: vi.fn().mockImplementation(async () => ({
    userId: "u",
    getActor,
    service: { create },
  })),
}));

const PUBLIC_ID = "30000000-0000-4000-8000-000000000001";
const INTERNAL_ID = "40000000-0000-4000-8000-000000000002";

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/claims/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/claims/upload-url", () => {
  beforeEach(() => {
    getActor.mockReset();
    create.mockReset().mockResolvedValue({ ok: true, data: { claimId: "c" } });
  });

  it("looks the Wanted up by the public id the screen sends and claims against its internal id", async () => {
    getActor.mockResolvedValue({
      actor: null,
      wantedStatus: "open",
      internalWantedId: INTERNAL_ID,
    });

    const response = await post({ wantedId: PUBLIC_ID, fileName: "notes.pdf" });

    expect(response.status).toBe(201);
    expect(getActor).toHaveBeenCalledWith(PUBLIC_ID);
    expect(create).toHaveBeenCalledWith(null, "open", {
      wantedId: INTERNAL_ID,
      fileName: "notes.pdf",
    });
  });

  it("passes the input through unchanged when no Wanted matches", async () => {
    getActor.mockResolvedValue({ actor: null, wantedStatus: "missing", internalWantedId: null });

    await post({ wantedId: PUBLIC_ID });

    expect(create).toHaveBeenCalledWith(null, "missing", { wantedId: PUBLIC_ID });
  });
});
