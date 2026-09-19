import { toSen, type Sen } from "./money";

/**
 * Development fixture for `/map`, the Explore Map.
 *
 * No operation yet reports demand by campus, so every count and bounty below
 * is invented, and the route carries a `FixtureNotice` saying so. The campus
 * names, states and pin positions come from the approved visual handoff; the
 * positions are presentation data — percentages across the illustrated map in
 * `public/brand/map-malaysia.webp` — and stay here when a real read replaces
 * the figures (docs/superpowers/specs/2026-09-16-vaultix-frontier-visual-handoff.md §7.1).
 *
 * Money is integer sen, like every other amount in the product.
 */
export interface CampusDemand {
  readonly id: string;
  readonly name: string;
  readonly state: string;
  readonly openCount: number;
  readonly grossBountySen: Sen;
  /** Horizontal pin position, as a percentage of the map's width. */
  readonly x: number;
  /** Vertical pin position (the pin's tip), as a percentage of the map's height. */
  readonly y: number;
}

export const CAMPUS_DEMAND: readonly CampusDemand[] = [
  { id: "arau", name: "UiTM Arau", state: "Perlis", openCount: 6, grossBountySen: toSen(320), x: 7, y: 13 },
  {
    id: "sungai-petani",
    name: "UiTM Sungai Petani",
    state: "Kedah",
    openCount: 9,
    grossBountySen: toSen(620),
    x: 14,
    y: 22,
  },
  {
    id: "pulau-pinang",
    name: "UiTM Pulau Pinang",
    state: "Penang",
    openCount: 12,
    grossBountySen: toSen(510),
    x: 6,
    y: 31,
  },
  {
    id: "seri-iskandar",
    name: "UiTM Seri Iskandar",
    state: "Perak",
    openCount: 8,
    grossBountySen: toSen(780),
    x: 17,
    y: 37,
  },
  {
    id: "kota-bharu",
    name: "UiTM Kota Bharu",
    state: "Kelantan",
    openCount: 4,
    grossBountySen: toSen(480),
    x: 28,
    y: 26,
  },
  {
    id: "dungun",
    name: "UiTM Dungun",
    state: "Terengganu",
    openCount: 7,
    grossBountySen: toSen(410),
    x: 41,
    y: 39,
  },
  {
    id: "shah-alam",
    name: "UiTM Shah Alam",
    state: "Selangor",
    openCount: 34,
    grossBountySen: toSen(780),
    x: 16,
    y: 49,
  },
  { id: "raub", name: "UiTM Raub", state: "Pahang", openCount: 5, grossBountySen: toSen(540), x: 32, y: 51 },
  {
    id: "seremban",
    name: "UiTM Seremban",
    state: "Negeri Sembilan",
    openCount: 11,
    grossBountySen: toSen(430),
    x: 21,
    y: 60,
  },
  { id: "jasin", name: "UiTM Jasin", state: "Melaka", openCount: 8, grossBountySen: toSen(620), x: 25, y: 69 },
  {
    id: "segamat",
    name: "UiTM Segamat",
    state: "Johor",
    openCount: 10,
    grossBountySen: toSen(950),
    x: 34,
    y: 77,
  },
  {
    id: "samarahan",
    name: "UiTM Samarahan",
    state: "Sarawak",
    openCount: 9,
    grossBountySen: toSen(380),
    x: 62,
    y: 63,
  },
  {
    id: "kota-kinabalu",
    name: "UiTM Kota Kinabalu",
    state: "Sabah",
    openCount: 5,
    grossBountySen: toSen(290),
    x: 86,
    y: 53,
  },
];

/** The campus the map opens on. */
export const DEFAULT_CAMPUS_ID = "shah-alam";
