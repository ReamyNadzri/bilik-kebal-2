"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { AVATAR_MAX_BYTES, AVATAR_SIZE_PX } from "@/contracts/profiles";

export interface AvatarEditorProps {
  /** Called with the saved picture's public URL. */
  readonly onSaved: (avatarUrl: string | null) => void;
  readonly onClose: () => void;
}

const STAGE_PX = 280;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
const QUALITIES = [0.9, 0.8, 0.7, 0.6, 0.5];

interface Transform {
  readonly zoom: number;
  readonly quarterTurns: number;
  readonly straighten: number;
  readonly x: number;
  readonly y: number;
}

const START: Transform = { zoom: 1, quarterTurns: 0, straighten: 0, x: 0, y: 0 };

/**
 * Draws the picture as the member framed it. The stage and the saved image
 * share this one function, so what they see in the circle is what is saved.
 */
function draw(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  transform: Transform,
  size: number,
) {
  const k = size / STAGE_PX;
  const turned = transform.quarterTurns % 2 === 1;
  const width = turned ? image.naturalHeight : image.naturalWidth;
  const height = turned ? image.naturalWidth : image.naturalHeight;
  const cover = Math.max(STAGE_PX / width, STAGE_PX / height);
  const scale = cover * transform.zoom * k;

  context.save();
  context.clearRect(0, 0, size, size);
  // The backdrop behind a picture that does not fill the circle: the paper
  // token, read from the stylesheet so the canvas follows the theme.
  context.fillStyle =
    getComputedStyle(document.documentElement).getPropertyValue("--bg-surface").trim() || "white";
  context.fillRect(0, 0, size, size);
  context.translate(size / 2 + transform.x * k, size / 2 + transform.y * k);
  context.rotate((transform.quarterTurns * 90 + transform.straighten) * (Math.PI / 180));
  context.scale(scale, scale);
  context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
  context.restore();
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality));
}

type Step = "choose" | "frame" | "saving" | "failed";

/**
 * Change a profile picture: choose an image, drag (or use the arrow keys) to
 * position it, zoom, turn it 90° or straighten it, then save. The browser
 * re-encodes the framed square as a 512 px WebP, which also drops any camera
 * metadata (location, device) from the original file. Only that square
 * leaves the device.
 */
