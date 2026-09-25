"use client";

import { useId, useState } from "react";
import { PixelArt } from "./pixel-art";
import { PixelPictureEditor } from "./pixel-picture-editor";
import { ResourceEmblem } from "./resource-emblem";
import { PIXEL_PALETTE, PRESET_PICTURES } from "@/features/presentation/pixel-drawings";
import {
  AUTO_PICTURE,
  choiceAsPicture,
  type WantedPictureChoice,
} from "@/features/presentation/wanted-picture-choice";

export interface WantedPicturePickerProps {
  readonly value: WantedPictureChoice;
  readonly onChange: (choice: WantedPictureChoice) => void;
  /** What the automatic drawing would show, for the preview. */
  readonly kind: "academic" | "missing_item" | "discussion";
  readonly resourceType: string;
  readonly disabled?: boolean;
}

function describe(choice: WantedPictureChoice): string {
  if (choice.kind === "preset") return PRESET_PICTURES[choice.preset]?.name ?? "A drawing";
  if (choice.kind === "upload") return "Your own picture, as pixel art";
  return "Automatic: a drawing that fits the request";
}

/**
 * The small picture on a Wanted poster: the automatic drawing, one of fifty
 * drawings, or the poster's own image turned into pixel art. The drawings are
 * one radio group, so the arrow keys move through them.
 */
export function WantedPicturePicker({
  value,
  onChange,
  kind,
  resourceType,
  disabled = false,
}: WantedPicturePickerProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  return (
    <div className="picture-picker">
      <div className="picture-picker__current">
        <div className="picture-picker__preview">
          <ResourceEmblem
            kind={kind}
            resourceType={resourceType}
            picture={choiceAsPicture(value)}
          />
        </div>
        <div className="picture-picker__summary">
          <p className="picture-picker__name" id={`${id}-current`}>
            {describe(value)}
          </p>
          <div className="picture-picker__actions">
            <button
              type="button"
              className="button button--secondary button--compact"
              aria-expanded={open}
              aria-controls={`${id}-grid`}
              disabled={disabled}
              onClick={() => setOpen((current) => !current)}
            >
              {open ? "Hide the drawings" : "Choose a drawing"}
            </button>
            <button
              type="button"
              className="button button--secondary button--compact"
              disabled={disabled}
              onClick={() => setEditing(true)}
            >
              Upload your own
            </button>
            {value.kind === "auto" ? null : (
              <button
                type="button"
                className="button button--quiet button--compact"
                disabled={disabled}
                onClick={() => onChange(AUTO_PICTURE)}
              >
                Use the automatic drawing
              </button>
            )}
          </div>
        </div>
      </div>

      {open ? (
        <fieldset className="picture-picker__grid" id={`${id}-grid`} disabled={disabled}>
          <legend className="visually-hidden">Drawings</legend>
          {PRESET_PICTURES.map((picture, index) => (
            <label className="picture-choice" key={picture.name} title={picture.name}>
              <input
                type="radio"
                name={`${id}-preset`}
                checked={value.kind === "preset" && value.preset === index}
                onChange={() => onChange({ kind: "preset", preset: index })}
              />
              <span className="picture-choice__face">
                <PixelArt rows={picture.rows} palette={PIXEL_PALETTE} className="resource-emblem" />
              </span>
              <span className="visually-hidden">{picture.name}</span>
            </label>
          ))}
        </fieldset>
      ) : null}

      {editing ? (
        <PixelPictureEditor
          onClose={() => setEditing(false)}
          onDone={({ blob, previewUrl }) => {
            onChange({ kind: "upload", blob, previewUrl });
            setEditing(false);
          }}
        />
      ) : null}
    </div>
  );
}
