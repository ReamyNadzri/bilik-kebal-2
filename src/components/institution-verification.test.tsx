import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { InstitutionVerification } from "./institution-verification";
import type { InstitutionOption } from "@/contracts";

const INSTITUTIONS: InstitutionOption[] = [
  { id: "11111111-1111-4111-8111-111111111111", name: "UiTM Shah Alam", slug: "uitm-shah-alam" },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "UiTM Puncak Alam",
    slug: "uitm-puncak-alam",
  },
];

const SIGNED_URL = "https://storage.example.test/object/upload/sign/identity-evidence/x?token=t";
const OBJECT_PATH = "00000000-0000-4000-8000-000000000001/abcd.png";

function evidenceFile(name = "student-card.png", type = "image/png") {
  return new File(["evidence-bytes"], name, { type });
}

interface JsonStep {
  json: unknown;
}

/**
 * Queues one response per fetch call, in order. The evidence path makes three
 * calls — upload URL, the direct PUT, then the request submission — so a test
 * needs to steer each independently.
 */
function queueFetch(...steps: (JsonStep | { ok: boolean })[]) {
  const mock = vi.fn();

  for (const step of steps) {
    if ("json" in step) {
      mock.mockResolvedValueOnce({ ok: true, json: async () => step.json });
    } else {
      mock.mockResolvedValueOnce({ ok: step.ok, json: async () => ({}) });
    }
  }

  vi.stubGlobal("fetch", mock);
  return mock;
}

function fillEvidenceForm() {
  fireEvent.change(screen.getByLabelText(/Institution/), {
    target: { value: INSTITUTIONS[0]?.id },
  });
  fireEvent.change(screen.getByLabelText(/Evidence of affiliation/), {
    target: { files: [evidenceFile()] },
  });
  fireEvent.click(screen.getByLabelText(/I confirm this evidence is accurate/));
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: /Request verification/ }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test("offers every active institution the backend returned", () => {
  render(<InstitutionVerification state="unverified" institutions={INSTITUTIONS} />);

  const select = screen.getByLabelText(/Institution/);

  expect(within(select).getByRole("option", { name: "UiTM Shah Alam" })).toBeInTheDocument();
  expect(within(select).getByRole("option", { name: "UiTM Puncak Alam" })).toBeInTheDocument();
});

test("withholds the evidence form when the backend returned no institution", () => {
  render(<InstitutionVerification state="unverified" institutions={[]} />);

  expect(screen.queryByLabelText(/Institution/)).not.toBeInTheDocument();
  expect(screen.getByText(/no institutions are available/i)).toBeInTheDocument();
});

test("refuses an incomplete request and links each problem to its field", async () => {
  render(<InstitutionVerification state="unverified" institutions={INSTITUTIONS} />);

  submit();

  const summary = await screen.findByRole("alert");

  expect(
    within(summary).getByRole("link", { name: /choose your institution/i }),
  ).toBeInTheDocument();
  expect(within(summary).getByRole("link", { name: /choose a file/i })).toBeInTheDocument();
  expect(
    within(summary).getByRole("link", { name: /confirm that the evidence/i }),
  ).toBeInTheDocument();
});

test("sends nothing to any operation while the form is incomplete", () => {
  const fetchMock = queueFetch();
  render(<InstitutionVerification state="unverified" institutions={INSTITUTIONS} />);

  submit();

  expect(fetchMock).not.toHaveBeenCalled();
});

