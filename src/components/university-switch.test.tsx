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
  return { current: UITM, options: [UITM, UMPSA], locked: false, ...overrides };
}

beforeEach(() => {
  replace.mockReset();
  refresh.mockReset();
  document.cookie = "vaultix_university=; path=/; max-age=0";
});

describe("UniversitySwitch", () => {
  test("offers every university to a reader not yet verified, the shown one chosen", () => {
    render(<UniversitySwitch choice={choice()} resetHref="/board" />);

    const group = screen.getByRole("group", { name: "University" });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "UiTM" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "UMPSA" })).not.toBeChecked();
  });

  test("remembers the pick and reloads the unfiltered page", () => {
    render(<UniversitySwitch choice={choice()} resetHref="/board?view=hunters" />);

    fireEvent.click(screen.getByRole("radio", { name: "UMPSA" }));

    expect(document.cookie).toContain("vaultix_university=umpsa");
    expect(screen.getByRole("radio", { name: "UMPSA" })).toBeChecked();
    expect(replace).toHaveBeenCalledWith("/board?view=hunters");
    expect(refresh).toHaveBeenCalled();
  });

  test("only states the university to a member verified there", () => {
    render(
      <UniversitySwitch choice={choice({ current: UMPSA, locked: true })} resetHref="/board" />,
    );

    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.getByText(/the university you verified with/)).toHaveTextContent(
      "Showing UMPSA, the university you verified with.",
    );
  });

  test("shows nothing when there is only one university to show", () => {
    const { container } = render(
      <UniversitySwitch choice={choice({ options: [UITM] })} resetHref="/board" />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
