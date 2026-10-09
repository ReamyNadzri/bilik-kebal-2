"use client";

import { useState } from "react";
import type { Sen } from "@/contracts/marketplace";
import { formatRinggit } from "@/features/marketplace/money";
import { PixelIcon } from "../pixel-icon";

/**
 * Copies the exact amount to type, as the bare figure a banking or e-wallet
 * app's amount field expects ("11.00", no "RM"). The figure is also on screen,
 * so a refusal to copy never hides it.
 */
export function CopyAmountButton({ amount }: { readonly amount: Sen }) {
  const [notice, setNotice] = useState("");
  const figure = formatRinggit(amount, { unit: "omit", cents: "always" });

  async function copy() {
    try {
      await navigator.clipboard.writeText(figure);
      setNotice(`Copied ${figure}.`);
    } catch {
      setNotice("Copying is blocked here. Type the amount shown above.");
    }
  }

  return (
    <div className="pay-amount__copy">
      <button type="button" className="button button--brass" onClick={() => void copy()}>
        <PixelIcon name="copy" className="pay-icon" />
        Copy amount
      </button>
      <p className="pay-amount__notice" role="status">
        {notice}
      </p>
    </div>
  );
}
