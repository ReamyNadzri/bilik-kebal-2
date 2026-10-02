import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { WantedEditableDetails } from "@/contracts/marketplace";
import { toSen } from "@/features/marketplace/money";
import { aTaxonomy, TAXONOMY_ID } from "@/features/marketplace/test-support/taxonomy";
import { WantedPosterControls, type WantedPosterControlsProps } from "./wanted-poster-controls";

const refresh = vi.hoisted(() => vi.fn());
const replace = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, replace }) }));

const now = "2026-09-28T10:20:00.000Z";
const taxonomy = aTaxonomy();
const academicDetails: WantedEditableDetails = {
  kind: "academic",
  title: "Past year papers for CSC510",
  description: "Any past year final papers from 2022 onwards, with or without answers.",
  campusId: TAXONOMY_ID.campus,
  facultyId: TAXONOMY_ID.faculty,
  programmeId: TAXONOMY_ID.programme,
  courseCode: "CSC510",
  academicSessionId: null,
  resourceTypeId: TAXONOMY_ID.resourceType,
  languageId: TAXONOMY_ID.language,
  lastSeenLocation: null,
  tagIds: [TAXONOMY_ID.tag],
};
const missingItemDetails: WantedEditableDetails = {
  kind: "missing_item",
  title: "Missing blue water bottle",
  description: "Left it somewhere near the library on Monday.",
  campusId: TAXONOMY_ID.campus,
  facultyId: null,
  programmeId: null,
  courseCode: null,
  academicSessionId: null,
  resourceTypeId: null,
  languageId: null,
  lastSeenLocation: "Library level 2",
  tagIds: [],
};
const props: WantedPosterControlsProps = {
  wantedId: "11111111-1111-4111-8111-111111111111",
  editable: academicDetails,
  taxonomy,
  isFree: false,
  grossBountySen: toSen(15),
  backerCount: 2,
  window: { editableUntil: "2026-09-28T11:00:00.000Z", lockedReason: null },
  now,
};

function renderControls(overrides: Partial<WantedPosterControlsProps> = {}) {
  return render(<WantedPosterControls {...props} {...overrides} />);
}

function respond(body: unknown, status = 200) {
  return vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response(JSON.stringify(body), { status }));
}

function lastPatchBody(fetch: ReturnType<typeof respond>): Record<string, unknown> {
  const [, init] = fetch.mock.calls.at(-1)!;
  return JSON.parse(String(init?.body)) as Record<string, unknown>;
}

afterEach(() => {
  vi.restoreAllMocks();
  refresh.mockClear();
  replace.mockClear();
});

