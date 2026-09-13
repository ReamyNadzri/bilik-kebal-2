import { render, screen } from "@testing-library/react";
import { ConsoleLanding } from "./console-landing";

test("refuses a viewer whose role does not grant the console", () => {
  render(<ConsoleLanding hasConsoleAccess={false} />);

  const refusal = screen.getByRole("alert");

  expect(refusal).toHaveTextContent("Restricted");
  expect(refusal).toHaveTextContent(/Sheriff/);
});

test("says the refusal is enforced by the server, not by a hidden link", () => {
  render(<ConsoleLanding hasConsoleAccess={false} />);

  expect(screen.getByText(/checked on the server/i)).toBeInTheDocument();
});

test("does not list review queues to a refused viewer", () => {
  render(<ConsoleLanding hasConsoleAccess={false} />);

  expect(screen.queryByRole("list", { name: "Review queues" })).not.toBeInTheDocument();
});

test("tells a Sheriff which queues will live here", () => {
  render(<ConsoleLanding hasConsoleAccess />);

  const queues = screen.getByRole("list", { name: "Review queues" });

  expect(queues).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("does not pretend a queue is available before it is built", () => {
  render(<ConsoleLanding hasConsoleAccess />);

  // "empty" carries no announcement role by design — it is not an
  // interruption — so assert on the visible wording.
  expect(screen.getByText(/not built yet/i)).toBeInTheDocument();
  expect(screen.getByText("Empty")).toBeInTheDocument();
});
