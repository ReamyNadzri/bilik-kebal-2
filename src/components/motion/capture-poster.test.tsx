import { fireEvent, render, screen } from "@testing-library/react";
import { CAPTURE_WORDS, CapturePoster, pickCaptureWord } from "./capture-poster";

describe("pickCaptureWord", () => {
  test("always returns one of the five words, never the same word twice in a row", () => {
    let previous = pickCaptureWord();

    for (let i = 0; i < 500; i += 1) {
      const word = pickCaptureWord();
      expect(CAPTURE_WORDS).toContain(word);
      expect(word).not.toBe(previous);
      previous = word;
    }
  });

  test("still differs from the last word when the random source repeats itself", () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0);
    const first = pickCaptureWord();
    const second = pickCaptureWord();
    random.mockRestore();

    expect(second).not.toBe(first);
  });
});

describe("CapturePoster", () => {
  function renderPoster(onClose = vi.fn()) {
    render(
      <CapturePoster
        word="BROUGHT IN"
        courseCode="CSC510"
        courseName="Operating Systems"
        title="CSC510 Operating Systems Lecture Notes"
        bountyLabel="RM 50"
        hunterName="Aina"
        onClose={onClose}
      />,
    );
    return onClose;
  }

  test("names the capture and the claim, and points on to Hunt", () => {
    renderPoster();

    expect(
      screen.getByRole("dialog", { name: "BROUGHT IN. Claim submitted for CSC510" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Brought in by Aina")).toBeInTheDocument();
    expect(screen.getByText("RM 50")).toBeInTheDocument();
    const hunt = screen.getByRole("link", { name: "Follow it in Hunt →" });
    expect(hunt).toHaveAttribute("href", "/claims");
    expect(hunt).toHaveFocus();
  });

  test("closes on Escape and on the backdrop, but not on a click on the poster", () => {
    const onClose = renderPoster();

    fireEvent.click(screen.getByText("WANTED"));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
