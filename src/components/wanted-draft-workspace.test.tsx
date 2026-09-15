import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { WantedDraftWorkspace } from "./wanted-draft-workspace";
import type {
  CreateWantedDraftResult,
  MarketplaceOperationCode,
  PrepareWantedPublicationResult,
  SuggestWantedDuplicatesResult,
  WantedDuplicateSuggestion,
} from "@/contracts/marketplace";
import { aTaxonomy, TAXONOMY_ID } from "@/features/marketplace/test-support/taxonomy";
import { aWanted } from "@/features/marketplace/test-support/wanted";

const saveWantedDraft = vi.hoisted(() => vi.fn());
const checkWantedDuplicates = vi.hoisted(() => vi.fn());
const requestWantedPublication = vi.hoisted(() => vi.fn());

vi.mock("@/features/marketplace/draft-operations", () => ({
  saveWantedDraft,
  checkWantedDuplicates,
  requestWantedPublication,
}));

const DRAFT_ID = "6d0f2b1a-7a6f-4a2a-9f3c-6e6f2e0f5a11";
const TOKEN = "nonce.signature";

function savedDraft(): CreateWantedDraftResult {
  return {
    ok: true,
    data: {
      id: DRAFT_ID,
      state: "draft",
      updatedAt: "2026-09-15T09:00:00.000Z",
      values: {} as never,
    },
  };
}

function checked(suggestions: WantedDuplicateSuggestion[] = []): SuggestWantedDuplicatesResult {
  return {
    ok: true,
    data: { token: TOKEN, expiresAt: "2026-09-15T09:15:00.000Z", suggestions },
  };
}

function refused(
  code: MarketplaceOperationCode,
  message: string,
  fieldErrors?: Record<string, string[]>,
): CreateWantedDraftResult & PrepareWantedPublicationResult & SuggestWantedDuplicatesResult {
  return (
    fieldErrors === undefined
      ? { ok: false, code, message }
      : { ok: false, code, message, fieldErrors }
  ) as never;
}

beforeEach(() => {
  saveWantedDraft.mockReset().mockResolvedValue(savedDraft());
  checkWantedDuplicates.mockReset().mockResolvedValue(checked());
  requestWantedPublication
    .mockReset()
    .mockResolvedValue(
      refused("PAYMENT_DISABLED", "Payments are currently disabled; your draft remains editable."),
    );
});

function renderWorkspace(mode: "live" | "preview" = "live") {
  return render(<WantedDraftWorkspace taxonomy={aTaxonomy()} mode={mode} />);
}

