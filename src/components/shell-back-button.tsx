"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

interface NavigationHistory {
  readonly canGoBack?: boolean;
}

/**
 * Whether stepping back stays inside VAULTIX.
 *
 * The Navigation API answers directly and only counts this site's own
 * entries. Where it is missing, the count of screens seen since the shell
 * mounted stands in: the first screen of a visit has nowhere in-app to go
 * back to.
 */
function canGoBackInApp(screensSeen: number): boolean {
  const navigation = (window as Window & { navigation?: NavigationHistory }).navigation;
  if (typeof navigation?.canGoBack === "boolean") return navigation.canGoBack;
  return screensSeen > 1;
}

/**
 * The compact header's back control (design_handoff_vaultix_mobile, §1).
 *
 * Shown on every screen but the homepage, below 1200 px only (CSS). A phone
 * browser's own back control is often hidden while scrolling, so the header
 * offers one. With no in-app history — a shared link opened cold — it leads
 * home instead of out of the site.
 */
export function ShellBackButton() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const screensSeen = useRef(0);

  useEffect(() => {
    screensSeen.current += 1;
  }, [pathname]);

  if (pathname === "/") return null;

  return (
    <button
      type="button"
      className="shell-compact__back"
      aria-label="Go back"
      onClick={() => {
        if (canGoBackInApp(screensSeen.current)) router.back();
        else router.push("/");
      }}
    >
      <span aria-hidden="true">‹</span>
    </button>
  );
}
