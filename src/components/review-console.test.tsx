import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { ReviewConsole } from "./review-console";
import { aQueueItem } from "@/features/presentation/test-support/verification-queue";

const EVIDENCE_URL = "https://storage.example.test/object/sign/identity-evidence/private.pdf?t=abc";

function queueFetch(...payloads: unknown[]) {
  const mock = vi.fn();

  for (const payload of payloads) {
    mock.mockResolvedValueOnce({ ok: true, json: async () => payload });
  }

  vi.stubGlobal("fetch", mock);
  return mock;
}

function select(name = "Aisyah Rahman") {
  fireEvent.click(screen.getByRole("button", { name: new RegExp(name) }));
}

function decide(decision: "Approve" | "Reject", reasonCode = "evidence_clear") {
  fireEvent.change(screen.getByLabelText(/Reason code/), { target: { value: reasonCode } });
  fireEvent.click(screen.getByRole("button", { name: decision }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test("lists each pending request with who and where it came from", () => {
  render(
    <ReviewConsole
      items={[aQueueItem(), aQueueItem({ requestId: "b", applicantDisplayName: "Lim Wei" })]}
    />,
  );

  const queue = screen.getByRole("list", { name: /verification requests/i });

  expect(within(queue).getByText(/Aisyah Rahman/)).toBeInTheDocument();
  expect(within(queue).getByText(/Lim Wei/)).toBeInTheDocument();
  expect(within(queue).getAllByText(/UiTM Shah Alam/).length).toBeGreaterThan(0);
});

test("names the queue with its size so its scale is known without traversing it", () => {
  render(<ReviewConsole items={[aQueueItem(), aQueueItem({ requestId: "b" })]} />);

  expect(
    screen.getByRole("list", { name: "Verification requests, 2 waiting" }),
  ).toBeInTheDocument();
});

test("reports an empty queue rather than showing a blank panel", () => {
  render(<ReviewConsole items={[]} />);

  expect(screen.getByText(/no requests are waiting/i)).toBeInTheDocument();
});

/**
 * The queue contract carries no storage key, and none may be invented. A
 * reviewer's screen is a place someone else's identity document could leak.
 */
test("renders no storage path anywhere in the queue", () => {
  const { container } = render(<ReviewConsole items={[aQueueItem()]} />);

  expect(container.innerHTML).not.toMatch(/identity-evidence/);
  expect(container.innerHTML).not.toMatch(/objectPath|object_path/);
});

/**
 * Rendering twenty rows must not mint twenty signed URLs to twenty identity
 * documents. The URL is requested only when a reviewer opens the viewer.
 */
test("mints no evidence URL until a reviewer asks for one", () => {
  const fetchMock = queueFetch();

  render(<ReviewConsole items={[aQueueItem()]} />);
  select();

  expect(fetchMock).not.toHaveBeenCalled();
});

test("requests the evidence URL by request id alone", async () => {
  const fetchMock = queueFetch({
    ok: true,
    data: { signedUrl: EVIDENCE_URL, expiresAt: "2026-09-14T10:05:00.000Z" },
  });

  render(<ReviewConsole items={[aQueueItem()]} />);
  select();
  fireEvent.click(screen.getByRole("button", { name: /view the evidence/i }));

  await screen.findByRole("dialog");

  expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/identity/verification-requests/evidence-url");
  expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
    requestId: aQueueItem().requestId,
  });
});

test("never shows the signed evidence URL as text", async () => {
  queueFetch({
    ok: true,
    data: { signedUrl: EVIDENCE_URL, expiresAt: "2026-09-14T10:05:00.000Z" },
  });

  render(<ReviewConsole items={[aQueueItem()]} />);
  select();
  fireEvent.click(screen.getByRole("button", { name: /view the evidence/i }));

  const dialog = await screen.findByRole("dialog");

  expect(dialog.textContent ?? "").not.toContain(EVIDENCE_URL);
  expect(dialog.textContent ?? "").not.toContain("identity-evidence");
});

test("drops the evidence URL when the viewer is closed", async () => {
  queueFetch({
    ok: true,
    data: { signedUrl: EVIDENCE_URL, expiresAt: "2026-09-14T10:05:00.000Z" },
  });

  const { container } = render(<ReviewConsole items={[aQueueItem()]} />);
  select();
  fireEvent.click(screen.getByRole("button", { name: /view the evidence/i }));

  await screen.findByRole("dialog");
  fireEvent.click(screen.getByRole("button", { name: /close/i }));

  await waitFor(() => {
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  expect(container.innerHTML).not.toContain(EVIDENCE_URL);
});

test("returns focus to the control that opened the viewer", async () => {
  queueFetch({
    ok: true,
    data: { signedUrl: EVIDENCE_URL, expiresAt: "2026-09-14T10:05:00.000Z" },
  });

  render(<ReviewConsole items={[aQueueItem()]} />);
  select();

  const trigger = screen.getByRole("button", { name: /view the evidence/i });
  trigger.focus();
  fireEvent.click(trigger);

  await screen.findByRole("dialog");
  fireEvent.click(screen.getByRole("button", { name: /close/i }));

  await waitFor(() => {
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /view the evidence/i }));
  });
});

