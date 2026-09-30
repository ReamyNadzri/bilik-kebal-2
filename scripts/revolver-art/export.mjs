// Re-exports public/brand/revolver-reload.png and prints the frame timings from
// the drawing in preview.html. Run: node scripts/revolver-art/export.mjs
// Needs Python 3 with Pillow for the PNG write (no Node image dependency added).
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, "preview.html"), "utf8");
const source = html.slice(html.indexOf("<script>") + 8, html.indexOf("// ── Playback"));
const { C, all, grids } = new Function(
  `${source}; const all = frames(); return { C, all, grids: all.map(draw) };`,
)();

const dump = join(here, ".frames.json");
writeFileSync(dump, JSON.stringify({ C, grids }));
execFileSync(
  "python",
  [
    "-c",
    `
import json, sys
from PIL import Image
d = json.load(open(sys.argv[1])); C = d["C"]; g = d["grids"]; W, H = 72, 48
img = Image.new("RGBA", (W * len(g), H), (0, 0, 0, 0))
for i, frame in enumerate(g):
    for y in range(H):
        for x in range(W):
            c = frame[y][x]
            if c:
                h = C[c].lstrip("#")
                img.putpixel((i * W + x, y), tuple(int(h[k:k + 2], 16) for k in (0, 2, 4)) + (255,))
img.save(sys.argv[2], optimize=True)
`,
    dump,
    join(here, "../../public/brand/revolver-reload.png"),
  ],
  { stdio: "inherit" },
);
console.log(
  `${all.length} frames, ${all.reduce((t, f) => t + f.ms, 0)} ms:`,
  all.map((f) => f.ms).join(", "),
);
console.log(
  "Update the keyframes in src/app/globals.css (loading-indicator-reload) if timings changed.",
);
