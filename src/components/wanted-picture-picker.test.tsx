import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { expect, test } from "vitest";
import { ResourceEmblem } from "./resource-emblem";
import { WantedPicturePicker } from "./wanted-picture-picker";
import {
  AUTO_PICTURE,
  type WantedPictureChoice,
} from "@/features/presentation/wanted-picture-choice";

function Harness() {
  const [value, setValue] = useState<WantedPictureChoice>(AUTO_PICTURE);
  return (
    <WantedPicturePicker value={value} onChange={setValue} kind="academic" resourceType="Notes" />
  );
}

test("offers fifty drawings as one radio group and returns to the automatic drawing", () => {
  const { container } = render(<Harness />);
  expect(screen.getByText(/Automatic/)).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Choose a drawing" }));
  const radios = screen.getAllByRole("radio");
  expect(radios).toHaveLength(50);

  fireEvent.click(screen.getByRole("radio", { name: "Cactus" }));
  expect(screen.getByRole("radio", { name: "Cactus" })).toBeChecked();
  expect(screen.getByText("Cactus", { selector: ".picture-picker__name" })).toBeInTheDocument();
  expect(container.querySelector(".picture-picker__preview [data-emblem]")).toHaveAttribute(
    "data-emblem",
    "preset",
  );

  fireEvent.click(screen.getByRole("button", { name: "Use the automatic drawing" }));
  expect(screen.getByText(/Automatic/, { selector: ".picture-picker__name" })).toBeInTheDocument();
});

test("opens the upload editor, which asks for an image first", () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "Upload your own" }));
  expect(screen.getByRole("dialog", { name: "Upload your own picture" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Use this picture" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("the poster frame shows an uploaded picture as a hard-edged image", () => {
  const { container } = render(
    <ResourceEmblem
      resourceType="Notes"
      picture={{ kind: "upload", url: "https://storage.test/p.png" }}
    />,
  );
  const image = container.querySelector("img");
  expect(image).toHaveAttribute("src", "https://storage.test/p.png");
  expect(image).toHaveAttribute("alt", "");
  expect(image).toHaveClass("resource-emblem--upload");
});
