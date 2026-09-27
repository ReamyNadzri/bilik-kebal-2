import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toSen } from "@/features/marketplace/money";
import { WantedPosterControls, type WantedPosterControlsProps } from "./wanted-poster-controls";

const refresh = vi.hoisted(() => vi.fn());
const replace = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, replace }) }));

const now = "2026-09-28T10:20:00.000Z";
const props: WantedPosterControlsProps = {
  wantedId: "11111111-1111-4111-8111-111111111111",
  title: "Past year papers for MAT183",
  description: "Any past year final papers from 2022 onwards, with or without answers.",
  isFree: false,
  grossBountySen: toSen(15),
  backerCount: 2,
  window: { editableUntil: "2026-09-28T11:00:00.000Z", lockedReason: null },
  now,
};

function respond(body: unknown, status = 200) {
  return vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response(JSON.stringify(body), { status }));
}

afterEach(() => {
  vi.restoreAllMocks();
  refresh.mockClear();
  replace.mockClear();
});

describe("WantedPosterControls", () => {
  it("shows the minutes left while the window is open", () => {
    render(<WantedPosterControls {...props} />);
    expect(screen.getByText(/40 minutes/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit text" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Withdraw" })).toBeInTheDocument();
  });

  it.each([
    ["claim_submitted", /A Hunter has submitted a claim/],
    ["reply_received", /Someone has replied/],
    ["window_closed", /first hour after publishing only/],
  ] as const)("explains the %s lock and offers no actions", (lockedReason, copy) => {
    render(<WantedPosterControls {...props} window={{ ...props.window, lockedReason }} />);
    expect(screen.getByText(copy)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Withdraw" })).not.toBeInTheDocument();
  });

  it("locks itself once the hour has passed on the page's clock", () => {
    render(<WantedPosterControls {...props} now="2026-09-28T11:00:30.000Z" />);
    expect(screen.getByText(/first hour after publishing only/)).toBeInTheDocument();
  });

  it("saves edited text with PATCH and refreshes the page", async () => {
    const fetch = respond({ ok: true, data: { state: "edited" } });
    render(<WantedPosterControls {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit text" }));
    fireEvent.change(screen.getByLabelText(/^Title/), {
      target: { value: "Past year papers for MAT183 (2022 to 2025)" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe(`/api/marketplace/wanted/${props.wantedId}`);
    expect(init?.method).toBe("PATCH");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      title: "Past year papers for MAT183 (2022 to 2025)",
    });
  });

  it("blocks a title that is too short before sending anything", () => {
    const fetch = respond({ ok: true, data: { state: "edited" } });
    render(<WantedPosterControls {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit text" }));
    fireEvent.change(screen.getByLabelText(/^Title/), { target: { value: "Short" } });
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("states the refund before withdrawing, then withdraws", async () => {
    const fetch = respond({ ok: true, data: { state: "withdrawn", refundsQueued: 2 } });
    render(<WantedPosterControls {...props} />);
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
    render(<WantedPosterControls {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Withdraw" }));
    fireEvent.click(screen.getByRole("button", { name: "Withdraw this Wanted" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/submitted a claim/);
    expect(replace).not.toHaveBeenCalled();
  });
});