test("completes the evidence sequence and reports the request as pending", async () => {
  const fetchMock = queueFetch(
    { json: { ok: true, data: { objectPath: OBJECT_PATH, signedUrl: SIGNED_URL, token: "t" } } },
    { ok: true },
    {
      json: {
        ok: true,
        data: {
          requestId: "req-1",
          status: "pending",
          evidenceDeleteAfter: "2026-10-14T00:00:00.000Z",
        },
      },
    },
  );

  render(<InstitutionVerification state="unverified" institutions={INSTITUTIONS} />);
  fillEvidenceForm();
  submit();

  expect(await screen.findByText(/a sheriff is reviewing your request/i)).toBeInTheDocument();

  expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/identity/verification-evidence/upload-url");
  expect(fetchMock.mock.calls[1]?.[0]).toBe(SIGNED_URL);
  expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: "PUT" });
  expect(fetchMock.mock.calls[2]?.[0]).toBe("/api/identity/verification-requests");

  const submitted = JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body)) as Record<
    string,
    unknown
  >;
  expect(submitted).toMatchObject({
    institutionId: INSTITUTIONS[0]?.id,
    evidenceObjectPath: OBJECT_PATH,
  });
});

test("announces the submitted request politely", async () => {
  queueFetch(
    { json: { ok: true, data: { objectPath: OBJECT_PATH, signedUrl: SIGNED_URL, token: "t" } } },
    { ok: true },
    {
      json: {
        ok: true,
        data: {
          requestId: "req-1",
          status: "pending",
          evidenceDeleteAfter: "2026-10-14T00:00:00.000Z",
        },
      },
    },
  );

  render(<InstitutionVerification state="unverified" institutions={INSTITUTIONS} />);
  fillEvidenceForm();
  submit();

  await waitFor(() => {
    const announcer = screen.getByTestId("verification-announcer");
    expect(announcer).toHaveAttribute("aria-live", "polite");
    expect(announcer).toHaveTextContent(/submitted/i);
  });
});

/**
 * The signed URL and the storage key are private. Neither may appear in
 * rendered output, where a screenshot, a screen reader or a bystander could
 * capture it.
 */
test("never renders the signed URL or the storage key", async () => {
  queueFetch(
    { json: { ok: true, data: { objectPath: OBJECT_PATH, signedUrl: SIGNED_URL, token: "t" } } },
    { ok: true },
    {
      json: {
        ok: true,
        data: {
          requestId: "req-1",
          status: "pending",
          evidenceDeleteAfter: "2026-10-14T00:00:00.000Z",
        },
      },
    },
  );

  const { container } = render(
    <InstitutionVerification state="unverified" institutions={INSTITUTIONS} />,
  );
  fillEvidenceForm();
  submit();

  await screen.findByText(/a sheriff is reviewing your request/i);

  expect(container.innerHTML).not.toContain(SIGNED_URL);
  expect(container.innerHTML).not.toContain(OBJECT_PATH);
  expect(container.innerHTML).not.toContain("token");
});

test("reports a failure to prepare the upload without blaming the document", async () => {
  queueFetch({
    json: { ok: false, code: "EVIDENCE_UPLOAD_UNAVAILABLE", message: "Temporarily unavailable." },
  });

  render(<InstitutionVerification state="unverified" institutions={INSTITUTIONS} />);
  fillEvidenceForm();
  submit();

  expect(await screen.findByText(/temporarily unavailable/i)).toBeInTheDocument();
});

test("reports an upload that did not reach storage", async () => {
  queueFetch(
    { json: { ok: true, data: { objectPath: OBJECT_PATH, signedUrl: SIGNED_URL, token: "t" } } },
    { ok: false },
  );

  render(<InstitutionVerification state="unverified" institutions={INSTITUTIONS} />);
  fillEvidenceForm();
  submit();

  expect(await screen.findByText(/your document was not uploaded/i)).toBeInTheDocument();
});

/**
 * The instructive partial failure: the document is in private storage but no
 * request references it. Re-uploading would leave a second copy of someone's
 * identity document, so the retry resubmits the path already held.
 */
