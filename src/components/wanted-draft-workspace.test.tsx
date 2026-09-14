import { fireEvent, render, screen, within } from "@testing-library/react";
import { WantedDraftWorkspace } from "./wanted-draft-workspace";
import { WANTED } from "@/features/marketplace/fixtures";
import { loadWantedTaxonomy, type WantedTaxonomy } from "@/features/marketplace/taxonomy-source";

function taxonomy(): WantedTaxonomy {
  const result = loadWantedTaxonomy();

  if (result.status !== "ready") {
    throw new Error("taxonomy fixture unavailable");
  }

  return result.data;
}

function renderWorkspace() {
  return render(<WantedDraftWorkspace taxonomy={taxonomy()} board={WANTED} />);
}

function set(label: string | RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function review() {
  fireEvent.click(screen.getByRole("button", { name: "Review request" }));
}

/** Fills every field with a draft that should pass validation. */
function fillValidDraft() {
  set(/^Title/, "Final exam notes for the whole syllabus");
  set(/^Campus/, "shah-alam");
  set(/^Faculty or college/, "fskm");
  set(/^Programme/, "cs");
  set(/^Course/, "csc510");
  set(/^Academic session/, "2024-2025-sem2");
  set(/^Resource type/, "lecture-notes");
  set(/^Language/, "english");
  set(
    /^What the resource needs to cover/,
    "Complete notes covering every chapter, with the key diagrams and worked examples.",
  );
  fireEvent.click(screen.getByRole("radio", { name: /14 days/ }));
  set(/^Your first contribution/, "10");
  fireEvent.click(screen.getByRole("checkbox", { name: /content policy/i }));
}

describe("the intake form", () => {
  test("asks for every part of the request", () => {
    renderWorkspace();

    for (const label of [
      /^Title/,
      /^Campus/,
      /^Faculty or college/,
      /^Programme/,
      /^Course/,
      /^Academic session/,
      /^Resource type/,
      /^Language/,
      /^What the resource needs to cover/,
      /^Your first contribution/,
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }

    expect(screen.getByRole("group", { name: /How long/ })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /Tags/ })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /content policy/i })).toBeInTheDocument();
  });

  test("offers exactly the three approved durations", () => {
    renderWorkspace();

    const duration = screen.getByRole("group", { name: /How long/ });

    expect(within(duration).getAllByRole("radio")).toHaveLength(3);
    expect(within(duration).getByRole("radio", { name: /7 days/ })).toBeInTheDocument();
    expect(within(duration).getByRole("radio", { name: /14 days/ })).toBeInTheDocument();
    expect(within(duration).getByRole("radio", { name: /30 days/ })).toBeInTheDocument();
  });

  test("states the contribution range beside the amount", () => {
    renderWorkspace();

    expect(screen.getByText(/RM1 to RM50/)).toBeInTheDocument();
  });

  test("says the options are development fixtures, not an institutional catalogue", () => {
    renderWorkspace();

    expect(screen.getByText(/not a reviewed institutional catalogue/i)).toBeInTheDocument();
  });
});

describe("the academic hierarchy", () => {
  test("offers no programme until a faculty is chosen", () => {
    renderWorkspace();

    const programme = screen.getByLabelText(/^Programme/);

    expect(within(programme).queryByRole("option", { name: /Bachelor of Computer Science/ })).toBe(
      null,
    );
  });

  test("narrows programmes to the chosen faculty", () => {
    renderWorkspace();
    set(/^Faculty or college/, "fskm");

    const programme = screen.getByLabelText(/^Programme/);

    expect(
      within(programme).getByRole("option", { name: "Bachelor of Computer Science" }),
    ).toBeInTheDocument();
    expect(within(programme).queryByRole("option", { name: "Bachelor of Accountancy" })).toBe(null);
  });

  test("narrows courses to the chosen programme", () => {
    renderWorkspace();
    set(/^Faculty or college/, "fskm");
    set(/^Programme/, "cs");

    const course = screen.getByLabelText(/^Course/);

    expect(
      within(course).getByRole("option", { name: /CSC510 Database Systems/ }),
    ).toBeInTheDocument();
    expect(within(course).queryByRole("option", { name: /ACC406/ })).toBe(null);
  });

  test("clears a programme and course that no longer belong when the faculty changes", () => {
    renderWorkspace();
    set(/^Faculty or college/, "fskm");
    set(/^Programme/, "cs");
    set(/^Course/, "csc510");

    set(/^Faculty or college/, "law");

    expect(screen.getByLabelText(/^Programme/)).toHaveValue("");
    expect(screen.getByLabelText(/^Course/)).toHaveValue("");
  });
});

