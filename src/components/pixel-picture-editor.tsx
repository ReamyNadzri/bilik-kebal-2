"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { WANTED_PICTURE_MAX_BYTES } from "@/contracts/wanted-pictures";
import {
  PIXEL_GRIDS,
  START_FRAMING,
  canvasToPng,
  coverRect,
  renderPixelPicture,
  type Framing,
  type PixelGrid,
} from "@/features/presentation/pixelate";

export interface PixelPictureEditorProps {
  /** Called with the pixelated PNG, ready to upload once the Wanted exists. */
  readonly onDone: (picture: { blob: Blob; previewUrl: string }) => void;
  readonly onClose: () => void;
}

const STAGE_PX = 240;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_SOURCE_BYTES = 10 * 1024 * 1024;

function backdropColour(): string {
  if (typeof document === "undefined") return "white";
  return (
    getComputedStyle(document.documentElement).getPropertyValue("--bg-surface").trim() || "white"
  );
}

/**
 * Turn a photo into the pixel-art picture of a Wanted: choose an image, drag
 * (or use the arrow keys) and zoom to crop it square, pick how coarse the
 * pixels are and whether to use retro colours, and see the result beside it.
 * Everything happens in the browser; only the small pixelated PNG leaves the
 * device, without the original's camera metadata.
 */
