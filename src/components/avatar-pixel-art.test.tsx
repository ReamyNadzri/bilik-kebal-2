import { fireEvent, render, screen } from "@testing-library/react";
import { AvatarPixelArt } from "./avatar-pixel-art";
import { PRESET_PICTURES } from "@/features/presentation/pixel-drawings";

test("offers the fifty pixel drawings, and Escape closes the picker", () => {
  render(<AvatarPixelArt onSaved={vi.fn()} onError={vi.fn()} />);

  fireEvent.click(screen.getByRole("button", { name: "Choose a pixel drawing" }));
  const dialog = screen.getByRole("dialog", { name: "Choose a pixel drawing" });
  const list = screen.getByRole("list", { name: "Pixel drawings" });
  expect(list.querySelectorAll("button")).toHaveLength(PRESET_PICTURES.length);
  expect(screen.getByRole("button", { name: "Open book" })).toBeInTheDocument();

  fireEvent.keyDown(dialog, { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("turns a photo into pixel art in the same editor a Wanted uses, with profile words", () => {
  render(<AvatarPixelArt onSaved={vi.fn()} onError={vi.fn()} />);

  fireEvent.click(screen.getByRole("button", { name: "Pixel art from a photo" }));

  expect(screen.getByRole("dialog", { name: "Your photo as pixel art" })).toBeInTheDocument();
  expect(screen.getByText(/becomes your profile picture/)).toBeInTheDocument();
});

test("says so when the picture could not be saved", async () => {
  const onError = vi.fn();
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  render(<AvatarPixelArt onSaved={vi.fn()} onError={onError} />);

  fireEvent.click(screen.getByRole("button", { name: "Choose a pixel drawing" }));
  fireEvent.click(screen.getByRole("button", { name: "Open book" }));

  await vi.waitFor(() => expect(onError).toHaveBeenCalledWith(expect.stringMatching(/not saved/)));
  vi.unstubAllGlobals();
});
