import { describe, expect, it, vi } from "vitest";
import type { WantedActor } from "../domain/wanted-policy";
import {
  WantedPosterService,
  type StoredEditableDetails,
  type WantedPosterRepository,
} from "./wanted-poster-service";

const actor: WantedActor = {
  userId: "00000000-0000-4000-8000-000000000002",
  emailVerified: true,
  institutionId: "00000000-0000-4000-8000-000000000003",
  institutionVerified: true,
  restricted: false,
};
const publicId = "11111111-1111-4111-8111-111111111111";
const ids = {
  campus: "22222222-2222-4222-8222-222222222221",
  otherCampus: "22222222-2222-4222-8222-222222222222",
  faculty: "33333333-3333-4333-8333-333333333331",
  programme: "44444444-4444-4444-8444-444444444441",
  course: "55555555-5555-4555-8555-555555555551",
  newCourse: "55555555-5555-4555-8555-555555555552",
  resourceType: "66666666-6666-4666-8666-666666666661",
  language: "77777777-7777-4777-8777-777777777771",
  tag: "88888888-8888-4888-8888-888888888881",
};

const published: StoredEditableDetails = {
  kind: "academic",
  title: "Past year papers for MAT183",
  description: "Any past year final papers from 2022 onwards, with or without answers.",
  campusId: ids.campus,
  facultyId: ids.faculty,
  programmeId: ids.programme,
  courseCode: "MAT183",
  courseId: ids.course,
  academicSessionId: null,
  resourceTypeId: ids.resourceType,
  languageId: ids.language,
  lastSeenLocation: null,
  tagIds: [ids.tag],
};

/** The published details as the dialog would send them back. */
function asEdit(details: StoredEditableDetails) {
  const edit: Partial<StoredEditableDetails> = { ...details };
  delete edit.kind;
  delete edit.courseId;
  return edit as Omit<StoredEditableDetails, "kind" | "courseId">;
}

const academicEdit = asEdit(published);

function repository(overrides: Partial<WantedPosterRepository> = {}): WantedPosterRepository {
  return {
    readChangeWindow: vi
      .fn()
      .mockResolvedValue({ editableUntil: "2026-09-28T11:00:00.000Z", lockedReason: null }),
    readEditableDetails: vi.fn().mockResolvedValue(published),
    ensureCourse: vi.fn().mockResolvedValue(ids.newCourse),
    updatePublishedWanted: vi.fn().mockResolvedValue(undefined),
    withdrawWanted: vi.fn().mockResolvedValue(2),
    ...overrides,
  };
}