function set(label: string | RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function review() {
  fireEvent.click(screen.getByRole("button", { name: /^Review request/ }));
}

/** Fills every field with a draft that should pass validation. */
function fillValidDraft() {
  set(/^Title/, "Final exam notes for the whole syllabus");
  set(/^Campus/, TAXONOMY_ID.campus);
  set(/^Faculty or college/, TAXONOMY_ID.faculty);
  set(/^Programme/, TAXONOMY_ID.programme);
  set(/^Course/, TAXONOMY_ID.course);
  set(/^Academic session/, TAXONOMY_ID.session);
  set(/^Resource type/, TAXONOMY_ID.resourceType);
  set(/^Language/, TAXONOMY_ID.language);
  set(
    /^What the resource needs to cover/,
    "Complete notes covering every chapter, with the key diagrams and worked examples.",
  );
  fireEvent.click(screen.getByRole("radio", { name: /14 days/ }));
  set(/^Your first contribution/, "12.50");
  fireEvent.click(screen.getByRole("checkbox", { name: /content policy/i }));
}

async function reachReview() {
  fillValidDraft();
  review();
  await screen.findByRole("heading", { name: "Review your request" });
}

describe("the intake form", () => {
  test("asks for every part of the request", () => {
    renderWorkspace();

    for (const label of [
      /^Title/,
      /^Campus/,
      /^Faculty or college/,
      /^Programme/,
      /^Course/,
      /^Academic session/,
      /^Resource type/,
      /^Language/,
      /^What the resource needs to cover/,
      /^Your first contribution/,
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }

    expect(screen.getByRole("group", { name: /How long/ })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /Tags/ })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /content policy/i })).toBeInTheDocument();
  });

  test("offers exactly the three approved durations", () => {
    renderWorkspace();

    const duration = screen.getByRole("group", { name: /How long/ });

    expect(within(duration).getAllByRole("radio")).toHaveLength(3);
  });

  test("narrows programme by faculty and course by programme", () => {
    renderWorkspace();

    expect(within(screen.getByLabelText(/^Programme/)).getAllByRole("option")).toHaveLength(1);

    set(/^Faculty or college/, TAXONOMY_ID.faculty);

    expect(within(screen.getByLabelText(/^Programme/)).getAllByRole("option")).toHaveLength(2);
    expect(within(screen.getByLabelText(/^Course/)).getAllByRole("option")).toHaveLength(1);

    set(/^Programme/, TAXONOMY_ID.programme);

    expect(within(screen.getByLabelText(/^Course/)).getAllByRole("option")).toHaveLength(2);
  });

  test("clears a programme and course that no longer belong when the faculty changes", () => {
    renderWorkspace();

    set(/^Faculty or college/, TAXONOMY_ID.faculty);
    set(/^Programme/, TAXONOMY_ID.programme);
    set(/^Course/, TAXONOMY_ID.course);
    set(/^Faculty or college/, TAXONOMY_ID.otherFaculty);

    expect(screen.getByLabelText(/^Programme/)).toHaveValue("");
    expect(screen.getByLabelText(/^Course/)).toHaveValue("");
  });

  test("names the course by the code a student searches for", () => {
    renderWorkspace();

    set(/^Faculty or college/, TAXONOMY_ID.faculty);
    set(/^Programme/, TAXONOMY_ID.programme);

    expect(
      within(screen.getByLabelText(/^Course/)).getByRole("option", {
        name: "CSC510 Database Systems",
      }),
    ).toBeInTheDocument();
  });

  test("says the options are reviewed institutional records, not invented ones", () => {
    renderWorkspace();

    expect(screen.getByText(/reviewed institutional records/i)).toBeInTheDocument();
  });

  test("never claims the harness options are reviewed institutional records", () => {
    renderWorkspace("preview");

    expect(screen.queryByText(/reviewed institutional records/i)).not.toBeInTheDocument();
    expect(screen.getByText(/not a reviewed institutional catalogue/i)).toBeInTheDocument();
  });
});

describe("local validation before anything is sent", () => {
  test("summarises the failures and takes focus to the summary", async () => {
    renderWorkspace();
    review();

    const summary = await screen.findByRole("alert");

    expect(summary).toHaveTextContent("There is a problem");
    await waitFor(() => expect(summary).toHaveFocus());
  });

  test("sends nothing to the server when the form is incomplete", async () => {
    renderWorkspace();
    review();

    await screen.findByRole("alert");

    expect(saveWantedDraft).not.toHaveBeenCalled();
    expect(checkWantedDuplicates).not.toHaveBeenCalled();
  });

  test("keeps everything already entered", async () => {
    renderWorkspace();
    set(/^Title/, "Past year answers with working");
    review();

    await screen.findByRole("alert");

    expect(screen.getByLabelText(/^Title/)).toHaveValue("Past year answers with working");
  });

  test("renders exactly one alerting region", async () => {
    renderWorkspace();
    review();

    await screen.findByRole("alert");

    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });
});

