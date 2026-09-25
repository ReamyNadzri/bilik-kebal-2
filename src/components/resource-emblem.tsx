import { PixelArt } from "./pixel-art";
import { emblemForWanted, type EmblemKind } from "@/features/presentation/resource-emblem";

/*
 * k ink · p paper · r red · g green · b brass. Colours resolve through the
 * `resource-emblem__px--*` classes, which read semantic tokens.
 */
const PALETTE = {
  k: "resource-emblem__px--ink",
  p: "resource-emblem__px--paper",
  r: "resource-emblem__px--red",
  g: "resource-emblem__px--green",
  b: "resource-emblem__px--brass",
} as const;

const DRAWINGS: Record<EmblemKind, readonly string[]> = {
  notes: [
    "                ",
    "  kkkkkkkkkkkk  ",
    "  kbpppppppppk  ",
    "  kbpkkkkkkppk  ",
    "  kbpppppppppk  ",
    "  kbpkkkkkkkpk  ",
    "  kbpppppppppk  ",
    "  kbpkkkkkpppk  ",
    "  kbpppppppppk  ",
    "  kbpkkkkkkkpk  ",
    "  kbpppppppppk  ",
    "  kbpkkkkpppgk  ",
    "  kbppppppppgk  ",
    "  kbpppppppggk  ",
    "  kkkkkkkkkkkk  ",
    "                ",
  ],
  slides: [
    "                ",
    " kkkkkkkkkkkkkk ",
    " kppppppppppppk ",
    " kpggggggpppppk ",
    " kppppppppppppk ",
    " kpkkkkkkkkpppk ",
    " kppppppppppppk ",
    " kpkkkkkppprrpk ",
    " kpppppppprrrpk ",
    " kppppppppppppk ",
    " kkkkkkkkkkkkkk ",
    "       kk       ",
    "      k  k      ",
    "     k    k     ",
    "    k      k    ",
    "                ",
  ],
  exam: [
    "                ",
    "  kkkkkkkkkkkk  ",
    "  kbbbbbbbbbbk  ",
    "   kppppppppk   ",
    "   kpkkkkkkpk   ",
    "   kppppppppk   ",
    "   kpkkkkkppk   ",
    "   kppppppppk   ",
    "   kpkkkkkkpk   ",
    "   kpppppprrk   ",
    "   kppppprrrr   ",
    "   kpppppprrk   ",
    "  kbbbbbbbbbbk  ",
    "  kkkkkkkkkkkk  ",
    "                ",
    "                ",
  ],
  formula: [
    "                ",
    "  kkkkkkkkkkkk  ",
    "  kppppppppppk  ",
    "  kpkkkkkkkppk  ",
    "  kppkpppppppk  ",
    "  kpppkppppppk  ",
    "  kppppkpppppk  ",
    "  kpppkppppppk  ",
    "  kppkpppppppk  ",
    "  kpkkkkkkkppk  ",
    "  kppppppppppk  ",
    "  kppbbpbbpbbk  ",
    "  kppppppppppk  ",
    "  kkkkkkkkkkkk  ",
    "                ",
    "                ",
  ],
  lab: [
    "                ",
    "     kkkkkk     ",
    "      kppk      ",
    "      kppk      ",
    "      kppk      ",
    "     kppppk     ",
    "    kppppppk    ",
    "   kppppppppk   ",
    "  kggggggggggk  ",
    "  kgggpggggggk  ",
    " kggggggggpgggk ",
    " kggpgggggggggk ",
    " kggggggggggggk ",
    "  kkkkkkkkkkkk  ",
    "                ",
    "                ",
  ],
  worked: [
    "                ",
    "  kkkkkkkkkk    ",
    "  kppppppppk    ",
    "  kpkkkkkppk    ",
    "  kppppppppk  kk",
    "  kpkkkkkkpk kbk",
    "  kppppppppkkbk ",
    "  kpppppgpkkbk  ",
    "  kppppggpkbk   ",
    "  kpgpggppkk    ",
    "  kpgggpppk     ",
    "  kppgppppk     ",
    "  kppppppppk    ",
    "  kkkkkkkkkk    ",
    "                ",
    "                ",
  ],
  lost: [
    "                ",
    "    kkkkkk      ",
    "   kppppppk     ",
    "  kpbbpppppk    ",
    "  kpbppppppk    ",
    "  kppppppppk    ",
    "  kppppppppk    ",
    "  kppppppppk    ",
    "   kppppppk     ",
    "    kkkkkkrk    ",
    "          krrk  ",
    "           krrk ",
    "            krrk",
    "             kk ",
    "                ",
    "                ",
  ],
  talk: [
    "                ",
    "  kkkkkkkkkkkk  ",
    " kppppppppppppk ",
    " kpkkkkkkkkkppk ",
    " kppppppppppppk ",
    " kpkkkkkkkppppk ",
    " kppppppppppppk ",
    " kpggggpppppppk ",
    " kppppppppppppk ",
    "  kkkkpkkkkkkk  ",
    "     kpk        ",
    "    kpk         ",
    "    kk          ",
    "                ",
    "                ",
    "                ",
  ],
};

export interface ResourceEmblemProps {
  /** The resource type label as the taxonomy words it. */
  readonly resourceType: string;
  /** The request kind; missing items and discussions have their own drawing. */
  readonly kind?: "academic" | "missing_item" | "discussion";
}

/**
 * The portrait frame of a Wanted poster, holding a drawing of the kind of
 * resource wanted. Decorative: the resource type is written on the poster.
 */
export function ResourceEmblem({ resourceType, kind = "academic" }: ResourceEmblemProps) {
  const emblem = emblemForWanted(kind, resourceType);
  return (
    <div className="emblem-frame" data-emblem={emblem}>
      <PixelArt rows={DRAWINGS[emblem]} palette={PALETTE} className="resource-emblem" />
    </div>
  );
}
