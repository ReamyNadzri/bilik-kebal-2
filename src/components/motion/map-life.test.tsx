import { render } from "@testing-library/react";
import { MapLife } from "./map-life";

function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduce && query === "(prefers-reduced-motion: reduce)",
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

afterEach(() => vi.unstubAllGlobals());

test("renders nothing when the viewer prefers reduced motion", () => {
  stubReducedMotion(true);
  const { container } = render(<MapLife />);

  expect(container).toBeEmptyDOMElement();
});

test("otherwise lays a decorative layer that pins can be clicked through", () => {
  stubReducedMotion(false);
  const { container } = render(<MapLife />);
  const layer = container.firstElementChild;

  expect(layer).toHaveClass("map-life");
  expect(layer).toHaveAttribute("aria-hidden", "true");
  expect(layer?.querySelectorAll(".map-life__glint")).toHaveLength(14);
  expect(layer?.querySelectorAll(".map-life__sprite")).toHaveLength(5);
  expect(layer?.querySelectorAll(".map-life__bird")).toHaveLength(8);
});

test("switches each part off on request", () => {
  stubReducedMotion(false);
  const { container } = render(<MapLife sea={false} ships={false} birds={false} />);

  expect(container.firstElementChild).toBeEmptyDOMElement();
});
