import type { Metadata } from "next";
import { CampusMap } from "@/components/campus-map";
import { FixtureNotice } from "@/components/fixture-notice";
import {
  CAMPUS_DEMAND,
  DEFAULT_CAMPUS_ID,
} from "@/features/marketplace/campus-demand-fixtures";

export const metadata: Metadata = {
  title: "Explore Map | VAULTIX",
  description: "See where students are asking for academic resources, campus by campus.",
};

/**
 * The Explore Map from the visual handoff.
 *
 * No operation reports demand by campus yet (proposed in
 * docs/superpowers/specs/2026-09-16-vaultix-frontier-visual-handoff.md §7.1),
 * so the figures are fixtures and the page says so above everything else.
 */
export default function ExploreMapPage() {
  return (
    <div className="page-bare">
      <FixtureNotice screen="The Explore Map" />
      <CampusMap campuses={CAMPUS_DEMAND} initialCampusId={DEFAULT_CAMPUS_ID} />
    </div>
  );
}
