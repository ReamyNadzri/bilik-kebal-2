import { fireEvent, render, screen } from "@testing-library/react";
import { WantedReportButton } from "./wanted-report-button";

function respond(body: unknown) {
  return { json: async () => body } as unknown as Response;
}

afterEach(() => vi.unstubAllGlobals());

test("is an icon named Report this Wanted that opens a dialog", () => {
  render(<WantedReportButton wantedId="w1" title="Final exam notes" />);

  const report = screen.getByRole("button", { name: "Report this Wanted" });
  expect(report).toHaveAttribute("aria-haspopup", "dialog");
  fireEvent.click(report);
  expect(screen.getByRole("dialog", { name: "Report this Wanted" })).toBeInTheDocument();
});

test("asks for a reason, sends it, and thanks the reporter", async () => {
  const fetchMock = vi.fn().mockResolvedValue(respond({ ok: true, data: { outcome: "reported" } }));
  vi.stubGlobal("fetch", fetchMock);
  render(<WantedReportButton wantedId="w1" title="Final exam notes" />);
  fireEvent.click(screen.getByRole("button", { name: "Report this Wanted" }));

  fireEvent.click(screen.getByRole("button", { name: "Send report" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Choose a reason.");
  expect(fetchMock).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("radio", { name: "Scam or fraud" }));
  fireEvent.click(screen.getByRole("button", { name: "Send report" }));

  expect(await screen.findByRole("status")).toHaveTextContent("went privately to the Sheriffs");
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/marketplace/wanted/w1/report",
    expect.objectContaining({ body: JSON.stringify({ category: "scam_or_fraud" }) }),
  );
});

test("closes on Escape and gives focus back to the flag", () => {
  render(<WantedReportButton wantedId="w1" title="Final exam notes" />);
  const report = screen.getByRole("button", { name: "Report this Wanted" });
  fireEvent.click(report);

  fireEvent.keyDown(window, { key: "Escape" });

  expect(screen.queryByRole("dialog")).toBeNull();
  expect(report).toHaveFocus();
});
