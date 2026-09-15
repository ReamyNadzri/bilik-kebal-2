import { formatRinggit, type Sen } from "@/features/marketplace/money";

export interface BountyPlateProps {
  readonly amountSen: Sen;
  /** What the amount is. Becomes the start of the spoken value. */
  readonly label?: string;
  /** `large` is the detail page's ledger; `small` is a card. */
  readonly size?: "small" | "large";
}

/**
 * The bounty value, as a stamped brass plate.
 *
 * The one deliberately bold element in the interface
 * (`docs/superpowers/specs/2026-09-14-vaultix-marketplace-visual-direction.md`
 * §5.1). It is a dark plate with brass numerals rather than a brass coin for
 * two reasons: brass on paper is 2.95:1 and fails contrast, and a dark block on
 * a pale card is the fastest thing on the card to find.
 *
 * The unit and the amount are separate elements so the plate can stack them,
 * which would otherwise make a screen reader announce "R M" and "85" as two
 * unrelated fragments. Both halves are hidden and one complete sentence is
 * exposed instead.
 */
export function BountyPlate({
  amountSen,
  label = "Total bounty",
  size = "small",
}: BountyPlateProps) {
  return (
    <p className={`bounty-plate bounty-plate--${size}`}>
      <span className="visually-hidden">{`${label} ${formatRinggit(amountSen)}`}</span>
      <span className="bounty-plate__unit" aria-hidden="true">
        RM
      </span>
      <span className="bounty-plate__value numeric" aria-hidden="true">
        {formatRinggit(amountSen, { unit: "omit" })}
      </span>
    </p>
  );
}
