import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/lib/supabase/database";
import { SupabaseClaimFileReviewGateway } from "./supabase-claim-file-review-gateway";

const CLAIM = "00000000-0000-4000-8000-000000000001";

function gatewayWith(result: { data: unknown; error: unknown }) {
  const rpc = vi.fn().mockResolvedValue(result);
  const createAdmin = vi.fn();
  const gateway = new SupabaseClaimFileReviewGateway(
    { rpc } as unknown as SupabaseClient<Database>,
    createAdmin,
  );
  return { gateway, rpc, createAdmin };
}

describe("SupabaseClaimFileReviewGateway", () => {
  it("asks the database with the member's session and returns the file facts", async () => {
    const { gateway, rpc, createAdmin } = gatewayWith({
      data: [
        { bucket: "quarantine", object_key: "k", file_name: "a.pdf", mime_type: "application/pdf" },
      ],
      error: null,
    });
    await expect(gateway.authorise(CLAIM, "view")).resolves.toEqual({
      ok: true,
      file: {
        bucket: "quarantine",
        objectKey: "k",
        fileName: "a.pdf",
        mimeType: "application/pdf",
      },
    });
    expect(rpc).toHaveBeenCalledWith("review_claim_file_access", {
      target_claim_id: CLAIM,
      target_purpose: "view",
    });
    expect(createAdmin).not.toHaveBeenCalled();
  });

  it.each([
    ["42501", "forbidden"],
    ["P0002", "not_found"],
    ["28000", "auth"],
    ["22023", "invalid"],
    ["XX000", "unavailable"],
  ])("maps SQLSTATE %s to %s", async (code, reason) => {
    const { gateway } = gatewayWith({ data: null, error: { code, message: "x" } });
    await expect(gateway.authorise(CLAIM, "download")).resolves.toEqual({ ok: false, reason });
  });

  it("signs with the service-role client's storage", async () => {
    const sign = vi.fn().mockResolvedValue({ data: { signedUrl: "https://s" }, error: null });
    const admin = { storage: { from: vi.fn(() => ({ createSignedUrl: sign, copy: vi.fn() })) } };
    const gateway = new SupabaseClaimFileReviewGateway(
      {} as SupabaseClient<Database>,
      () => admin as unknown as SupabaseClient<Database>,
    );
    await expect(
      gateway.sign({ bucket: "quarantine", objectKey: "k", status: "under_review" }, 300, {
        download: "a.pdf",
      }),
    ).resolves.toEqual({ ok: true, url: "https://s" });
    expect(admin.storage.from).toHaveBeenCalledWith("quarantine");
    expect(sign).toHaveBeenCalledWith("k", 300, { download: "a.pdf" });
  });
});