describe("WantedPosterService", () => {
  it("reads the poster's window", async () => {
    const result = await new WantedPosterService(repository()).changeWindow(actor, publicId);
    expect(result).toEqual({
      ok: true,
      data: { editableUntil: "2026-09-28T11:00:00.000Z", lockedReason: null },
    });
  });

  it("answers not found to anyone who is not the poster", async () => {
    const repo = repository({ readChangeWindow: vi.fn().mockResolvedValue(null) });
    const result = await new WantedPosterService(repo).changeWindow(actor, publicId);
    expect(result).toMatchObject({ ok: false, code: "WANTED_NOT_FOUND" });
  });

  it("reads the editable details for the poster only, without internal ids", async () => {
    const repo = repository();
    const result = await new WantedPosterService(repo).editableDetails(actor, publicId);
    expect(repo.readEditableDetails).toHaveBeenCalledWith(publicId, actor.userId);
    expect(result.ok && result.data).toEqual({ kind: "academic", ...academicEdit });
    const missing = repository({ readEditableDetails: vi.fn().mockResolvedValue(null) });
    expect(await new WantedPosterService(missing).editableDetails(actor, publicId)).toMatchObject({
      ok: false,
      code: "WANTED_NOT_FOUND",
    });
  });

  it("saves trimmed text and keeps the published course without filing it again", async () => {
    const repo = repository();
    const result = await new WantedPosterService(repo).edit(actor, publicId, {
      ...academicEdit,
      title: "  Past year papers for MAT183 (2022+) ",
    });
    expect(result).toEqual({ ok: true, data: { state: "edited" } });
    expect(repo.ensureCourse).not.toHaveBeenCalled();
    expect(repo.updatePublishedWanted).toHaveBeenCalledWith(publicId, {
      title: "Past year papers for MAT183 (2022+)",
      description: published.description,
      campusId: ids.campus,
      facultyId: ids.faculty,
      programmeId: ids.programme,
      courseId: ids.course,
      academicSessionId: null,
      resourceTypeId: ids.resourceType,
      languageId: ids.language,
      lastSeenLocation: null,
      tagIds: [ids.tag],
    });
  });

  it("an academic edit needs faculty, programme, course, type and language", async () => {
    const repo = repository();
    const service = new WantedPosterService(repo);
    for (const missing of [
      "courseCode",
      "facultyId",
      "programmeId",
      "resourceTypeId",
      "languageId",
    ]) {
      const result = await service.edit(actor, publicId, { ...academicEdit, [missing]: null });
      expect(result).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
    }
    expect(repo.updatePublishedWanted).not.toHaveBeenCalled();
  });

  it("a new course code is filed through ensureCourse before the edit", async () => {
    const repo = repository();
    await new WantedPosterService(repo).edit(actor, publicId, {
      ...academicEdit,
      courseCode: "CTU551",
    });
    expect(repo.ensureCourse).toHaveBeenCalledWith(ids.programme, "CTU551");
    expect(repo.updatePublishedWanted).toHaveBeenCalledWith(
      publicId,
      expect.objectContaining({ courseId: ids.newCourse }),
    );
  });

  it("refuses a course code that has been switched off", async () => {
    const repo = repository({ ensureCourse: vi.fn().mockResolvedValue(null) });
    const result = await new WantedPosterService(repo).edit(actor, publicId, {
      ...academicEdit,
      courseCode: "OLD100",
    });
    expect(result).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
    expect(result.ok ? "" : result.message).toMatch(/switched off/);
    expect(repo.updatePublishedWanted).not.toHaveBeenCalled();
  });

  it("nothing changed means no call", async () => {
    const repo = repository();
    const result = await new WantedPosterService(repo).edit(actor, publicId, asEdit(published));
    expect(result).toEqual({ ok: true, data: { state: "edited" } });
    expect(repo.updatePublishedWanted).not.toHaveBeenCalled();
  });

  it("a missing item sends its campus and last-seen place and no academic fields", async () => {
    const item: StoredEditableDetails = {
      ...published,
      kind: "missing_item",
      title: "Missing blue water bottle",
      facultyId: null,
      programmeId: null,
      courseCode: null,
      courseId: null,
      resourceTypeId: null,
      languageId: null,
      tagIds: [],
    };
    const repo = repository({ readEditableDetails: vi.fn().mockResolvedValue(item) });
    await new WantedPosterService(repo).edit(actor, publicId, {
      ...asEdit(item),
      campusId: ids.otherCampus,
      lastSeenLocation: " Library level 2 ",
      // Ignored for a missing item, even if sent.
      courseCode: "CSC510",
      facultyId: ids.faculty,
    });
    expect(repo.ensureCourse).not.toHaveBeenCalled();
    expect(repo.updatePublishedWanted).toHaveBeenCalledWith(
      publicId,
      expect.objectContaining({
        campusId: ids.otherCampus,
        lastSeenLocation: "Library level 2",
        courseId: null,
        facultyId: null,
      }),
    );
  });

  it("a discussion keeps no last-seen place", async () => {
    const talk: StoredEditableDetails = {
      ...published,
      kind: "discussion",
      facultyId: null,
      programmeId: null,
      courseCode: null,
      courseId: null,
      resourceTypeId: null,
      languageId: null,
      tagIds: [],
    };
    const repo = repository({ readEditableDetails: vi.fn().mockResolvedValue(talk) });
    await new WantedPosterService(repo).edit(actor, publicId, {
      ...asEdit(talk),
      title: "Which elective is lighter?",
      lastSeenLocation: "Library",
    });
    expect(repo.updatePublishedWanted).toHaveBeenCalledWith(
      publicId,
      expect.objectContaining({ lastSeenLocation: null }),
    );
  });

  it("refuses text outside the published limits without calling the database", async () => {
    const repo = repository();
    const result = await new WantedPosterService(repo).edit(actor, publicId, {
      ...academicEdit,
      title: "Short",
    });
    expect(result).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
    expect(result.ok ? "" : result.message).toMatch(/title needs 8 to 120/);
    expect(repo.readEditableDetails).not.toHaveBeenCalled();
  });

  it("answers not found when the caller is not the poster", async () => {
    const repo = repository({ readEditableDetails: vi.fn().mockResolvedValue(null) });
    const result = await new WantedPosterService(repo).edit(actor, publicId, academicEdit);
    expect(result).toMatchObject({ ok: false, code: "WANTED_NOT_FOUND" });
  });

  it("explains a detail the database no longer accepts", async () => {
    const repo = repository({
      updatePublishedWanted: vi.fn().mockRejectedValue({ message: "wanted_change_invalid" }),
    });
    const result = await new WantedPosterService(repo).edit(actor, publicId, {
      ...academicEdit,
      campusId: ids.otherCampus,
    });
    expect(result).toEqual({
      ok: false,
      code: "VALIDATION_ERROR",
      message: "One of the details no longer fits this university. Check them and save again.",
    });
  });

  it.each([
    ["window_closed", /hour for changes has passed/],
    ["claim_submitted", /submitted a claim/],
    ["reply_received", /Someone has replied/],
    ["not_open", /Only an open Wanted/],
  ])("maps the %s lock to WANTED_LOCKED", async (reason, message) => {
    const repo = repository({
      updatePublishedWanted: vi
        .fn()
        .mockRejectedValue({ message: `wanted_change_locked:${reason}` }),
    });
    const result = await new WantedPosterService(repo).edit(actor, publicId, {
      ...academicEdit,
      title: "Past year papers for MAT183 again",
    });
    expect(result).toMatchObject({ ok: false, code: "WANTED_LOCKED" });
    expect(result.ok ? "" : result.message).toMatch(message);
  });

  it("withdraws and reports the refunds queued", async () => {
    const result = await new WantedPosterService(repository()).withdraw(actor, publicId);
    expect(result).toEqual({ ok: true, data: { state: "withdrawn", refundsQueued: 2 } });
  });

  it("maps a locked withdrawal", async () => {
    const repo = repository({
      withdrawWanted: vi
        .fn()
        .mockRejectedValue({ message: "wanted_change_locked:claim_submitted" }),
    });
    const result = await new WantedPosterService(repo).withdraw(actor, publicId);
    expect(result).toMatchObject({ ok: false, code: "WANTED_LOCKED" });
  });

  it("maps someone else's Wanted to not found", async () => {
    const repo = repository({
      withdrawWanted: vi.fn().mockRejectedValue({ message: "wanted_not_found" }),
    });
    const result = await new WantedPosterService(repo).withdraw(actor, publicId);
    expect(result).toMatchObject({ ok: false, code: "WANTED_NOT_FOUND" });
  });

  it("does not leak database errors", async () => {
    const repo = repository({
      withdrawWanted: vi.fn().mockRejectedValue({ message: "connection reset by peer" }),
    });
    const result = await new WantedPosterService(repo).withdraw(actor, publicId);
    expect(result).toEqual({
      ok: false,
      code: "MARKETPLACE_UNAVAILABLE",
      message: "This Wanted could not be withdrawn. Try again.",
    });
  });

  it("requires a signed-in, unrestricted poster and a well-formed id", async () => {
    const repo = repository();
    const service = new WantedPosterService(repo);
    expect(await service.withdraw(null, publicId)).toMatchObject({ code: "AUTH_REQUIRED" });
    expect(await service.withdraw({ ...actor, restricted: true }, publicId)).toMatchObject({
      code: "ACCOUNT_RESTRICTED",
    });
    expect(await service.edit(actor, "not-a-uuid", academicEdit)).toMatchObject({
      code: "WANTED_NOT_FOUND",
    });
    expect(await service.editableDetails(null, publicId)).toMatchObject({
      code: "AUTH_REQUIRED",
    });
    expect(repo.withdrawWanted).not.toHaveBeenCalled();
    expect(repo.updatePublishedWanted).not.toHaveBeenCalled();
  });
});
