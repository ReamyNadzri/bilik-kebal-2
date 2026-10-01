import { fireEvent, render, screen } from "@testing-library/react";
import { OwnerRemoveWanted } from "./owner-remove-wanted";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

function respond(body: unknown) {
  return { json: async () => body } as unknown as Response;
}

afterEach(() => vi.unstubAllGlobals());

test("says how the money is settled, and needs a reason and a confirmation", () => {
  render(<OwnerRemoveWanted wantedId="w1" />);
  fireEvent.click(screen.getByRole("button", { name: "Remove for breaking the rules" }));

  expect(screen.getByText(/The poster forfeits the money they put in/)).toBeInTheDocument();
  const remove = screen.getByRole("button", { name: "Remove this Wanted" });
  expect(remove).toBeDisabled();
  fireEvent.change(screen.getByLabelText(/Which rule or term/), {
    target: { value: "Shared a paid textbook" },
  });
  expect(remove).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox", { name: /cannot be undone/ }));
  expect(remove).toBeEnabled();
});

test("removes it and reports the refunds and the forfeit", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(respond({ ok: true, data: { refunds: 2, forfeitedSen: 2200 } })),
  );
  render(<OwnerRemoveWanted wantedId="w1" />);
  fireEvent.click(screen.getByRole("button", { name: "Remove for breaking the rules" }));
  fireEvent.change(screen.getByLabelText(/Which rule or term/), {
    target: { value: "Shared a paid textbook" },
  });
  fireEvent.click(screen.getByRole("checkbox", { name: /cannot be undone/ }));
  fireEvent.click(screen.getByRole("button", { name: "Remove this Wanted" }));

  expect(await screen.findByRole("status")).toHaveTextContent("2 Backer refunds queued in full");
  expect(screen.getByRole("status")).toHaveTextContent("RM 22 forfeited by the poster");
  expect(refresh).toHaveBeenCalled();
});
