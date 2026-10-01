import { fireEvent, render, screen } from "@testing-library/react";
import { HomeFaq } from "./home-faq";

test("lists the questions closed, and opens an answer on request", () => {
  render(<HomeFaq />);

  expect(screen.getByRole("heading", { name: "Questions, answered" })).toBeInTheDocument();
  const question = screen.getByText("When do I get my money back?");
  const item = question.closest("details");
  expect(item).not.toHaveAttribute("open");
  fireEvent.click(question);
  expect(item).toHaveAttribute("open");
  expect(screen.getByText(/refunded in full, fee included/)).toBeInTheDocument();
});
