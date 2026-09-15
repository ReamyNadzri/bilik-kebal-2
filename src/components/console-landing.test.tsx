import { render, screen } from "@testing-library/react";
import { ConsoleLanding } from "./console-landing";

test("refuses a viewer whose role does not grant the console", () => {
  render(<ConsoleLanding />);

  const refusal = screen.getByRole("alert");

  expect(refusal).toHaveTextContent("Restricted");
  expect(refusal).toHaveTextContent(/Sheriff/);
});

test("says the refusal is enforced by the server, not by a hidden link", () => {
  render(<ConsoleLanding />);

  expect(screen.getByText(/checked on the server/i)).toBeInTheDocument();
});

test("does not list review queues to a refused viewer", () => {
  render(<ConsoleLanding />);

  expect(screen.queryByRole("list")).not.toBeInTheDocument();
});

/**
 * A refused viewer must learn nothing about what is waiting. Naming applicants,
 * institutions or even a count would leak the queue to someone the operations
 * just refused.
 */
test("reveals nothing about what the queue contains", () => {
  render(<ConsoleLanding />);

  expect(screen.queryByText(/waiting/i)).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /view the evidence/i })).not.toBeInTheDocument();
});
