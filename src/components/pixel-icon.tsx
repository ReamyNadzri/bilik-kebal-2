import { PixelArt } from "./pixel-art";

/**
 * The shell's small pixel icons, drawn in the current text colour.
 *
 * Decorative only. Every icon sits beside a visible or accessible word; none
 * carries meaning on its own (context/ui-context.md, Component Foundation).
 */
const ICONS = {
  bell: [
    "    ##    ",
    "   ####   ",
    "  ######  ",
    "  ######  ",
    "  ######  ",
    " ######## ",
    "##########",
    "          ",
    "    ##    ",
  ],
  person: [
    "   ####   ",
    "  ######  ",
    "  ######  ",
    "   ####   ",
    "          ",
    "  ######  ",
    " ######## ",
    "##########",
    "##########",
  ],
  search: [
    "  ####    ",
    " #    #   ",
    "#      #  ",
    "#      #  ",
    "#      #  ",
    " #    #   ",
    "  #####   ",
    "      ### ",
    "       ###",
    "        ##",
  ],
} as const;

export type PixelIconName = keyof typeof ICONS;

const PALETTE = { "#": "pixel-current" } as const;

export function PixelIcon({
  name,
  className,
}: {
  readonly name: PixelIconName;
  readonly className?: string;
}) {
  return (
    <PixelArt
      rows={ICONS[name]}
      palette={PALETTE}
      {...(className === undefined ? {} : { className })}
    />
  );
}