export function PixelPictureEditor({ onDone, onClose }: PixelPictureEditorProps) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [framing, setFraming] = useState<Framing>(START_FRAMING);
  const [cells, setCells] = useState<PixelGrid>(24);
  const [retro, setRetro] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const stageRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; start: Framing } | null>(null);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  // The cropping stage shows the photo smoothly; the preview shows the pixels.
  useEffect(() => {
    if (!image) return;
    const stage = stageRef.current?.getContext("2d");
    if (stage) {
      stage.fillStyle = backdropColour();
      stage.fillRect(0, 0, STAGE_PX, STAGE_PX);
      const rect = coverRect(image.naturalWidth, image.naturalHeight, framing, STAGE_PX);
      stage.drawImage(image, rect.x, rect.y, rect.width, rect.height);
    }
    const preview = previewRef.current?.getContext("2d");
    const pixels = renderPixelPicture(image, framing, cells, retro, backdropColour());
    if (preview && pixels) {
      preview.imageSmoothingEnabled = false;
      preview.clearRect(0, 0, preview.canvas.width, preview.canvas.height);
      preview.drawImage(pixels, 0, 0, preview.canvas.width, preview.canvas.height);
    }
  }, [image, framing, cells, retro]);

  function choose(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      setError("Choose a JPEG, PNG or WEBP image.");
      return;
    }
    if (file.size > MAX_SOURCE_BYTES) {
      setError("Choose an image smaller than 10 MB.");
      return;
    }
    const url = URL.createObjectURL(file);
    const loaded = new window.Image();
    loaded.onload = () => {
      setImage(loaded);
      setFraming(START_FRAMING);
    };
    loaded.onerror = () => {
      URL.revokeObjectURL(url);
      setError("That image could not be opened. Try another one.");
    };
    loaded.src = url;
  }

  function onPointerDown(event: PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, start: framing };
  }

  function onPointerMove(event: PointerEvent<HTMLCanvasElement>) {
    const from = drag.current;
    if (!from) return;
    const width = event.currentTarget.getBoundingClientRect().width || STAGE_PX;
    setFraming({
      ...from.start,
      x: from.start.x + (event.clientX - from.x) / width,
      y: from.start.y + (event.clientY - from.y) / width,
    });
  }

  function onStageKey(event: KeyboardEvent<HTMLCanvasElement>) {
    const step = event.shiftKey ? 0.08 : 0.02;
    const moves: Record<string, Partial<Framing>> = {
      ArrowLeft: { x: framing.x - step },
      ArrowRight: { x: framing.x + step },
      ArrowUp: { y: framing.y - step },
      ArrowDown: { y: framing.y + step },
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      setFraming({ ...framing, ...move });
    }
  }

  async function finish() {
    if (!image) return;
    setBusy(true);
    setError(null);
    const canvas = renderPixelPicture(image, framing, cells, retro, backdropColour());
    const blob = canvas ? await canvasToPng(canvas) : null;
    setBusy(false);
    if (!blob || blob.type !== "image/png") {
      setError("This browser could not make the picture. Try another browser.");
      return;
    }
    if (blob.size > WANTED_PICTURE_MAX_BYTES) {
      setError("That picture is too detailed. Choose chunkier pixels or retro colours.");
      return;
    }
    onDone({ blob, previewUrl: URL.createObjectURL(blob) });
  }

  return (
    <div
      className="dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pixel-editor-title"
      ref={dialogRef}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !busy) onClose();
      }}
    >
      <div className="dialog pixel-editor">
        <div className="dialog__head">
          <h2 id="pixel-editor-title" className="dialog__title">
            Upload your own picture
          </h2>
          <button
            type="button"
            className="button button--quiet dialog__close"
            onClick={onClose}
            aria-label="Close dialog"
            disabled={busy}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        <p className="dialog__lede">
          It is turned into pixel art and shown small on your poster, where everyone can see it. Use
          a picture you have the right to share. A Sheriff can remove it.
        </p>

        {error ? (
          <p className="ops-alert ops-alert--error" role="alert">
            {error}
          </p>
        ) : null}

        {image === null ? (
          <label className="dropzone">
            <input
              className="dropzone__input"
              type="file"
              accept={ACCEPTED.join(",")}
              aria-describedby="pixel-source-hint"
              onChange={(event) => choose(event.target.files?.[0])}
            />
            <span className="dropzone__title">Choose an image</span>
            <span className="dropzone__hint" id="pixel-source-hint">
              JPEG, PNG or WEBP, up to 10 MB. You can crop it and choose the pixel size next.
            </span>
          </label>
        ) : (
          <div className="pixel-editor__body">
            <div className="pixel-editor__panes">
              <figure className="pixel-editor__pane">
                <canvas
                  ref={stageRef}
                  width={STAGE_PX}
                  height={STAGE_PX}
                  className="pixel-editor__stage"
                  tabIndex={0}
                  role="img"
                  aria-label="Crop. Drag, or use the arrow keys, to position the picture inside the square."
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={() => {
                    drag.current = null;
                  }}
                  onKeyDown={onStageKey}
                />
                <figcaption className="pixel-editor__caption">Crop</figcaption>
              </figure>
              <figure className="pixel-editor__pane">
                <canvas
                  ref={previewRef}
                  width={STAGE_PX}
                  height={STAGE_PX}
                  className="pixel-editor__preview"
                  role="img"
                  aria-label="Pixel-art preview of the picture as it will be saved."
                />
                <figcaption className="pixel-editor__caption">Pixel art</figcaption>
              </figure>
            </div>

            <div className="form-field slider-field">
              <label className="form-field__label" htmlFor="pixel-zoom">
                Zoom
              </label>
              <input
                className="slider"
                id="pixel-zoom"
                type="range"
                min={1}
                max={4}
                step={0.01}
                value={framing.zoom}
                aria-valuetext={`${Math.round(framing.zoom * 100)}%`}
                onChange={(event) => setFraming({ ...framing, zoom: Number(event.target.value) })}
              />
            </div>

            <fieldset className="draft-form__fieldset">
              <legend className="draft-form__legend">Pixel size</legend>
              <div className="draft-form__choices">
                {PIXEL_GRIDS.map((grid) => (
                  <label className="draft-form__choice" key={grid.cells}>
                    <input
                      type="radio"
                      name="pixel-grid"
                      checked={cells === grid.cells}
                      onChange={() => setCells(grid.cells)}
                    />
                    {grid.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="draft-form__choice">
              <input
                type="checkbox"
                checked={retro}
                onChange={(event) => setRetro(event.target.checked)}
              />
              Retro colours (fewer shades, like an old game)
            </label>

            <div className="dialog__actions">
              <button
                type="button"
                className="button button--quiet button--compact"
                onClick={() => setFraming(START_FRAMING)}
              >
                Reset crop
              </button>
              <button
                type="button"
                className="button button--quiet button--compact"
                onClick={() => setImage(null)}
              >
                Choose another image
              </button>
            </div>
          </div>
        )}

        <div className="dialog__actions">
          <button type="button" className="button button--quiet" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="button button--primary"
            onClick={() => void finish()}
            disabled={image === null || busy}
          >
            {busy ? "Making the picture…" : "Use this picture"}
          </button>
        </div>
      </div>
    </div>
  );
}