test("retries only the submission when the upload succeeded but the request did not", async () => {
  const fetchMock = queueFetch(
    { json: { ok: true, data: { objectPath: OBJECT_PATH, signedUrl: SIGNED_URL, token: "t" } } },
    { ok: true },
    { json: { ok: false, code: "AUTH_UNAVAILABLE", message: "Try again shortly." } },
    {
      json: {
        ok: true,
        data: {
          requestId: "req-1",
          status: "pending",
          evidenceDeleteAfter: "2026-10-14T00:00:00.000Z",
        },
      },
    },
  );

  render(<InstitutionVerification state="unverified" institutions={INSTITUTIONS} />);
  fillEvidenceForm();
  submit();

  expect(await screen.findByText(/your document was uploaded/i)).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /try submitting again/i }));

  expect(await screen.findByText(/a sheriff is reviewing your request/i)).toBeInTheDocument();

  // Four calls, not five: no second upload.
  expect(fetchMock).toHaveBeenCalledTimes(4);
  expect(fetchMock.mock.calls[3]?.[0]).toBe("/api/identity/verification-requests");
});

test("moves to the pending view when a request already exists", async () => {
  queueFetch(
    { json: { ok: true, data: { objectPath: OBJECT_PATH, signedUrl: SIGNED_URL, token: "t" } } },
    { ok: true },
    { json: { ok: false, code: "VERIFICATION_CONFLICT", message: "Already in progress." } },
  );

  render(<InstitutionVerification state="unverified" institutions={INSTITUTIONS} />);
  fillEvidenceForm();
  submit();

  expect(await screen.findByText(/a sheriff is reviewing your request/i)).toBeInTheDocument();
});

/**
 * aria-disabled is advisory: it does not stop a click or an Enter key, so the
 * handler has to refuse a second run itself. The control stays mounted and
 * focusable, because a `disabled` button drops focus to body and strands a
 * keyboard user mid-flow.
 */
test("guards the handler rather than relying on aria-disabled to block activation", async () => {
  const fetchMock = queueFetch(
    { json: { ok: true, data: { objectPath: OBJECT_PATH, signedUrl: SIGNED_URL, token: "t" } } },
    { ok: true },
    {
      json: {
        ok: true,
        data: {
          requestId: "req-1",
          status: "pending",
          evidenceDeleteAfter: "2026-10-14T00:00:00.000Z",
        },
      },
    },
  );

  render(<InstitutionVerification state="unverified" institutions={INSTITUTIONS} />);
  fillEvidenceForm();

  const button = screen.getByRole("button", { name: /Request verification/ });
  fireEvent.click(button);
  fireEvent.click(button);
  fireEvent.click(button);

  await screen.findByText(/a sheriff is reviewing your request/i);

  // Three calls for one sequence, not nine for three.
  expect(fetchMock).toHaveBeenCalledTimes(3);
});