export function AvatarEditor({ onSaved, onClose }: AvatarEditorProps) {
  const [step, setStep] = useState<Step>("choose");
  const [error, setError] = useState<string | null>(null);
  const [transform, setTransform] = useState<Transform>(START);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  useEffect(() => {
    const context = canvasRef.current?.getContext("2d");
    if (context && image) draw(context, image, transform, STAGE_PX);
  }, [image, transform]);

  function patch(next: Partial<Transform>) {
    setTransform((current) => ({ ...current, ...next }));
  }

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
      setTransform(START);
      setStep("frame");
    };
    loaded.onerror = () => {
      URL.revokeObjectURL(url);
      setError("That image could not be opened. Try another one.");
    };
    loaded.src = url;
  }

  function onPointerDown(event: PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX - transform.x, y: event.clientY - transform.y };
  }

  function onPointerMove(event: PointerEvent<HTMLCanvasElement>) {
    if (!drag.current) return;
    patch({ x: event.clientX - drag.current.x, y: event.clientY - drag.current.y });
  }

  function onStageKey(event: KeyboardEvent<HTMLCanvasElement>) {
    const step = event.shiftKey ? 20 : 5;
    const moves: Record<string, Partial<Transform>> = {
      ArrowLeft: { x: transform.x - step },
      ArrowRight: { x: transform.x + step },
      ArrowUp: { y: transform.y - step },
      ArrowDown: { y: transform.y + step },
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      patch(move);
    }
  }

  async function save() {
    if (!image) return;
    setStep("saving");
    setError(null);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = AVATAR_SIZE_PX;
      canvas.height = AVATAR_SIZE_PX;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("no canvas");
      draw(context, image, transform, AVATAR_SIZE_PX);

      let blob: Blob | null = null;
      for (const quality of QUALITIES) {
        blob = await toBlob(canvas, quality);
        if (blob && blob.size <= AVATAR_MAX_BYTES) break;
      }
      if (!blob || blob.size > AVATAR_MAX_BYTES || blob.type !== "image/webp") {
        throw new Error("encode");
      }

      const slot = await fetch("/api/profile/avatar/upload-url", { method: "POST" });
      const slotBody = (await slot.json()) as
        | { ok: true; data: { objectKey: string; signedUrl: string } }
        | { ok: false; message: string };
      if (!slotBody.ok) throw new Error(slotBody.message);

      const stored = await fetch(slotBody.data.signedUrl, {
        method: "PUT",
        body: blob,
        headers: { "Content-Type": "image/webp" },
      });
      if (!stored.ok) throw new Error("upload");

      const saved = await fetch("/api/profile/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objectKey: slotBody.data.objectKey }),
      });
      const savedBody = (await saved.json()) as
        { ok: true; data: { avatarUrl: string | null } } | { ok: false; message: string };
      if (!savedBody.ok) throw new Error(savedBody.message);

      onSaved(savedBody.data.avatarUrl);
    } catch {
      setStep("failed");
      setError("Your picture was not saved. Check your connection and try again.");
    }
  }

  return (
    <div
      className="dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="avatar-editor-title"
      ref={dialogRef}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === "Escape" && step !== "saving") onClose();
      }}
    >
      <div className="dialog">
        <div className="dialog__head">
          <h2 id="avatar-editor-title" className="dialog__title">
            Change your picture
          </h2>
          <button
            type="button"
            className="button button--quiet dialog__close"
            onClick={onClose}
            aria-label="Close dialog"
            disabled={step === "saving"}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        {error ? (
          <p className="ops-alert ops-alert--error dialog__lede" role="alert">
            {error}
          </p>
        ) : null}

        {step === "choose" || image === null ? (
          <label className="dropzone">
            <input
              className="dropzone__input"
              type="file"
              accept={ACCEPTED.join(",")}
              aria-describedby="avatar-source-hint"
              onChange={(event) => choose(event.target.files?.[0])}
            />
            <span className="dropzone__title">Choose a photo</span>
            <span className="dropzone__hint" id="avatar-source-hint">
              JPEG, PNG or WEBP, up to 10 MB. You can crop and rotate it next.
            </span>
          </label>
        ) : (
          <div className="avatar-editor">
            <div className="avatar-editor__stage">
              <canvas
                ref={canvasRef}
                width={STAGE_PX}
                height={STAGE_PX}
                className="avatar-editor__canvas"
                tabIndex={0}
                role="img"
                aria-label="Picture preview. Drag, or use the arrow keys, to position it inside the circle."
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={() => {
                  drag.current = null;
                }}
                onKeyDown={onStageKey}
              />
              <span className="avatar-editor__mask" aria-hidden="true" />
            </div>

            <div className="form-field slider-field">
              <label className="form-field__label" htmlFor="avatar-zoom">
                Zoom
              </label>
              <input
                className="slider"
                id="avatar-zoom"
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={transform.zoom}
                aria-valuetext={`${Math.round(transform.zoom * 100)}%`}
                onChange={(event) => patch({ zoom: Number(event.target.value) })}
              />
            </div>

            <div className="form-field slider-field">
              <label className="form-field__label" htmlFor="avatar-straighten">
                Straighten
              </label>
              <input
                className="slider"
                id="avatar-straighten"
                type="range"
                min={-45}
                max={45}
                step={1}
                value={transform.straighten}
                aria-valuetext={`${transform.straighten} degrees`}
                onChange={(event) => patch({ straighten: Number(event.target.value) })}
              />
            </div>

            <div className="dialog__actions avatar-editor__tools">
              <button
                type="button"
                className="button button--secondary button--compact"
                onClick={() => patch({ quarterTurns: (transform.quarterTurns + 3) % 4 })}
              >
                Rotate left
              </button>
              <button
                type="button"
                className="button button--secondary button--compact"
                onClick={() => patch({ quarterTurns: (transform.quarterTurns + 1) % 4 })}
              >
                Rotate right
              </button>
              <button
                type="button"
                className="button button--quiet button--compact"
                onClick={() => setTransform(START)}
              >
                Reset
              </button>
            </div>
          </div>
        )}

        <div className="dialog__actions">
          {image !== null && step !== "choose" ? (
            <button
              type="button"
              className="button button--quiet"
              onClick={() => {
                setImage(null);
                setStep("choose");
              }}
              disabled={step === "saving"}
            >
              Choose another
            </button>
          ) : null}
          <button
            type="button"
            className="button button--primary"
            onClick={() => void save()}
            disabled={image === null || step === "saving"}
          >
            {step === "saving" ? "Saving…" : "Save picture"}
          </button>
        </div>
      </div>
    </div>
  );
}
