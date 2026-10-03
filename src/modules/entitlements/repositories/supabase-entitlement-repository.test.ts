import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/lib/supabase/database";
import { SupabaseEntitlementRepository } from "./supabase-entitlement-repository";

const ROW = {
  id: "claim-1",
  wanted_request_id: "wanted-1",
  hunter_user_id: "hunter-1",
  institution_id: "inst-1",
  is_restricted: false,
  free_release_opt_in: false,
  rights_confirmed_at: null,
  status: "approved",
  bucket: "approved",
  object_key: "claims/claim-1/notes.pdf",
  file_name: "notes.pdf",
  size_bytes: 10,
  mime_type: "application/pdf",
};

function adminWith({
  sign,
  copy = vi.fn().mockResolvedValue({ error: null }),
}: {
  sign: ReturnType<typeof vi.fn>;
  copy?: ReturnType<typeof vi.fn>;
}) {
  const from = vi.fn(() => ({ copy, createSignedUrl: sign }));
  const maybeSingle = vi.fn().mockResolvedValue({ data: ROW, error: null });
  const query = { select: vi.fn(), eq: vi.fn(), maybeSingle };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  const admin = {
    from: vi.fn(() => query),
    storage: { from },
  } as unknown as SupabaseClient<Database>;
  return { admin, from, copy, sign, query };
}

const session = {} as SupabaseClient<Database>;

describe("SupabaseEntitlementRepository", () => {
  it("reads the claim's file facts with the service role, which RLS hides from Backers", async () => {
    const fake = adminWith({ sign: vi.fn() });
    const meta = await new SupabaseEntitlementRepository(
      session,
      () => fake.admin,
    ).getClaimDownloadMeta("claim-1");
    expect(meta).toMatchObject({ bucket: "approved", status: "approved", fileName: "notes.pdf" });
    expect(fake.query.eq).toHaveBeenCalledWith("id", "claim-1");
  });

  it("repairs an approved file missing from the approved bucket, then signs again", async () => {
    const sign = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: { message: "Object not found", statusCode: "404" },
      })
      .mockResolvedValueOnce({ data: { signedUrl: "https://project.supabase.co/s" }, error: null });
    const fake = adminWith({ sign });
    const repository = new SupabaseEntitlementRepository(session, () => fake.admin);
    await expect(
      repository.signClaimDownload(
        { bucket: "approved", objectKey: ROW.object_key, status: "approved" },
        "notes.pdf",
        900,
      ),
    ).resolves.toEqual({ ok: true, url: "https://project.supabase.co/s" });
    expect(fake.from).toHaveBeenCalledWith("quarantine");
    expect(fake.copy).toHaveBeenCalledWith(ROW.object_key, ROW.object_key, {
      destinationBucket: "approved",
    });
    expect(sign).toHaveBeenLastCalledWith(ROW.object_key, 900, { download: "notes.pdf" });
  });

  it("never copies a file that is not approved", async () => {
    const sign = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "Object not found", statusCode: "404" } });
    const fake = adminWith({ sign });
    await expect(
      new SupabaseEntitlementRepository(session, () => fake.admin).signClaimDownload(
        { bucket: "quarantine", objectKey: ROW.object_key, status: "under_review" },
        "notes.pdf",
        900,
      ),
    ).resolves.toEqual({ ok: false, reason: "not_found" });
    expect(fake.copy).not.toHaveBeenCalled();
  });
});
