import type { Metadata } from "next";
import { PaymentWalkthrough, type WalkthroughSeed } from "@/components/payment-walkthrough";
import { sen } from "@/features/marketplace/money";
import { readWanted } from "@/features/marketplace/wanted-source";

export const metadata: Metadata = {
  title: "Payment walkthrough | VAULTIX",
};

/** Reads an optional Wanted per request; nothing about it is cached. */
export const dynamic = "force-dynamic";

interface WalkthroughPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** The fee a new Wanted is published with (WantedPublicationService). */
const DEFAULT_FEE_BASIS_POINTS = 1000;
const DEFAULT_DURATION_DAYS = 14;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** RM1 to RM50 in whole sen; anything else falls back to RM10. */
function contribution(value: string | undefined) {
  const amount = Number(value);
  return Number.isInteger(amount) && amount >= 100 && amount <= 5000 ? sen(amount) : sen(1000);
}

/**
 * A walkthrough of the money path, from checkout to payout or refund.
 *
 * It writes nothing. With `?wanted=<id>` it describes backing that Wanted,
 * read the same way the detail page reads it; with `?title=` and
 * `?amountSen=` it describes publishing a draft; with neither, a sample.
 * The query only chooses labels and an amount the walkthrough displays.
 */
export default async function PaymentWalkthroughPage({ searchParams }: WalkthroughPageProps) {
  const params = await searchParams;
  const wantedId = first(params.wanted);
  const amountSen = contribution(first(params.amountSen));
  const wanted = wantedId ? await readWanted(wantedId) : null;

  const seed: WalkthroughSeed =
    wanted?.status === "ready"
      ? {
          mode: "back",
          title: wanted.data.title,
          courseCode: wanted.data.courseCode || wanted.data.resourceType,
          courseName: wanted.data.courseName || wanted.data.campus,
          startingBountySen: wanted.data.grossBountySen,
          amountSen,
          feeRateBasisPoints: wanted.data.feeRateBasisPoints,
          durationDays: DEFAULT_DURATION_DAYS,
          wantedId: wanted.data.id,
        }
      : {
          mode: "publish",
          title: first(params.title)?.trim().slice(0, 120) || "Past year papers for MAT183",
          courseCode: "MAT183",
          courseName: "Calculus I",
          startingBountySen: sen(0),
          amountSen,
          feeRateBasisPoints: DEFAULT_FEE_BASIS_POINTS,
          durationDays: DEFAULT_DURATION_DAYS,
          wantedId: null,
        };

  return (
    <div className="page-bare">
      <header className="panel page-heading">
        <div>
          <h1>How payment works</h1>
          <p className="page-heading__lede">
            A step-by-step simulation of {seed.mode === "publish" ? "publishing" : "backing"}{" "}
            <strong>{seed.title}</strong>, from checkout to payout or refund.
          </p>
        </div>
      </header>
      <PaymentWalkthrough seed={seed} />
    </div>
  );
}
