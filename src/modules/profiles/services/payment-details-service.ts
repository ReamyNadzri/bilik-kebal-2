import { failure, success } from "@/contracts/operation-result";
import {
  paymentDetailsInputSchema,
  type OwnPaymentDetails,
  type SavePaymentDetailsResult,
} from "@/contracts/payment-details";
import type { PaymentDetailsRepository } from "../repositories/supabase-payment-details-repository";

/**
 * A member's phone number and bank account, where refunds and payouts are
 * sent. Required before paying (the database refuses a bill without them).
 * Nothing here logs the details or returns the whole account number.
 */
export class PaymentDetailsService {
  constructor(private readonly repository: PaymentDetailsRepository) {}

  async readOwn(actor: { userId: string } | null): Promise<OwnPaymentDetails | null> {
    if (!actor) return null;
    return this.repository.readOwn();
  }

  async save(actor: { userId: string } | null, input: unknown): Promise<SavePaymentDetailsResult> {
    if (!actor) return failure("AUTH_REQUIRED", "Sign in to save your payment details.");
    const parsed = paymentDetailsInputSchema.safeParse(input);
    if (!parsed.success) {
      const fields = new Set(parsed.error.issues.map((issue) => String(issue.path[0])));
      const fieldErrors: Record<string, string[]> = {};
      if (fields.has("phone"))
        fieldErrors.phone = ["Enter a Malaysian mobile number, for example 012-345 6789."];
      if (fields.has("bankCode")) fieldErrors.bankCode = ["Choose your bank."];
      if (fields.has("accountHolderName"))
        fieldErrors.accountHolderName = ["Enter the name on the account, 3 to 100 characters."];
      if (fields.has("accountNumber"))
        fieldErrors.accountNumber = ["Enter the account number: 6 to 20 digits."];
      return failure("VALIDATION_ERROR", "Check your payment details.", fieldErrors);
    }
    try {
      await this.repository.saveOwn(parsed.data);
      const saved = await this.repository.readOwn();
      return saved
        ? success(saved)
        : failure("PAYMENT_DETAILS_UNAVAILABLE", "Your payment details could not be saved.");
    } catch {
      return failure(
        "PAYMENT_DETAILS_UNAVAILABLE",
        "Your payment details could not be saved. Try again.",
      );
    }
  }
}
