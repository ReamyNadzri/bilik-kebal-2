import { describe, expect, it, vi } from "vitest";
import {
  promoteApprovedClaimFile,
  signClaimFile,
  type ClaimStorage,
  type StorageErrorLike,
} from "./promote-approved-claim-file";

type CopyResult = { error: StorageErrorLike | null };
type SignResult = { data: { signedUrl: string } | null; error: StorageErrorLike | null };

function fakeStorage({
  copy = [{ error: null }],
  sign = [{ data: { signedUrl: "https://project.supabase.co/sign/x" }, error: null }],
}: { copy?: CopyResult[]; sign?: SignResult[] } = {}) {
  const copyFn = vi.fn();
  const signFn = vi.fn();
  for (const result of copy) copyFn.mockResolvedValueOnce(result);
  for (const result of sign) signFn.mockResolvedValueOnce(result);
  const from = vi.fn(() => ({ copy: copyFn, createSignedUrl: signFn }));
  return { storage: { from } as ClaimStorage, from, copy: copyFn, sign: signFn };
}

const NOT_FOUND: StorageErrorLike = { message: "Object not found", status: 400, statusCode: "404" };
const DUPLICATE: StorageErrorLike = {
  message: "The resource already exists",
  status: 400,
  statusCode: "409",
};

describe("promoteApprovedClaimFile", () => {
  it("copies the quarantined object to the same key in the approved bucket", async () => {
    const fake = fakeStorage();
    await expect(promoteApprovedClaimFile(fake.storage, "claims/abc/notes.pdf")).resolves.toBe(
      "copied",
    );
    expect(fake.from).toHaveBeenCalledWith("quarantine");
    expect(fake.copy).toHaveBeenCalledWith("claims/abc/notes.pdf", "claims/abc/notes.pdf", {
      destinationBucket: "approved",
    });
  });

  it("treats an object already in the approved bucket as success", async () => {
    const fake = fakeStorage({ copy: [{ error: DUPLICATE }] });
    await expect(promoteApprovedClaimFile(fake.storage, "k")).resolves.toBe("already_present");
  });

  it("reports any other storage failure without throwing", async () => {
    const fake = fakeStorage({ copy: [{ error: { message: "boom", status: 500 } }] });
    await expect(promoteApprovedClaimFile(fake.storage, "k")).resolves.toBe("failed");
  });

  it("reports a thrown storage call as a failure", async () => {
    const fake = fakeStorage();
    fake.copy.mockReset().mockRejectedValue(new Error("network"));
    await expect(promoteApprovedClaimFile(fake.storage, "k")).resolves.toBe("failed");
  });
});

describe("signClaimFile", () => {
  it("signs the object with the given lifetime and download name", async () => {
    const fake = fakeStorage();
    await expect(
      signClaimFile(fake.storage, { bucket: "approved", objectKey: "k", status: "approved" }, 300, {
        download: "notes.pdf",
      }),
    ).resolves.toEqual({ ok: true, url: "https://project.supabase.co/sign/x" });
    expect(fake.from).toHaveBeenCalledWith("approved");
    expect(fake.sign).toHaveBeenCalledWith("k", 300, { download: "notes.pdf" });
    expect(fake.copy).not.toHaveBeenCalled();
  });

  it("repairs an approved claim whose file never left quarantine, then signs again", async () => {
    const fake = fakeStorage({
      sign: [
        { data: null, error: NOT_FOUND },
        { data: { signedUrl: "https://project.supabase.co/sign/healed" }, error: null },
      ],
    });
    await expect(
      signClaimFile(fake.storage, { bucket: "approved", objectKey: "k", status: "approved" }, 900),
    ).resolves.toEqual({ ok: true, url: "https://project.supabase.co/sign/healed" });
    expect(fake.copy).toHaveBeenCalledWith("k", "k", { destinationBucket: "approved" });
    expect(fake.sign).toHaveBeenCalledTimes(2);
  });

  it("does not copy or retry when the claim is not approved", async () => {
    const fake = fakeStorage({ sign: [{ data: null, error: NOT_FOUND }] });
    await expect(
      signClaimFile(
        fake.storage,
        { bucket: "quarantine", objectKey: "k", status: "under_review" },
        300,
      ),
    ).resolves.toEqual({ ok: false, reason: "not_found" });
    expect(fake.copy).not.toHaveBeenCalled();
    expect(fake.sign).toHaveBeenCalledTimes(1);
  });

  it("does not copy when an approved claim fails to sign for another reason", async () => {
    const fake = fakeStorage({ sign: [{ data: null, error: { message: "boom", status: 500 } }] });
    await expect(
      signClaimFile(fake.storage, { bucket: "approved", objectKey: "k", status: "approved" }, 300),
    ).resolves.toEqual({ ok: false, reason: "failed" });
    expect(fake.copy).not.toHaveBeenCalled();
  });

  it("gives up when the repair copy fails", async () => {
    const fake = fakeStorage({
      sign: [{ data: null, error: NOT_FOUND }],
      copy: [{ error: NOT_FOUND }],
    });
    await expect(
      signClaimFile(fake.storage, { bucket: "approved", objectKey: "k", status: "approved" }, 300),
    ).resolves.toEqual({ ok: false, reason: "failed" });
    expect(fake.sign).toHaveBeenCalledTimes(1);
  });
});