describe("validation", () => {
  test("refuses an empty draft and says what is wrong", () => {
    renderWorkspace();
    review();

    expect(screen.getByRole("alert")).toHaveTextContent("There is a problem");
  });

  test("renders exactly one alerting region, never competing ones", () => {
    renderWorkspace();
    review();

    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  test("moves focus to the summary so a keyboard reader lands on the problem", () => {
    renderWorkspace();
    review();

    expect(document.activeElement).toBe(screen.getByRole("alert"));
  });

  test("links each failure to the field that caused it", () => {
    renderWorkspace();
    review();

    const summary = screen.getByRole("alert");

    expect(within(summary).getByRole("link", { name: /Enter a title/ })).toHaveAttribute(
      "href",
      "#wanted-title",
    );
    expect(
      within(summary).getByRole("link", { name: /Accept the content policy/ }),
    ).toHaveAttribute("href", "#wanted-policy");
  });

  test("marks the failing field itself, not only the summary", () => {
    renderWorkspace();
    review();

    expect(screen.getByLabelText(/^Title/)).toHaveAttribute("aria-invalid", "true");
  });

  test("keeps everything already entered", () => {
    renderWorkspace();
    set(/^Title/, "Past year answers with working");
    set(/^Your first contribution/, "25");
    review();

    expect(screen.getByLabelText(/^Title/)).toHaveValue("Past year answers with working");
    expect(screen.getByLabelText(/^Your first contribution/)).toHaveValue("25");
  });

  test("stays on the form when the draft is not valid", () => {
    renderWorkspace();
    review();

    expect(screen.queryByRole("heading", { name: "Review your request" })).not.toBeInTheDocument();
  });

  test("refuses a contribution outside the approved range", () => {
    renderWorkspace();
    fillValidDraft();
    set(/^Your first contribution/, "75");
    review();

    expect(
      within(screen.getByRole("alert")).getByRole("link", { name: /between RM1 and RM50/ }),
    ).toBeInTheDocument();
  });

  test("clears the summary once the draft passes", () => {
    renderWorkspace();
    review();
    fillValidDraft();
    review();

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("the review step", () => {
  function reachReview() {
    renderWorkspace();
    fillValidDraft();
    review();
  }

  test("is reached only with a valid draft", () => {
    reachReview();

    expect(screen.getByRole("heading", { name: "Review your request" })).toBeInTheDocument();
  });

  test("shows the title and description that were entered", () => {
    reachReview();

    expect(screen.getByText("Final exam notes for the whole syllabus")).toBeInTheDocument();
    expect(screen.getByText(/Complete notes covering every chapter/)).toBeInTheDocument();
  });

  test("shows every academic choice as a label, not an identifier", () => {
    reachReview();

    const summary = screen.getByRole("group", { name: /Request summary/ });

    expect(within(summary).getByText("UiTM Shah Alam")).toBeInTheDocument();
    expect(
      within(summary).getByText("Faculty of Computer and Mathematical Sciences"),
    ).toBeInTheDocument();
    expect(within(summary).getByText("Bachelor of Computer Science")).toBeInTheDocument();
    expect(within(summary).getByText("CSC510 Database Systems")).toBeInTheDocument();
    expect(within(summary).getByText("Semester 2, 2024/2025")).toBeInTheDocument();
    expect(within(summary).getByText("Lecture notes")).toBeInTheDocument();
    expect(within(summary).getByText("English")).toBeInTheDocument();
  });

  test("shows the requested duration", () => {
    reachReview();

    expect(screen.getByText("14 days")).toBeInTheDocument();
  });

  test("shows the contribution formatted from integer sen", () => {
    reachReview();

    expect(screen.getByText("Your first contribution RM 10")).toBeInTheDocument();
  });

  test("explains the fee, the policy and the access basis", () => {
    reachReview();

    expect(screen.getByText(/10% platform fee/)).toBeInTheDocument();
    expect(screen.getByText(/snapshotted when the request is published/i)).toBeInTheDocument();
    expect(screen.getByText(/contributors only/i)).toBeInTheDocument();
  });

  test("warns plainly that nothing has been created", () => {
    reachReview();

    expect(
      screen.getByText(/No request, draft, contribution or payment has been created/i),
    ).toBeInTheDocument();
  });

  test("returns to the form with every value still in place", () => {
    reachReview();
    fireEvent.click(screen.getByRole("button", { name: "Back to edit" }));

    expect(screen.getByLabelText(/^Title/)).toHaveValue("Final exam notes for the whole syllabus");
    expect(screen.getByLabelText(/^Course/)).toHaveValue("csc510");
    expect(screen.getByLabelText(/^Your first contribution/)).toHaveValue("10");
    expect(screen.getByRole("radio", { name: /14 days/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /content policy/i })).toBeChecked();
  });
});

describe("duplicate suggestions", () => {
  function reachReview() {
    renderWorkspace();
    fillValidDraft();
    review();
  }

  test("are shown on the review step before anything can be finished", () => {
    reachReview();

    expect(
      screen.getByRole("list", { name: /requests that already look similar/i }),
    ).toBeInTheDocument();
  });

  test("lead to the existing Wanted rather than describing it in place", () => {
    reachReview();

    const list = screen.getByRole("list", { name: /requests that already look similar/i });

    // A card offers its title and its action as two links to the same request,
    // so the title is matched exactly rather than by substring.
    expect(
      within(list).getByRole("link", { name: "Past year questions from 2019 to 2024" }),
    ).toHaveAttribute("href", "/wanted/csc510-past-year-questions");
    expect(
      within(list).getByRole("link", {
        name: "View this Wanted: Past year questions from 2019 to 2024",
      }),
    ).toHaveAttribute("href", "/wanted/csc510-past-year-questions");
  });

  test("say they are advisory rather than a block", () => {
    reachReview();

    expect(screen.getByText(/advisory/i)).toBeInTheDocument();
  });

  test("do not stop the reader from continuing", () => {
    reachReview();

    expect(screen.getByRole("button", { name: "Back to edit" })).toBeEnabled();
  });
});

describe("what the workspace must never do", () => {
  function reachReview() {
    renderWorkspace();
    fillValidDraft();
    review();
  }

  test("offers no publish, pay or save-draft action", () => {
    reachReview();

    for (const control of screen.getAllByRole("button")) {
      expect(control).not.toHaveAccessibleName(/publish|pay|checkout|save draft|submit/i);
    }
  });

  test("says publishing waits on the real payment operation", () => {
    reachReview();

    expect(
      screen.getByText(/Publishing becomes available when the payment operation is connected/i),
    ).toBeInTheDocument();
  });

  /**
   * Phrased as unambiguous success claims rather than as bare verbs. The screen
   * must be able to say "No request ... has been created", which is a denial;
   * what it must never say is that something succeeded.
   */
  test("never claims anything was saved, submitted or paid", () => {
    reachReview();

    const page = document.body.textContent ?? "";

    for (const claim of [
      /successfully/i,
      /payment (received|complete|confirmed)/i,
      /thank you for your contribution/i,
      /draft saved/i,
      /your request is (live|open|published)/i,
      /we have (saved|received|published)/i,
    ]) {
      expect(page).not.toMatch(claim);
    }
  });

  test("states the denial explicitly rather than staying silent about it", () => {
    reachReview();

    expect(
      screen.getByText(/No request, draft, contribution or payment has been created/i),
    ).toBeInTheDocument();
  });
});