describe("persisting the draft", () => {
  test("creates the draft through the published operation on the first review", async () => {
    renderWorkspace();
    await reachReview();

    expect(saveWantedDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Final exam notes for the whole syllabus",
        courseId: TAXONOMY_ID.course,
        academicSessionId: TAXONOMY_ID.session,
        durationDays: 14,
        policyAccepted: true,
      }),
      null,
    );
  });

  test("sends no money with the draft, because a draft holds none", async () => {
    renderWorkspace();
    await reachReview();

    const [input] = saveWantedDraft.mock.calls[0] as [Record<string, unknown>, string | null];

    expect(input).not.toHaveProperty("contributionSen");
    expect(input).not.toHaveProperty("initialContributionSen");
  });

  test("updates the same draft rather than creating a second one", async () => {
    renderWorkspace();
    await reachReview();

    fireEvent.click(screen.getByRole("button", { name: "Back to edit" }));
    set(/^Title/, "Final exam notes with every worked example");
    review();

    await screen.findByRole("heading", { name: "Review your request" });

    expect(saveWantedDraft).toHaveBeenLastCalledWith(expect.anything(), DRAFT_ID);
  });

  test("reports a server field error against the control that must change", async () => {
    saveWantedDraft.mockResolvedValue(
      refused("VALIDATION_ERROR", "Check the highlighted Wanted details.", {
        title: ["Title is already used by another draft"],
      }),
    );
    renderWorkspace();
    fillValidDraft();
    review();

    const summary = await screen.findByRole("alert");

    expect(
      within(summary).getByRole("link", { name: "Title is already used by another draft" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Review your request" })).not.toBeInTheDocument();
  });

  test("keeps a whole-selection refusal it cannot attach to one control", async () => {
    saveWantedDraft.mockResolvedValue(
      refused("VALIDATION_ERROR", "Choose active catalogue values.", {
        taxonomy: ["One or more selections are unavailable or do not belong together."],
      }),
    );
    renderWorkspace();
    fillValidDraft();
    review();

    const summary = await screen.findByRole("alert");

    expect(summary).toHaveTextContent(/do not belong together/);
  });

  test("keeps every entered value when the server refuses the draft", async () => {
    saveWantedDraft.mockResolvedValue(
      refused("VALIDATION_ERROR", "Check it.", { title: ["Too short"] }),
    );
    renderWorkspace();
    fillValidDraft();
    review();

    await screen.findByRole("alert");

    expect(screen.getByLabelText(/^Title/)).toHaveValue("Final exam notes for the whole syllabus");
    expect(screen.getByLabelText(/^Your first contribution/)).toHaveValue("12.50");
    expect(screen.getByRole("checkbox", { name: /content policy/i })).toBeChecked();
  });

  test.each([
    ["AUTH_REQUIRED", /sign in/i],
    ["EMAIL_NOT_VERIFIED", /verify your email/i],
    ["INSTITUTION_VERIFICATION_REQUIRED", /institution/i],
    ["ACCOUNT_RESTRICTED", /restricted/i],
    ["NOT_AUTHORIZED", /permission/i],
  ] as const)("refuses honestly when the account is not eligible: %s", async (code, wording) => {
    saveWantedDraft.mockResolvedValue(refused(code, ""));
    renderWorkspace();
    fillValidDraft();
    review();

    const alert = await screen.findByRole("alert");

    expect(alert).toHaveTextContent(wording);
    expect(screen.queryByRole("heading", { name: "Review your request" })).not.toBeInTheDocument();
  });

  test("says the workspace is unavailable rather than blaming the draft", async () => {
    saveWantedDraft.mockResolvedValue(refused("MARKETPLACE_UNAVAILABLE", ""));
    renderWorkspace();
    fillValidDraft();
    review();

    expect(await screen.findByText(/unavailable right now/i)).toBeInTheDocument();
  });

  test("says a draft that can no longer be edited has moved on", async () => {
    saveWantedDraft.mockResolvedValue(
      refused("DRAFT_NOT_EDITABLE", "This Wanted can no longer be edited as a draft."),
    );
    renderWorkspace();
    fillValidDraft();
    review();

    expect(await screen.findByText(/no longer be edited as a draft/i)).toBeInTheDocument();
  });

  test("announces progress without repeating the visible refusal", async () => {
    renderWorkspace();
    await reachReview();

    expect(screen.getByTestId("draft-announcer")).toHaveAttribute("aria-live", "polite");
  });

  test("ignores a second review while one is still in flight", async () => {
    let release: (value: CreateWantedDraftResult) => void = () => {};
    saveWantedDraft.mockReturnValue(
      new Promise<CreateWantedDraftResult>((resolve) => {
        release = resolve;
      }),
    );
    renderWorkspace();
    fillValidDraft();
    review();
    review();

    release(savedDraft());
    await screen.findByRole("heading", { name: "Review your request" });

    expect(saveWantedDraft).toHaveBeenCalledTimes(1);
  });
});

describe("checking for similar requests", () => {
  test("runs the server check for the saved draft before review is shown", async () => {
    renderWorkspace();
    await reachReview();

    expect(checkWantedDuplicates).toHaveBeenCalledWith(DRAFT_ID);
  });

  test("says nothing looks similar when the server found nothing", async () => {
    renderWorkspace();
    await reachReview();

    expect(screen.getByText(/No published request looks like yours/i)).toBeInTheDocument();
  });

  test("shows what the server ranked as similar, and why", async () => {
    checkWantedDuplicates.mockResolvedValue(
      checked([
        {
          wanted: aWanted({ id: "csc510-past-year", title: "Past year questions" }),
          reasons: ["same_course", "similar_title"],
        },
      ]),
    );
    renderWorkspace();
    await reachReview();

    const list = screen.getByRole("list", { name: "Requests that already look similar" });

    expect(within(list).getByRole("link", { name: "Past year questions" })).toHaveAttribute(
      "href",
      "/wanted/csc510-past-year",
    );
    expect(within(list).getByText(/same course/i)).toBeInTheDocument();
    expect(screen.getByText(/advisory and does not stop you/i)).toBeInTheDocument();
  });

  test("offers the route that resolves a refusal the check itself reported", async () => {
    checkWantedDuplicates.mockResolvedValue(refused("ACCOUNT_RESTRICTED", ""));
    renderWorkspace();
    fillValidDraft();
    review();

    const alert = await screen.findByRole("alert");

    expect(alert).toHaveTextContent(/draft is saved/i);
    expect(alert).toHaveTextContent(/restricted/i);
    expect(within(alert).getByRole("link", { name: "Open your profile" })).toHaveAttribute(
      "href",
      "/profile",
    );
  });

  test("keeps the saved draft when the check itself fails, and says so", async () => {
    checkWantedDuplicates.mockResolvedValue(refused("MARKETPLACE_UNAVAILABLE", ""));
    renderWorkspace();
    fillValidDraft();
    review();

    const alert = await screen.findByRole("alert");

    expect(alert).toHaveTextContent(/draft (is|has been) saved/i);
    expect(screen.queryByRole("heading", { name: "Review your request" })).not.toBeInTheDocument();
  });
});

describe("asking to publish", () => {
  test("carries the server's opaque token and the contribution in integer sen", async () => {
    renderWorkspace();
    await reachReview();

    fireEvent.click(screen.getByRole("button", { name: /Continue to payment/ }));

    await waitFor(() =>
      expect(requestWantedPublication).toHaveBeenCalledWith(DRAFT_ID, TOKEN, 1250),
    );
  });

  test("refuses honestly when payments are switched off", async () => {
    renderWorkspace();
    await reachReview();

    fireEvent.click(screen.getByRole("button", { name: /Continue to payment/ }));

    expect(
      await screen.findByRole("heading", { name: /Payments are switched off/i }),
    ).toBeVisible();
    expect(screen.getByText(/have not been charged/i)).toBeInTheDocument();
    expect(screen.getByText(/draft is saved and still editable/i)).toBeInTheDocument();
  });

  test("refuses honestly when payment cannot be prepared", async () => {
    requestWantedPublication.mockResolvedValue(
      refused("PAYMENT_UNAVAILABLE", "Payment preparation is temporarily unavailable."),
    );
    renderWorkspace();
    await reachReview();

    fireEvent.click(screen.getByRole("button", { name: /Continue to payment/ }));

    expect(
      await screen.findByRole("heading", { name: /Payment could not be prepared/i }),
    ).toBeVisible();
    expect(screen.getByText(/have not been charged/i)).toBeInTheDocument();
  });

  test.each(["PAYMENT_DISABLED", "PAYMENT_UNAVAILABLE"] as const)(
    "never claims a payment, a publication or an open Wanted: %s",
    async (code) => {
      requestWantedPublication.mockResolvedValue(refused(code, ""));
      renderWorkspace();
      await reachReview();

      fireEvent.click(screen.getByRole("button", { name: /Continue to payment/ }));
      await screen.findByRole("heading", { name: /Payment/i });

      const text = document.body.textContent ?? "";

      expect(text).not.toMatch(/successfully|payment (received|complete|confirmed)/i);
      expect(text).not.toMatch(/your request is (live|open|published)/i);
      expect(text).not.toMatch(/\bpaid\b/i);
    },
  );

  test("asks for a fresh check when the token is no longer usable", async () => {
    requestWantedPublication.mockResolvedValue(
      refused("DUPLICATE_CHECK_EXPIRED", "Run the duplicate check again before continuing."),
    );
    renderWorkspace();
    await reachReview();

    fireEvent.click(screen.getByRole("button", { name: /Continue to payment/ }));

    expect(await screen.findByRole("button", { name: /Check again/i })).toBeVisible();
  });

  test("runs a fresh check when asked, and offers payment again", async () => {
    requestWantedPublication.mockResolvedValueOnce(refused("DUPLICATE_CHECK_REQUIRED", ""));
    renderWorkspace();
    await reachReview();

    fireEvent.click(screen.getByRole("button", { name: /Continue to payment/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Check again/i }));

    await waitFor(() => expect(checkWantedDuplicates).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("button", { name: /Continue to payment/ })).toBeVisible();
  });

  test("returns an amount the server rejects to the field that holds it", async () => {
    requestWantedPublication.mockResolvedValue(
      refused("VALIDATION_ERROR", "Check the contribution and duplicate check.", {
        initialContributionSen: ["Too small"],
      }),
    );
    renderWorkspace();
    await reachReview();

    fireEvent.click(screen.getByRole("button", { name: /Continue to payment/ }));

    const summary = await screen.findByRole("alert");

    expect(within(summary).getByRole("link", { name: "Too small" })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Your first contribution/)).toHaveValue("12.50");
  });

  test("says a payment out of range is out of range", async () => {
    requestWantedPublication.mockResolvedValue(refused("AMOUNT_OUT_OF_RANGE", ""));
    renderWorkspace();
    await reachReview();

    fireEvent.click(screen.getByRole("button", { name: /Continue to payment/ }));

    const summary = await screen.findByRole("alert");

    expect(within(summary).getByText(/between RM1 and RM50/)).toBeInTheDocument();
  });

  test("never presents an awaiting-payment draft as an open Wanted", async () => {
    requestWantedPublication.mockResolvedValue({
      ok: true,
      data: { draftId: DRAFT_ID, state: "awaiting_payment", paymentRequired: true },
    });
    renderWorkspace();
    await reachReview();

    fireEvent.click(screen.getByRole("button", { name: /Continue to payment/ }));

    expect(await screen.findByText(/no payment has been taken/i)).toBeInTheDocument();
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/your request is (live|open|published)/i);
  });

  test("ignores a second publication request while one is in flight", async () => {
    let release: (value: PrepareWantedPublicationResult) => void = () => {};
    requestWantedPublication.mockReturnValue(
      new Promise<PrepareWantedPublicationResult>((resolve) => {
        release = resolve;
      }),
    );
    renderWorkspace();
    await reachReview();

    fireEvent.click(screen.getByRole("button", { name: /Continue to payment/ }));
    fireEvent.click(screen.getByRole("button", { name: /Continue to payment/ }));

    release(refused("PAYMENT_DISABLED", ""));
    await screen.findByRole("heading", { name: /Payments are switched off/i });

    expect(requestWantedPublication).toHaveBeenCalledTimes(1);
  });
});

