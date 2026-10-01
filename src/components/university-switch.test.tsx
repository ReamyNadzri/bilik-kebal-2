import { fireEvent, render, screen } from "@testing-library/react";
import type { UniversityChoice } from "@/contracts/universities";
import { UniversitySwitch } from "./university-switch";

const replace = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));

const UITM = {
  id: "u1",
  slug: "uitm",
  name: "Universiti Teknologi MARA (UiTM)",
  shortName: "UiTM",
};
const UMPSA = {
  id: "u2",
  slug: "umpsa",
  name: "Universiti Malaysia Pahang Al-Sultan Abdullah (UMPSA)",
  shortName: "UMPSA",
};

function choice(overrides: Partial<UniversityChoice> = {}): UniversityChoice {
  return { current: UITM, options: [UITM, UMPSA], all: false, own: null, ...overrides };
}

beforeEach(() => {
  replace.mockReset();
  refresh.mockReset();
  document.cookie = "vaultix_university=; path=/; max-age=0";
});

describe("UniversitySwitch", () => {
  test("offers All and every university, the shown one chosen", () => {
    render(<UniversitySwitch choice={choice()} resetHref="/board" />);

    const group = screen.getByRole("group", { name: "University" });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "All" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "UiTM" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "UMPSA" })).not.toBeChecked();
  });

  test("chooses All when every university is shown, and remembers picking it", () => {
    render(<UniversitySwitch choice={choice({ all: true })} resetHref="/board" />);
    expect(screen.getByRole("radio", { name: "All" })).toBeChecked();

    fireEvent.click(screen.getByRole("radio", { name: "UMPSA" }));
    fireEvent.click(screen.getByRole("radio", { name: "All" }));

    expect(document.cookie).toContain("vaultix_university=all");
  });

  test("remembers the pick and reloads the unfiltered page", () => {
    render(<UniversitySwitch choice={choice()} resetHref="/board?view=hunters" />);

    fireEvent.click(screen.getByRole("radio", { name: "UMPSA" }));

    expect(document.cookie).toContain("vaultix_university=umpsa");
    expect(screen.getByRole("radio", { name: "UMPSA" })).toBeChecked();
    expect(replace).toHaveBeenCalledWith("/board?view=hunters");
    expect(refresh).toHaveBeenCalled();
  });

  test("lets a verified member switch too, marking other universities view only", () => {
    render(
      <UniversitySwitch
        choice={choice({ current: UMPSA, all: true, own: UMPSA })}
        resetHref="/board"
      />,
    );

    expect(screen.getByRole("radio", { name: "All" })).toBeChecked();
    expect(screen.getByRole("radio", { name: /^UiTM\s*\(view only\)$/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "UMPSA" })).toBeInTheDocument();
    expect(
      screen.getByText("You can back, claim and reply at UMPSA. Other universities are view only."),
    ).toBeInTheDocument();
  });

  test("shows nothing when there is only one university to show", () => {
    const { container } = render(
      <UniversitySwitch choice={choice({ options: [UITM] })} resetHref="/board" />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
