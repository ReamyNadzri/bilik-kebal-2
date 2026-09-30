"use client";

import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import type { WantedSummary } from "@/features/marketplace/types";
import {
  chatShareUrl,
  renderSharePoster,
  shareWantedContent,
  type ShareWantedContent,
} from "@/features/presentation/share-wanted";
import { playSoundEffect } from "../sound-effects";
import { usePrefersReducedMotion } from "./gunshot-transition";
import { useShareFit } from "./use-share-fit";

export interface SharePosterProps {
  readonly wanted: WantedSummary;
  readonly onClose: () => void;
}

type ShareTarget = "whatsapp" | "telegram" | "other";

/**
 * Share a Wanted as a poster picture with a caption.
 *
 * The capture poster's drop, dust and thud (capture-poster.tsx), without the
 * stamp or ink: nothing has been captured, the request is being passed on.
 *
 * The picture is drawn when the dialog opens, so a share button hands it to
 * the system share sheet straight from the click; browsers refuse a share
 * that follows a slow await. Where files cannot be shared (most desktops),
 * WhatsApp and Telegram open with the caption and link, and the picture is
 * saved for the person to attach.
 *
 * The dialog never scrolls: `useShareFit` lays the poster out at a fixed size
 * and scales it into whatever the caption leaves, side by side or stacked.
 */
export function SharePoster({ wanted, onClose }: SharePosterProps) {
  const still = usePrefersReducedMotion();
  const firstRef = useRef<HTMLButtonElement>(null);
  const soundedRef = useRef(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const captionRef = useRef<HTMLDivElement>(null);
  const fit = useShareFit(sheetRef, captionRef);
  const [content] = useState<ShareWantedContent>(() =>
    shareWantedContent(wanted, window.location.origin),
  );
  const [file, setFile] = useState<File | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  // Wind as the poster drops, in step with the animation; once per poster.
  useEffect(() => {
    if (still || soundedRef.current) return;
    soundedRef.current = true;
    playSoundEffect("share");
  }, [still]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    void renderSharePoster(content).then((blob) => {
      if (!cancelled && blob) {
        setFile(
          new File([blob], `vaultix-wanted-${wanted.id.slice(0, 8)}.png`, { type: "image/png" }),
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [content, wanted.id]);

  const canShareFile =
    file !== null &&
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] });

  function saveImage() {
    if (!file) return false;
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  }

  async function share(target: ShareTarget) {
    setNotice(null);
    if (canShareFile && file) {
      try {
        await navigator.share({ files: [file], text: content.caption, title: content.title });
        return;
      } catch (error) {
        // Dismissing the sheet is a choice, not a failure.
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    if (target === "other") {
      if (typeof navigator.share === "function") {
        try {
          await navigator.share({ text: content.caption, title: content.title, url: content.url });
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return;
        }
      }
      await copyCaption();
      return;
    }
    const saved = saveImage();
    window.open(chatShareUrl(target, content), "_blank", "noopener,noreferrer");
    const app = target === "whatsapp" ? "WhatsApp" : "Telegram";
    setNotice(
      saved
        ? `${app} opened with the caption. The poster picture was saved to your downloads; attach it in the chat.`
        : `${app} opened with the caption. The picture could not be made on this device.`,
    );
  }

  async function copyCaption() {
    try {
      await navigator.clipboard.writeText(content.caption);
      setNotice("Caption and link copied.");
    } catch {
      setNotice("Copying is blocked here. Select the caption above and copy it.");
    }
  }

  const stop = (event: MouseEvent) => event.stopPropagation();

  const layout = [
    fit.side ? "" : " share-poster--stacked",
    fit.tight ? " share-poster--tight" : "",
    still ? " capture-poster--still" : "",
  ].join("");
  const fitVars = {
    "--share-scale": String(fit.scale),
    "--share-poster-h": `${fit.posterH}px`,
    "--share-pad-v": `${fit.padV}px`,
  } as CSSProperties;

  const node = (
    <div
      className={`vx-motion capture-poster capture-poster--share${layout}`}
      style={fitVars}
      role="dialog"
      aria-modal="true"
      aria-label={`Share this Wanted: ${wanted.title}`}
      onClick={onClose}
    >
      {/* The scale sits on wrappers: the sheet already animates its own transform. */}
      <div className="share-poster__fit">
        <div className="share-poster__scale">
          <div ref={sheetRef} className="capture-poster__sheet" onClick={stop} aria-hidden="true">
            <span className="capture-poster__pin" />
            <p className="capture-poster__heading">{content.heading}</p>
            <div className="capture-poster__portrait">
              <span className="capture-poster__code">{content.code}</span>
              <span className="capture-poster__course">{content.subject}</span>
            </div>
            <p className="capture-poster__title">{content.title}</p>
            <div className="capture-poster__reward">
              <span className="capture-poster__reward-label">{content.rewardLabel}</span>
              <span className="capture-poster__amount">{content.reward}</span>
            </div>
            <span className="capture-poster__dust capture-poster__dust--left" />
            <span className="capture-poster__dust capture-poster__dust--right" />
          </div>
        </div>
      </div>

      <div ref={captionRef} className="capture-poster__caption" onClick={stop}>
        <p className="capture-poster__eyebrow">Share this Wanted</p>
        <p className="capture-poster__message share-poster__caption">{content.caption}</p>
        <div className="capture-poster__actions">
          <button
            ref={firstRef}
            type="button"
            className="capture-poster__hunt"
            onClick={() => void share("whatsapp")}
          >
            WhatsApp
          </button>
          <button
            type="button"
            className="capture-poster__hunt"
            onClick={() => void share("telegram")}
          >
            Telegram
          </button>
          <button
            type="button"
            className="capture-poster__close"
            onClick={() => void share("other")}
          >
            Other apps
          </button>
          <button
            type="button"
            className="capture-poster__close"
            onClick={() => {
              if (saveImage()) setNotice("Poster picture saved to your downloads.");
            }}
            disabled={file === null}
          >
            {file === null ? "Preparing picture…" : "Save picture"}
          </button>
          <button
            type="button"
            className="capture-poster__close"
            onClick={() => void copyCaption()}
          >
            Copy caption
          </button>
          <button type="button" className="capture-poster__close" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="capture-poster__message share-poster__notice" role="status">
          {notice ?? ""}
        </p>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
