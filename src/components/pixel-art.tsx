/**
 * A drawing on a pixel grid, rendered as crisp SVG rectangles.
 *
 * Each row is a string and each character one cell. A space is transparent;
 * any other character is looked up in `palette`, which maps it to a CSS class,
 * so the colours come from semantic tokens in globals.css and never from this
 * file. Adjacent cells of one class on a row are merged into one rectangle to
 * keep the markup small.
 *
 * Always decorative: the caller writes the meaning beside the drawing, so the
 * SVG is hidden from assistive technology.
 */
export interface PixelArtProps {
  readonly rows: readonly string[];
  readonly palette: Readonly<Record<string, string>>;
  readonly className?: string;
}

interface Run {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly className: string;
}

function toRuns(rows: readonly string[], palette: Readonly<Record<string, string>>): Run[] {
  const runs: Run[] = [];

  rows.forEach((row, y) => {
    let x = 0;

    while (x < row.length) {
      const cell = row[x] ?? " ";
      const className = palette[cell];

      if (className === undefined) {
        x += 1;
        continue;
      }

      let width = 1;

      while (row[x + width] === cell) {
        width += 1;
      }

      runs.push({ x, y, width, className });
      x += width;
    }
  });

  return runs;
}

export function PixelArt({ rows, palette, className }: PixelArtProps) {
  const width = Math.max(...rows.map((row) => row.length));
  const runs = toRuns(rows, palette);

  return (
    <svg
      className={className}
      viewBox={`0 0 ${width} ${rows.length}`}
      aria-hidden="true"
      focusable="false"
    >
      {runs.map((run) => (
        <rect
          key={`${run.x}-${run.y}`}
          className={run.className}
          x={run.x}
          y={run.y}
          width={run.width}
          height={1}
        />
      ))}
    </svg>
  );
}