test("explains expired evidence instead of opening an empty viewer", async () => {
  queueFetch({
    ok: false,
    code: "EVIDENCE_EXPIRED",
    message: "This evidence is no longer available.",
  });

  render(<ReviewConsole items={[aQueueItem()]} />);
  select();
  fireEvent.click(screen.getByRole("button", { name: /view the evidence/i }));

  expect(await screen.findByText(/no longer available/i)).toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("asks for re-authentication before showing someone else's document", async () => {
  queueFetch({
    ok: false,
    code: "RECENT_AUTH_REQUIRED",
    message: "Sign in again before viewing this evidence.",
  });

  render(<ReviewConsole items={[aQueueItem()]} />);
  select();
  fireEvent.click(screen.getByRole("button", { name: /view the evidence/i }));

  expect(await screen.findByRole("heading", { name: "Confirm it is you" })).toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("refuses evidence outside the reviewer's institution", async () => {
  queueFetch({
    ok: false,
    code: "NOT_AUTHORIZED",
    message: "You are not authorised to view this evidence.",
  });

  render(<ReviewConsole items={[aQueueItem()]} />);
  select();
  fireEvent.click(screen.getByRole("button", { name: /view the evidence/i }));

  expect(await screen.findByText(/not authorised/i)).toBeInTheDocument();
});

/**
 * The reason-code catalogue is still an open question in the tracker, so the
 * screen must not present an invented list as approved values. It takes the
 * code the reviewer enters and validates only the shape the operation accepts.
 */
test("requires a reason code for a decision", async () => {
  const fetchMock = queueFetch();

  render(<ReviewConsole items={[aQueueItem()]} />);
  select();
  fireEvent.click(screen.getByRole("button", { name: "Approve" }));

  expect(await screen.findByText(/enter a reason code/i)).toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
});

test("rejects a reason code the operation would not accept", async () => {
  const fetchMock = queueFetch();

  render(<ReviewConsole items={[aQueueItem()]} />);
  select();
  decide("Approve", "Not A Code!");

  expect(await screen.findByText(/remove spaces, capitals and punctuation/i)).toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
});

/**
 * A decision grants or withholds the ability to transact, so it is confirmed
 * with its consequences before anything is sent.
 */
test("summarises the consequence and sends nothing until it is confirmed", async () => {
  const fetchMock = queueFetch();

  render(<ReviewConsole items={[aQueueItem()]} />);
  select();
  decide("Approve");

  expect(
    await screen.findByText(/permits funding a bounty, submitting a claim/i),
  ).toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
});

test("submits an approval with the identifiers the queue supplied", async () => {
  const fetchMock = queueFetch({ ok: true, data: { status: "approved" } });

  render(<ReviewConsole items={[aQueueItem()]} />);
  select();
  decide("Approve");
  fireEvent.click(screen.getByRole("button", { name: /confirm approval/i }));

  await screen.findByText(/request approved/i);

  expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/identity/verification-requests/review");
  expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
    requestId: aQueueItem().requestId,
    institutionId: aQueueItem().institutionId,
    decision: "approved",
    reasonCode: "evidence_clear",
  });
});

test("submits a rejection with its own reason code", async () => {
  const fetchMock = queueFetch({ ok: true, data: { status: "rejected" } });

  render(<ReviewConsole items={[aQueueItem()]} />);
  select();
  decide("Reject", "evidence_unreadable");
  fireEvent.click(screen.getByRole("button", { name: /confirm rejection/i }));

  await screen.findByText(/request rejected/i);

  expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
    decision: "rejected",
    reasonCode: "evidence_unreadable",
  });
});

