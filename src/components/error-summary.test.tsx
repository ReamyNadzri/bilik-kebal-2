import { fireEvent, render, screen, within } from "@testing-library/react";
import { ErrorSummary } from "./error-summary";

const ERRORS = [
  { fieldId: "email", message: "Enter your email address." },
  { fieldId: "password", message: "Enter your password." },
];

test("announces the failure assertively", () => {
  render(<ErrorSummary errors={ERRORS} />);

  expect(screen.getByRole("alert")).toHaveTextContent("There is a problem");
});

test("lists every error as a link to its field", () => {
  render(<ErrorSummary errors={ERRORS} />);

  const list = within(screen.getByRole("alert")).getByRole("list");
  const links = within(list).getAllByRole("link");

  expect(links).toHaveLength(2);
  expect(links[0]).toHaveAttribute("href", "#email");
  expect(links[0]).toHaveTextContent("Enter your email address.");
  expect(links[1]).toHaveAttribute("href", "#password");
});

test("can receive focus so submission moves the reader to the problem", () => {
  render(<ErrorSummary errors={ERRORS} />);

  expect(screen.getByRole("alert")).toHaveAttribute("tabindex", "-1");
});

test("renders nothing when there are no errors", () => {
  const { container } = render(<ErrorSummary errors={[]} />);

  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(container).toBeEmptyDOMElement();
});

test("following an error link moves focus into the field, not merely to it", () => {
  render(
    <>
      <ErrorSummary errors={[{ fieldId: "email", message: "Enter your email address." }]} />
      <input id="email" />
    </>,
  );

  const field = document.getElementById("email")!;
  const scrollIntoView = vi.fn();
  Object.defineProperty(field, "scrollIntoView", { value: scrollIntoView });

  fireEvent.click(screen.getByRole("link", { name: "Enter your email address." }));

  expect(field).toHaveFocus();
  expect(scrollIntoView).toHaveBeenCalledWith({ block: "center" });
});
