import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { matchesQuery, SearchSelect } from "./search-select";

const OPTIONS = [
  { id: "p1", label: "AC110 Diploma Perakaunan" },
  { id: "p2", label: "AC220 Sarjana Muda Perakaunan (Kepujian)" },
  { id: "p3", label: "CDCS230 (CS230) Sarjana Muda Sains Komputer (Kepujian)" },
];

function Harness({ onChange = () => undefined }: { readonly onChange?: (id: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <SearchSelect
      id="programme"
      label="Programme"
      value={value}
      options={OPTIONS}
      placeholder="Search programmes"
      noun="programme"
      error={undefined}
      onChange={(id) => {
        setValue(id);
        onChange(id);
      }}
    />
  );
}

const box = () => screen.getByRole("combobox", { name: /^Programme/ });
const type = (text: string) => fireEvent.change(box(), { target: { value: text } });
const key = (name: string) => fireEvent.keyDown(box(), { key: name });

describe("matching what was typed", () => {
  const label = "CDCS230 (CS230) Sarjana Muda Sains Komputer (Kepujian)";

  test.each([
    ["cs230", true],
    ["komputer sarjana", true],
    ["  SAINS   komputer ", true],
    ["perakaunan", false],
    ["komputer perakaunan", false],
  ])("%j matches: %s", (query, expected) => {
    expect(matchesQuery(label, query)).toBe(expected);
  });
});

describe("SearchSelect", () => {
  test("is a closed combobox until the reader types", () => {
    render(<Harness />);

    expect(box()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("option")).toBeNull();
  });

  test("filters the list by every word typed", () => {
    render(<Harness />);

    type("perakaunan");

    expect(box()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("option")).toHaveLength(2);
    expect(screen.getByText("2 programmes found.")).toBeInTheDocument();
  });

  test("finds a programme by its older code", () => {
    render(<Harness />);

    type("cs230");

    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("option", { name: /CDCS230/ })).toBeInTheDocument();
  });

  test("says so when nothing matches, and never makes the text a value", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    type("muzik");
    expect(screen.getByText(/No programme matches/)).toBeInTheDocument();

    fireEvent.blur(box());
    expect(onChange).not.toHaveBeenCalled();
    expect(box()).toHaveValue("");
  });

  test("chooses with the arrow keys and Enter, without submitting the form", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    type("perakaunan");
    key("ArrowDown");
    expect(box()).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("option", { name: /AC220/ }).id,
    );

    // fireEvent returns false when the handler prevented the default action.
    expect(fireEvent.keyDown(box(), { key: "Enter" })).toBe(false);
    expect(onChange).toHaveBeenCalledWith("p2");
    expect(box()).toHaveValue(OPTIONS[1]!.label);
    expect(box()).toHaveAttribute("aria-expanded", "false");
  });

  test("chooses with a click", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    type("diploma");
    fireEvent.click(screen.getByRole("option", { name: /AC110/ }));

    expect(onChange).toHaveBeenCalledWith("p1");
  });

  test("Escape puts the chosen programme back", () => {
    render(<Harness />);

    type("cs230");
    key("Enter");
    type("perak");
    key("Escape");

    expect(box()).toHaveValue(OPTIONS[2]!.label);
    expect(box()).toHaveAttribute("aria-expanded", "false");
  });

  test("leaving with text that names exactly one programme chooses it", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    type("ac110");
    fireEvent.blur(box());

    expect(onChange).toHaveBeenCalledWith("p1");
    expect(box()).toHaveValue(OPTIONS[0]!.label);
  });

  test("leaving with the text cleared clears the choice", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    type("ac110");
    key("Enter");
    type("");
    fireEvent.blur(box());

    expect(onChange).toHaveBeenLastCalledWith("");
  });

  test("links the error and hint to the text box", () => {
    render(
      <SearchSelect
        id="programme"
        label="Programme"
        hint="Type a code."
        value=""
        options={OPTIONS}
        placeholder="Search programmes"
        noun="programme"
        error="Choose the programme."
        onChange={() => undefined}
      />,
    );

    expect(box()).toHaveAttribute("aria-invalid", "true");
    expect(box()).toHaveAccessibleDescription("Type a code. Choose the programme.");
  });
});
