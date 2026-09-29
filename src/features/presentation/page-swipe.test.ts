import {
  PAGE_SWIPE_ORDER,
  modalIsOpen,
  swipeDestination,
  touchBelongsElsewhere,
} from "./page-swipe";

const quick = { dy: 0, ms: 300 };

describe("swipeDestination", () => {
  test("follows the tab bar's order, with Hunt on the claims route", () => {
    expect(PAGE_SWIPE_ORDER).toEqual(["/", "/board", "/map", "/claims", "/archive"]);
  });

  test("swiping left moves to the next page and right to the previous one", () => {
    expect(swipeDestination("/board", { ...quick, dx: -90 })).toBe("/map");
    expect(swipeDestination("/board", { ...quick, dx: 90 })).toBe("/");
  });

  test("stops at either end", () => {
    expect(swipeDestination("/", { ...quick, dx: 90 })).toBeNull();
    expect(swipeDestination("/archive", { ...quick, dx: -90 })).toBeNull();
  });

  test("needs at least 70 px sideways", () => {
    expect(swipeDestination("/map", { ...quick, dx: -69 })).toBeNull();
    expect(swipeDestination("/map", { ...quick, dx: -70 })).toBe("/claims");
  });

  test("ignores a stroke that drifts more than half as far vertically", () => {
    expect(swipeDestination("/map", { dx: -100, dy: 51, ms: 300 })).toBeNull();
    expect(swipeDestination("/map", { dx: -100, dy: -50, ms: 300 })).toBe("/claims");
  });

  test("ignores a stroke slower than 700 ms", () => {
    expect(swipeDestination("/map", { dx: -100, dy: 0, ms: 701 })).toBeNull();
    expect(swipeDestination("/map", { dx: -100, dy: 0, ms: 700 })).toBe("/claims");
  });

  test("takes no part on screens beneath the main pages", () => {
    expect(swipeDestination("/wanted/csc510", { ...quick, dx: -90 })).toBeNull();
    expect(swipeDestination("/profile", { ...quick, dx: 90 })).toBeNull();
  });
});

describe("touchBelongsElsewhere", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  test("leaves a stroke that began in a field to the field", () => {
    document.body.innerHTML = `<label><span id="inside">x</span><input id="field" /></label>
      <textarea id="area"></textarea><select id="pick"></select>`;

    for (const id of ["field", "area", "pick"]) {
      expect(touchBelongsElsewhere(document.getElementById(id))).toBe(true);
    }
    expect(touchBelongsElsewhere(document.getElementById("inside"))).toBe(false);
  });

  test("leaves a stroke on a rail that actually overflows to the rail", () => {
    document.body.innerHTML = `<ul id="rail" style="overflow-x: auto"><li id="poster">x</li></ul>`;
    const rail = document.getElementById("rail") as HTMLElement;
    Object.defineProperty(rail, "scrollWidth", { value: 900 });
    Object.defineProperty(rail, "clientWidth", { value: 360 });

    expect(touchBelongsElsewhere(document.getElementById("poster"))).toBe(true);
  });

  test("takes a stroke on a scroller with nothing to scroll", () => {
    document.body.innerHTML = `<ul id="rail" style="overflow-x: auto"><li id="poster">x</li></ul>`;
    const rail = document.getElementById("rail") as HTMLElement;
    Object.defineProperty(rail, "scrollWidth", { value: 360 });
    Object.defineProperty(rail, "clientWidth", { value: 360 });

    expect(touchBelongsElsewhere(document.getElementById("poster"))).toBe(false);
  });
});

describe("modalIsOpen", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  test("notices a modal dialog over the page", () => {
    expect(modalIsOpen()).toBe(false);
    document.body.innerHTML = `<div role="dialog" aria-modal="true"></div>`;
    expect(modalIsOpen()).toBe(true);
  });
});
