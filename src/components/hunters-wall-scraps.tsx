import type { CSSProperties, ReactNode } from "react";

/**
 * Old flyers and newspaper behind the Hunters' posters. Decorative only:
 * hidden from assistive technology and from the pointer, drawn in CSS and
 * text with no images. The phone numbers are deliberately unreadable
 * placeholders.
 */

interface Scrap {
  readonly id: string;
  /** Position and size on the board, in percent; the tilt in degrees. */
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly rotate: number;
  readonly tone:
    "paper" | "notice" | "rent" | "seen" | "tuition" | "blank" | "red" | "dark" | "receipt";
  readonly children: ReactNode;
}

function Bars({ widths, dark = false }: { widths: readonly number[]; dark?: boolean }) {
  return widths.map((width, index) => (
    <span
      key={index}
      className={`wall-scrap__bar${dark ? " wall-scrap__bar--dark" : ""}`}
      style={{ width: `${width}%` }}
    />
  ));
}

const SCRAPS: readonly Scrap[] = [
  {
    id: "gazette",
    left: 2,
    top: 4,
    width: 17,
    rotate: -3,
    tone: "paper",
    children: (
      <>
        <span className="wall-scrap__masthead">The Campus Gazette</span>
        <span className="wall-scrap__headline">Lights seen in the old library after midnight</span>
        <Bars widths={[92, 86, 95, 70, 88, 60, 90]} />
      </>
    ),
  },
  {
    id: "curfew",
    left: 80,
    top: 3,
    width: 15,
    rotate: 4,
    tone: "notice",
    children: (
      <>
        <span className="wall-scrap__kicker">Notice</span>
        <span className="wall-scrap__shout">Curfew 11 PM</span>
        <span className="wall-scrap__small">By order of the Hostel Office</span>
      </>
    ),
  },
  {
    id: "rent",
    left: 38,
    top: -2,
    width: 16,
    rotate: 2,
    tone: "rent",
    children: (
      <>
        <span className="wall-scrap__title">Room for rent</span>
        <span className="wall-scrap__small">Near Seksyen 7. Female only.</span>
        <span className="wall-scrap__tabs">
          {Array.from({ length: 6 }, (_, index) => (
            <span key={index} className="wall-scrap__tab">
              01X-XXX
            </span>
          ))}
        </span>
      </>
    ),
  },
  {
    id: "harvest",
    left: 60,
    top: 42,
    width: 15,
    rotate: -5,
    tone: "red",
    children: (
      <>
        <span className="wall-scrap__display">Harvest Festival</span>
        <span className="wall-scrap__kicker">Dataran · Sat night</span>
      </>
    ),
  },
  {
    id: "swap",
    left: -2,
    top: 50,
    width: 14,
    rotate: 6,
    tone: "paper",
    children: (
      <>
        <span className="wall-scrap__title">Swap meet</span>
        <span className="wall-scrap__small">Arts &amp; crafts · 9 AM</span>
        <Bars widths={[92, 86, 95]} />
      </>
    ),
  },
  {
    id: "magazine",
    left: 86,
    top: 44,
    width: 14,
    rotate: -3,
    tone: "dark",
    children: (
      <>
        <span className="wall-scrap__display wall-scrap__display--small">Night Shift</span>
        <span className="wall-scrap__issue">Issue 13</span>
        <Bars widths={[92, 86, 95, 70, 88, 60]} dark />
      </>
    ),
  },
  {
    id: "seen",
    left: 20,
    top: 78,
    width: 16,
    rotate: 3,
    tone: "seen",
    children: (
      <>
        <span className="wall-scrap__title wall-scrap__title--red">Have you seen them?</span>
        <Bars widths={[92, 86, 95, 70, 88]} />
      </>
    ),
  },
  {
    id: "receipt",
    left: 70,
    top: 80,
    width: 12,
    rotate: -6,
    tone: "receipt",
    children: (
      <>
        Kedai Runcit 24J
        <br />
        Roti ...... 2.50
        <br />
        Lilin ...... 4.00
        <br />
        Lampu suluh 18.90
        <br />
        Total ...... 25.40
      </>
    ),
  },
  {
    id: "cat",
    left: 44,
    top: 88,
    width: 14,
    rotate: -2,
    tone: "paper",
    children: (
      <>
        <span className="wall-scrap__title">Lost cat</span>
        <span className="wall-scrap__small">Answers to “Comot”</span>
        <Bars widths={[92, 86]} />
      </>
    ),
  },
  {
    id: "tuition",
    left: 8,
    top: 26,
    width: 12,
    rotate: 8,
    tone: "tuition",
    children: (
      <>
        <span className="wall-scrap__title wall-scrap__title--left">Tuisyen Math</span>
        <Bars widths={[92, 86, 95, 70]} />
      </>
    ),
  },
  {
    id: "classifieds",
    left: 26,
    top: 32,
    width: 13,
    rotate: -4,
    tone: "paper",
    children: (
      <>
        <span className="wall-scrap__rule">Classifieds</span>
        <Bars widths={[92, 86, 95, 70, 88, 60, 90, 80]} />
      </>
    ),
  },
  {
    id: "blank",
    left: 76,
    top: 22,
    width: 13,
    rotate: 5,
    tone: "blank",
    children: <Bars widths={[92, 86, 95, 70, 88, 60, 90, 80, 75]} />,
  },
];

export function HuntersWallScraps() {
  return (
    <div className="wall-scraps" aria-hidden="true">
      {SCRAPS.map((scrap) => (
        <div
          key={scrap.id}
          className="wall-scrap"
          style={
            {
              "--scrap-left": `${scrap.left}%`,
              "--scrap-top": `${scrap.top}%`,
              "--scrap-width": `${scrap.width}%`,
              "--scrap-rotate": `${scrap.rotate}deg`,
            } as CSSProperties
          }
        >
          <div className={`wall-scrap__sheet wall-scrap__sheet--${scrap.tone}`}>
            {scrap.children}
          </div>
        </div>
      ))}
    </div>
  );
}