describe("the review sheet", () => {
  test("shows the money, the fee and the access basis in plain English", async () => {
    renderWorkspace();
    await reachReview();

    expect(screen.getByText("Your first contribution RM 12.50")).toBeInTheDocument();
    expect(screen.getByText(/10% platform fee/)).toBeInTheDocument();
    expect(screen.getByText(/contributors only/i)).toBeInTheDocument();
  });

  test("returns to the form with every value preserved", async () => {
    renderWorkspace();
    await reachReview();

    fireEvent.click(screen.getByRole("button", { name: "Back to edit" }));

    expect(screen.getByLabelText(/^Title/)).toHaveValue("Final exam notes for the whole syllabus");
    expect(screen.getByLabelText(/^Course/)).toHaveValue(TAXONOMY_ID.course);
    expect(screen.getByLabelText(/^Your first contribution/)).toHaveValue("12.50");
    expect(screen.getByRole("radio", { name: /14 days/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /content policy/i })).toBeChecked();
  });

  test("accepts no file on this screen", async () => {
    renderWorkspace();
    await reachReview();

    expect(document.querySelectorAll('input[type="file"]')).toHaveLength(0);
  });
});

describe("the development preview harness", () => {
  test("creates, checks and pays nothing", async () => {
    renderWorkspace("preview");
    fillValidDraft();
    review();

    await screen.findByRole("heading", { name: "Review your request" });

    expect(saveWantedDraft).not.toHaveBeenCalled();
    expect(checkWantedDuplicates).not.toHaveBeenCalled();
    expect(requestWantedPublication).not.toHaveBeenCalled();
  });

  test("says plainly that nothing was saved, checked or paid", async () => {
    renderWorkspace("preview");
    fillValidDraft();
    review();

    await screen.findByRole("heading", { name: "Review your request" });

    expect(
      screen.getByText(/No draft, duplicate check, contribution or payment has been created/i),
    ).toBeInTheDocument();
  });

  test("offers no control that would look like publishing or paying", async () => {
    renderWorkspace("preview");
    fillValidDraft();
    review();

    await screen.findByRole("heading", { name: "Review your request" });

    for (const name of [/Continue to payment/i, /publish/i, /^pay/i, /checkout/i, /save draft/i]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
  });
});