test("keeps the submitting control mounted and focusable", async () => {
  // The submission is held open so the in-flight state can be observed; without
  // this the whole sequence resolves in one tick and the form unmounts first.
  let releaseSubmission = () => {};
  const held = new Promise<void>((resolve) => {
    releaseSubmission = resolve;
  });

  const mock = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: { objectPath: OBJECT_PATH, signedUrl: SIGNED_URL, token: "t" },
      }),
    })
    .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    .mockImplementationOnce(async () => {
      await held;
      return {
        ok: true,
        json: async () => ({
          ok: true,
          data: {
            requestId: "req-1",
            status: "pending",
            evidenceDeleteAfter: "2026-10-14T00:00:00.000Z",
          },
        }),
      };
    });
  vi.stubGlobal("fetch", mock);

  render(<InstitutionVerification state="unverified" institutions={INSTITUTIONS} />);
  fillEvidenceForm();

  const button = screen.getByRole("button", { name: /Request verification/ });
  button.focus();
  fireEvent.click(button);

  await waitFor(() => {
    expect(screen.getByRole("button", { name: /Request verification/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  const inFlight = screen.getByRole("button", { name: /Request verification/ });
  // Not `disabled`: a disabled control drops focus to body and strands a
  // keyboard user mid-flow.
  expect(inFlight).not.toBeDisabled();
  expect(document.activeElement).toBe(inFlight);

  releaseSubmission();
  await screen.findByText(/a sheriff is reviewing your request/i);
});

test("verifies automatically when the email domain is approved", async () => {
  const fetchMock = queueFetch({
    json: {
      ok: true,
      data: { institutionId: INSTITUTIONS[0]?.id, status: "verified" },
    },
  });

  render(<InstitutionVerification state="unverified" institutions={INSTITUTIONS} />);

  fireEvent.click(screen.getByRole("button", { name: /check my email domain/i }));

  expect(await screen.findByText(/your institution affiliation is confirmed/i)).toBeInTheDocument();
  expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/identity/verify-domain");
});

/**
 * An unapproved domain is the expected routing signal into manual review, not
 * a fault. Presenting it as an error would tell most of the first cohort they
 * did something wrong while the allowlist is deliberately empty.
 */
test("treats an unapproved domain as a route to evidence, not a failure", async () => {
  queueFetch({
    json: { ok: false, code: "DOMAIN_NOT_APPROVED", message: "Not on the approved list." },
  });

  render(<InstitutionVerification state="unverified" institutions={INSTITUTIONS} />);

  fireEvent.click(screen.getByRole("button", { name: /check my email domain/i }));

  const notice = await screen.findByTestId("domain-outcome");

  expect(notice).not.toHaveAttribute("role", "alert");
  expect(notice).toHaveTextContent(/sheriff/i);
  expect(screen.getByLabelText(/Institution/)).toBeInTheDocument();
});

test("shows the pending view and no form while a request is under review", () => {
  render(
    <InstitutionVerification
      state="pending"
      institutions={INSTITUTIONS}
      latestRequest={{
        requestId: "req-1",
        state: "pending",
        submittedAt: "2026-09-10T08:00:00.000Z",
        decidedAt: null,
        reasonCode: null,
        evidenceDeleteAfter: "2026-10-10T08:00:00.000Z",
      }}
    />,
  );

  expect(screen.getByText(/a sheriff is reviewing your request/i)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Request verification/ })).not.toBeInTheDocument();
});

test("confirms a verified affiliation without offering the form again", () => {
  render(<InstitutionVerification state="verified" institutions={INSTITUTIONS} />);

  expect(screen.getByText(/your institution affiliation is confirmed/i)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Request verification/ })).not.toBeInTheDocument();
});

test("gives the rejection reason and offers the form again", () => {
  render(
    <InstitutionVerification
      state="rejected"
      institutions={INSTITUTIONS}
      latestRequest={{
        requestId: "req-2",
        state: "rejected",
        submittedAt: "2026-09-10T08:00:00.000Z",
        decidedAt: "2026-09-12T08:00:00.000Z",
        reasonCode: "evidence_unreadable",
        evidenceDeleteAfter: "2026-10-12T08:00:00.000Z",
      }}
    />,
  );

  expect(screen.getByText(/evidence unreadable/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Request verification/ })).toBeInTheDocument();
});

test("never queues more than one interrupting announcement", async () => {
  queueFetch({
    json: { ok: false, code: "EVIDENCE_UPLOAD_UNAVAILABLE", message: "Temporarily unavailable." },
  });

  render(<InstitutionVerification state="unverified" institutions={INSTITUTIONS} />);
  fillEvidenceForm();
  submit();

  await screen.findByText(/temporarily unavailable/i);

  expect(screen.getAllByRole("alert")).toHaveLength(1);
});

test("still states who sees the evidence and how long it is kept", () => {
  render(<InstitutionVerification state="unverified" institutions={INSTITUTIONS} />);

  const note = screen.getByRole("note", { name: /how your evidence is handled/i });

  expect(note).toHaveTextContent(/only a sheriff/i);
  expect(note).toHaveTextContent(/30 days/i);
});
