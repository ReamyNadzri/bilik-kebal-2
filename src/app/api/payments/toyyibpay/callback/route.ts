import { handleToyyibPayCallback } from "@/modules/money/loaders/money-operations";
import { marketplaceResponse } from "@/modules/wanted/delivery/marketplace-http";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    const form = await request.formData();
    const result = await handleToyyibPayCallback(Object.fromEntries(form.entries()));
    return marketplaceResponse(result);
  } catch {
    return marketplaceResponse({
      ok: false,
      code: "PAYMENT_CALLBACK_INVALID",
      message: "Callback payload was invalid.",
    });
  }
}
