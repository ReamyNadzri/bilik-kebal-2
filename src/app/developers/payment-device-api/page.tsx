import type { Metadata } from "next";
import { PaymentDeviceApiDoc } from "@/components/developers/payment-device-api-doc";

/**
 * Unlisted on purpose (user, 2026-10-10): nothing in the site links here and
 * search engines are asked not to index it, so it is reached only by typing
 * the address. That keeps it out of members' way; it is not access control,
 * and the page holds nothing secret.
 */
export const metadata: Metadata = {
  title: "Payment device API (draft) | VAULTIX",
  robots: { index: false, follow: false },
};

export default function PaymentDeviceApiPage() {
  return <PaymentDeviceApiDoc />;
}
