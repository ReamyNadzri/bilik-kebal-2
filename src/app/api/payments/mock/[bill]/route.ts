import { completeMockCheckout } from "@/modules/money/loaders/money-operations";
import { executeMarketplaceJson } from "@/modules/wanted/delivery/marketplace-http";

export const dynamic = "force-dynamic";

/**
 * The test gateway's checkout buttons. `{ "outcome": "paid" | "cancelled" }`
 * for the signed-in payer's own pending bill. Paying records a signed
 * provider event through the same path as a ToyyibPay callback.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ bill: string }> },
): Promise<Response> {
  const { bill } = await context.params;
  return executeMarketplaceJson(request, (input) => {
    const outcome =
      typeof input === "object" && input !== null && "outcome" in input
        ? (input as { outcome: unknown }).outcome
        : null;
    if (outcome !== "paid" && outcome !== "cancelled")
      return Promise.resolve({
        ok: false,
        code: "VALIDATION_ERROR",
        message: "Choose to pay or to cancel.",
      });
    return completeMockCheckout(bill, outcome);
  });
}