describe("WantedPosterControls", () => {
  it("shows the minutes left while the window is open", () => {
    renderControls();
    expect(screen.getByText(/40 minutes/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Withdraw" })).toBeInTheDocument();
  });

  it.each([
    ["claim_submitted", /A Hunter has submitted a claim/],
    ["reply_received", /Someone has replied/],
    ["window_closed", /first hour after publishing only/],
  ] as const)("explains the %s lock and offers no actions", (lockedReason, copy) => {
    renderControls({ window: { ...props.window, lockedReason } });
    expect(screen.getByText(copy)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Withdraw" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("locks itself once the hour has passed on the page's clock", () => {
    renderControls({ now: "2026-09-28T11:00:30.000Z" });
    expect(screen.getByText(/first hour after publishing only/)).toBeInTheDocument();
  });

  it("offers no edit form when the details could not be read, but still withdrawal", () => {
    renderControls({ editable: null, taxonomy: null });
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.getByText(/could not be loaded/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Withdraw" })).toBeInTheDocument();
  });

  it("says what stays as published", () => {
    renderControls();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(
      screen.getByText(
        "You can correct the details below in the first hour. The university, bounty, duration and fee stay as published. The previous version is kept on record.",
      ),
    ).toBeInTheDocument();
  });

  it("an academic Wanted's edit shows course, campus, faculty and programme", () => {
    renderControls();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    for (const label of [
      /^Campus/,
      /^Faculty/,
      /^Programme/,
      /^Course code/,
      /^Academic session/,
      /^Resource type/,
      /^Language/,
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    expect(screen.getByLabelText(/^Course code/)).toHaveValue("CSC510");
    expect(screen.getByRole("checkbox", { name: "Final exam" })).toBeChecked();
    expect(screen.queryByLabelText(/last see/i)).not.toBeInTheDocument();
  });

  it("a missing item's edit shows campus and last seen, not course", () => {
    renderControls({ editable: missingItemDetails });
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText(/^Campus/)).toBeInTheDocument();
    expect(screen.getByLabelText(/last see/i)).toHaveValue("Library level 2");
    expect(screen.queryByLabelText(/^Course code/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Faculty/)).not.toBeInTheDocument();
  });

  it("a discussion's edit shows campus but neither course nor last seen", () => {
    renderControls({
      editable: { ...missingItemDetails, kind: "discussion", lastSeenLocation: null },
    });
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText(/^Campus/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/last see/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Course code/)).not.toBeInTheDocument();
  });

  it("the PATCH carries every field and refreshes the page", async () => {
    const fetch = respond({ ok: true, data: { state: "edited" } });
    renderControls();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText(/^Course code/), { target: { value: "mat183" } });
    fireEvent.change(screen.getByLabelText(/^Title/), {
      target: { value: "Past year papers for MAT183 (2022 to 2025)" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe(`/api/marketplace/wanted/${props.wantedId}`);
    expect(init?.method).toBe("PATCH");
    expect(lastPatchBody(fetch)).toEqual({
      title: "Past year papers for MAT183 (2022 to 2025)",
      description: academicDetails.description,
      campusId: TAXONOMY_ID.campus,
      facultyId: TAXONOMY_ID.faculty,
      programmeId: TAXONOMY_ID.programme,
      courseCode: "MAT183",
      academicSessionId: null,
      resourceTypeId: TAXONOMY_ID.resourceType,
      languageId: TAXONOMY_ID.language,
      lastSeenLocation: null,
      tagIds: [TAXONOMY_ID.tag],
    });
  });

  it("a missing item's PATCH carries the last-seen place and no academic fields", async () => {
    const fetch = respond({ ok: true, data: { state: "edited" } });
    renderControls({ editable: missingItemDetails });
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText(/last see/i), { target: { value: "Cafe" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(lastPatchBody(fetch)).toMatchObject({
      campusId: TAXONOMY_ID.campus,
      lastSeenLocation: "Cafe",
      courseCode: null,
      facultyId: null,
    });
  });

  it("changing the faculty clears a programme that is not under it", () => {
    renderControls();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const faculty = screen.getByLabelText(/^Faculty/);
    fireEvent.change(faculty, { target: { value: "Faculty of Law" } });
    fireEvent.blur(faculty);
    expect(screen.getByLabelText(/^Programme/)).toHaveValue("");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });

  it("blocks a title that is too short or an empty course code before sending anything", () => {
    const fetch = respond({ ok: true, data: { state: "edited" } });
    renderControls();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText(/^Title/), { target: { value: "Short" } });
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/^Title/), {
      target: { value: "Past year papers for CSC510" },
    });
    fireEvent.change(screen.getByLabelText(/^Course code/), { target: { value: "" } });
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("shows the server's refusal of a detail", async () => {
    respond(
      {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "One of the details no longer fits this university. Check them and save again.",
      },
      400,
    );
    renderControls();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/no longer fits this university/);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("states the refund before withdrawing, then withdraws", async () => {
    const fetch = respond({ ok: true, data: { state: "withdrawn", refundsQueued: 2 } });
    renderControls();
    fireEvent.click(screen.getByRole("button", { name: "Withdraw" }));
    const dialog = screen.getByRole("alertdialog", { name: "Withdraw this Wanted?" });
    expect(dialog).toHaveTextContent(/refund queue/);
    expect(dialog).toHaveTextContent(/2 Backers/);
    fireEvent.click(screen.getByRole("button", { name: "Withdraw this Wanted" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/profile?withdrawn=1"));
    expect(fetch.mock.calls[0]![0]).toBe(`/api/marketplace/wanted/${props.wantedId}/withdraw`);
  });

  it("shows the server's lock when a claim arrived first", async () => {
    respond(
      {
        ok: false,
        code: "WANTED_LOCKED",
        message: "A Hunter has submitted a claim, so this Wanted is locked as published.",
      },
      409,
    );
    renderControls();
    fireEvent.click(screen.getByRole("button", { name: "Withdraw" }));
    fireEvent.click(screen.getByRole("button", { name: "Withdraw this Wanted" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/submitted a claim/);
    expect(replace).not.toHaveBeenCalled();
  });
});
