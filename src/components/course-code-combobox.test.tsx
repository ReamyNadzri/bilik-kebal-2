import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { CourseCodeCombobox } from "./course-code-combobox";

const courses = [
  { id: "1", code: "MAT183", label: "Calculus I", programmeId: "p", slug: "mat183" },
  { id: "2", code: "CSC510", label: "Discrete Structures", programmeId: "p", slug: "mat183" },
];

function setup(value = "") {
  const onChange = vi.fn();
  render(
    <CourseCodeCombobox
      id="c"
      value={value}
      courses={courses}
      error={undefined}
      onChange={onChange}
    />,
  );
  return { input: screen.getByRole("combobox", { name: /Course code/ }), onChange };
}

test("typing filters by code or name and shows both", () => {
  const { input } = setup("MAT");
  fireEvent.focus(input);
  expect(screen.getByRole("option", { name: /MAT183 Calculus I/ })).toBeInTheDocument();
  expect(screen.queryByRole("option", { name: /CSC510/ })).not.toBeInTheDocument();
});

test("a name matches too", () => {
  const { input } = setup("discrete");
  fireEvent.focus(input);
  expect(screen.getByRole("option", { name: /CSC510/ })).toBeInTheDocument();
});

test("Enter on a suggestion fills the code", () => {
  const { input, onChange } = setup("MAT");
  fireEvent.keyDown(input, { key: "ArrowDown" });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(onChange).toHaveBeenLastCalledWith("MAT183");
});

test("Enter with no active suggestion is left to the form", () => {
  const { input } = setup("MAT");
  fireEvent.focus(input);
  expect(fireEvent.keyDown(input, { key: "Enter" })).toBe(true);
});

test("clicking a suggestion chooses it", () => {
  const { input, onChange } = setup("");
  fireEvent.focus(input);
  fireEvent.mouseDown(screen.getByRole("option", { name: /CSC510/ }));
  expect(onChange).toHaveBeenLastCalledWith("CSC510");
});

test("a new code is kept as typed, upper-cased", () => {
  const { input, onChange } = setup();
  fireEvent.change(input, { target: { value: "ctu551" } });
  expect(onChange).toHaveBeenLastCalledWith("CTU551");
});

test("Escape closes the list without changing the value", () => {
  const { input, onChange } = setup("MAT");
  fireEvent.focus(input);
  expect(input).toHaveAttribute("aria-expanded", "true");
  fireEvent.keyDown(input, { key: "Escape" });
  expect(input).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByRole("option")).not.toBeInTheDocument();
  expect(onChange).not.toHaveBeenCalled();
});
