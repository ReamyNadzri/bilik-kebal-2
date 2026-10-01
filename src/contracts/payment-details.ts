import { z } from "zod";
import type { OperationResult } from "./operation-result";

/**
 * Malaysian banks a member can be refunded or paid to. The codes are checked
 * again by the database (`private.member_payment_details`), so a code added
 * here needs a migration too.
 */
export const MALAYSIAN_BANKS = [
  { code: "maybank", name: "Maybank" },
  { code: "cimb", name: "CIMB Bank" },
  { code: "public_bank", name: "Public Bank" },
  { code: "rhb", name: "RHB Bank" },
  { code: "hong_leong", name: "Hong Leong Bank" },
  { code: "ambank", name: "AmBank" },
  { code: "bank_islam", name: "Bank Islam" },
  { code: "bank_rakyat", name: "Bank Rakyat" },
  { code: "bsn", name: "Bank Simpanan Nasional (BSN)" },
  { code: "affin", name: "Affin Bank" },
  { code: "alliance", name: "Alliance Bank" },
  { code: "bank_muamalat", name: "Bank Muamalat" },
  { code: "agrobank", name: "Agrobank" },
  { code: "al_rajhi", name: "Al Rajhi Bank" },
  { code: "kfh", name: "Kuwait Finance House" },
  { code: "mbsb", name: "MBSB Bank" },
  { code: "ocbc", name: "OCBC Bank" },
  { code: "uob", name: "UOB Malaysia" },
  { code: "hsbc", name: "HSBC Bank" },
  { code: "standard_chartered", name: "Standard Chartered" },
  { code: "gxbank", name: "GXBank" },
  { code: "boost_bank", name: "Boost Bank" },
  { code: "aeon_bank", name: "AEON Bank" },
] as const;

export type BankCode = (typeof MALAYSIAN_BANKS)[number]["code"];

const BANK_CODES = MALAYSIAN_BANKS.map((bank) => bank.code) as [BankCode, ...BankCode[]];

export function bankName(code: string): string {
  return MALAYSIAN_BANKS.find((bank) => bank.code === code)?.name ?? code;
}

/**
 * A Malaysian mobile number in E.164 (+60 1x…), or null. Accepts the ways
 * people type it: 012-345 6789, 0123456789, 60123456789, +60 12 345 6789.
 */
export function normaliseMalaysianMobile(input: string): string | null {
  const digits = input.replace(/[\s\-()]/g, "");
  const match = /^(?:\+?60|0)(1\d{8,9})$/.exec(digits);
  return match ? `+60${match[1]}` : null;
}

export const paymentDetailsInputSchema = z.object({
  phone: z
    .string()
    .trim()
    .max(20)
    .transform((value, context) => {
      const normalised = normaliseMalaysianMobile(value);
      if (normalised === null) {
        context.addIssue({ code: "custom", message: "Enter a Malaysian mobile number." });
        return z.NEVER;
      }
      return normalised;
    }),
  bankCode: z.enum(BANK_CODES),
  accountHolderName: z.string().trim().min(3).max(100),
  accountNumber: z
    .string()
    .transform((value) => value.replace(/[\s-]/g, ""))
    .pipe(z.string().regex(/^\d{6,20}$/)),
});

export type PaymentDetailsInput = z.input<typeof paymentDetailsInputSchema>;

/**
 * What a member reads back about their own details. The account number is
 * never sent back whole: only its last four digits.
 */
export interface OwnPaymentDetails {
  phone: string;
  bankCode: BankCode;
  bankName: string;
  accountHolderName: string;
  accountNumberLast4: string;
  updatedAt: string;
}

/** The Owner's view of where a pending payout or refund goes. */
export interface PaymentRecipient {
  phone: string;
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
}

export type PaymentDetailsOperationCode =
  "AUTH_REQUIRED" | "VALIDATION_ERROR" | "PAYMENT_DETAILS_UNAVAILABLE";

export type SavePaymentDetailsResult = OperationResult<
  OwnPaymentDetails,
  PaymentDetailsOperationCode
>;