test("removes a decided request from the queue", async () => {
  queueFetch({ ok: true, data: { status: "approved" } });

  render(<ReviewConsole items={[aQueueItem()]} />);
  select();
  decide("Approve");
  fireEvent.click(screen.getByRole("button", { name: /confirm approval/i }));

  await screen.findByText(/request approved/i);

  expect(screen.queryByRole("button", { name: /Aisyah Rahman/ })).not.toBeInTheDocument();
});

test("announces a decision politely without repeating the visible sentence", async () => {
  queueFetch({ ok: true, data: { status: "approved" } });

  render(<ReviewConsole items={[aQueueItem()]} />);
  select();
  decide("Approve");
  fireEvent.click(screen.getByRole("button", { name: /confirm approval/i }));

  const announcer = await screen.findByTestId("review-announcer");

  await waitFor(() => {
    expect(announcer).toHaveTextContent(/approval recorded/i);
  });
  expect(announcer).toHaveAttribute("aria-live", "polite");
});

/**
 * A recorded human approval is the only thing that grants an entitlement, so
 * the screen must not paint the outcome before the write lands.
 */
test("does not claim a decision while it is still in flight", async () => {
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const mock = vi.fn().mockImplementationOnce(async () => {
    await held;
    return { ok: true, json: async () => ({ ok: true, data: { status: "approved" } }) };
  });
  vi.stubGlobal("fetch", mock);

  render(<ReviewConsole items={[aQueueItem()]} />);
  select();
  decide("Approve");

  const confirm = screen.getByRole("button", { name: /confirm approval/i });
  confirm.focus();
  fireEvent.click(confirm);

  await waitFor(() => {
    expect(screen.getByRole("button", { name: /confirm approval/i })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  expect(screen.queryByText(/request approved/i)).not.toBeInTheDocument();
  expect(screen.getByText("Recording your decision")).toBeInTheDocument();
  const inFlight = screen.getByRole("button", { name: /confirm approval/i });
  expect(inFlight).not.toBeDisabled();
  expect(document.activeElement).toBe(inFlight);

  release();
  await screen.findByText(/request approved/i);
});

test("guards the decision handler against repeat activation", async () => {
  const fetchMock = queueFetch({ ok: true, data: { status: "approved" } });

  render(<ReviewConsole items={[aQueueItem()]} />);
  select();
  decide("Approve");

  const confirm = screen.getByRole("button", { name: /confirm approval/i });
  fireEvent.click(confirm);
  fireEvent.click(confirm);
  fireEvent.click(confirm);

  await screen.findByText(/request approved/i);

  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("explains that another Sheriff already decided a stale request", async () => {
  queueFetch({
    ok: false,
    code: "VERIFICATION_CONFLICT",
    message: "The verification request was already decided.",
  });

  render(<ReviewConsole items={[aQueueItem()]} />);
  select();
  decide("Approve");
  fireEvent.click(screen.getByRole("button", { name: /confirm approval/i }));

  expect(await screen.findByText(/already decided/i)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /refresh the queue/i })).toBeInTheDocument();
});

test("explains a request that no longer exists", async () => {
  queueFetch({
    ok: false,
    code: "REQUEST_NOT_FOUND",
    message: "The verification request was not found.",
  });

  render(<ReviewConsole items={[aQueueItem()]} />);
  select();
  decide("Approve");
  fireEvent.click(screen.getByRole("button", { name: /confirm approval/i }));

  expect(await screen.findByText(/was not found/i)).toBeInTheDocument();
});

/**
 * Losing a reviewer's reasoning because a fifteen-minute window lapsed invites
 * shorter reasons next time.
 */
test("keeps the decision and reason across a re-authentication refusal", async () => {
  queueFetch({
    ok: false,
    code: "RECENT_AUTH_REQUIRED",
    message: "Sign in again before completing this review.",
  });

  render(<ReviewConsole items={[aQueueItem()]} />);
  select();
  decide("Approve", "evidence_clear");
  fireEvent.click(screen.getByRole("button", { name: /confirm approval/i }));

  expect(await screen.findByRole("heading", { name: "Confirm it is you" })).toBeInTheDocument();
  expect(screen.getByLabelText(/Reason code/)).toHaveValue("evidence_clear");
  expect(screen.getByRole("button", { name: /confirm approval/i })).toBeInTheDocument();
});

test("keeps the evidence privacy and affiliation disclaimers visible to the reviewer", () => {
  render(<ReviewConsole items={[aQueueItem()]} />);
  select();

  expect(screen.getByRole("note", { name: /how this evidence is handled/i })).toHaveTextContent(
    /deleted/i,
  );
  expect(screen.getByText(/affiliation only/i)).toBeInTheDocument();
});

test("never queues more than one interrupting announcement", async () => {
  queueFetch({
    ok: false,
    code: "VERIFICATION_CONFLICT",
    message: "The verification request was already decided.",
  });

  render(<ReviewConsole items={[aQueueItem()]} />);
  select();
  decide("Approve");
  fireEvent.click(screen.getByRole("button", { name: /confirm approval/i }));

  await screen.findByText(/already decided/i);

  // At most one, not exactly one: a stale request is reported as `expired`,
  // which announces politely because nothing is interrupting the reviewer.
  expect(screen.queryAllByRole("alert").length).toBeLessThanOrEqual(1);
});

test("reports a stale request politely rather than as an interruption", async () => {
  queueFetch({
    ok: false,
    code: "VERIFICATION_CONFLICT",
    message: "The verification request was already decided.",
  });

  render(<ReviewConsole items={[aQueueItem()]} />);
  select();
  decide("Approve");
  fireEvent.click(screen.getByRole("button", { name: /confirm approval/i }));

  const stale = await screen.findByText(/already decided/i);

  expect(stale.closest("[role='status']")).not.toBeNull();
});

test("announces a failed decision as an interruption, since the reviewer must act", async () => {
  queueFetch({
    ok: false,
    code: "AUTH_UNAVAILABLE",
    message: "Identity is unavailable right now.",
  });

  render(<ReviewConsole items={[aQueueItem()]} />);
  select();
  decide("Approve");
  fireEvent.click(screen.getByRole("button", { name: /confirm approval/i }));

  await screen.findByText(/unavailable right now/i);

  expect(screen.getAllByRole("alert")).toHaveLength(1);
});

test("asks for the password in place when the 15-minute step-up lapses, then opens the evidence", async () => {
  const fetchMock = queueFetch(
    {
      ok: false,
      code: "RECENT_AUTH_REQUIRED",
      message: "Sign in again before viewing this evidence.",
    },
    { ok: true, data: { next: "profile" } },
    { ok: true, data: { signedUrl: EVIDENCE_URL, expiresAt: "2026-09-14T10:05:00.000Z" } },
  );

  render(<ReviewConsole items={[aQueueItem()]} />);
  select();
  fireEvent.click(screen.getByRole("button", { name: /view the evidence/i }));

  expect(await screen.findByText(/You are still signed in/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "hunter2-secret" } });
  fireEvent.click(screen.getByRole("button", { name: "Confirm and continue" }));

  await screen.findByRole("dialog");
  expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/auth/reauthenticate");
  expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
    password: "hunter2-secret",
  });
});

test("says the password is wrong without leaving the page", async () => {
  queueFetch(
    { ok: false, code: "RECENT_AUTH_REQUIRED", message: "" },
    { ok: false, code: "INVALID_CREDENTIALS", message: "" },
  );

  render(<ReviewConsole items={[aQueueItem()]} />);
  select();
  fireEvent.click(screen.getByRole("button", { name: /view the evidence/i }));
  fireEvent.change(await screen.findByLabelText("Password"), { target: { value: "wrong" } });
  fireEvent.click(screen.getByRole("button", { name: "Confirm and continue" }));

  expect(await screen.findByText("That password is not correct.")).toBeInTheDocument();
});
