import type { SupabaseClient } from "@supabase/supabase-js";
import { bankName, type BankCode, type OwnPaymentDetails } from "@/contracts/payment-details";

export interface PaymentDetailsRepository {
  readOwn(): Promise<OwnPaymentDetails | null>;
  saveOwn(input: {
    phone: string;
    bankCode: BankCode;
    accountHolderName: string;
    accountNumber: string;
  }): Promise<void>;
}

interface OwnRow {
  phone_e164: string;
  bank_code: BankCode;
  account_holder_name: string;
  account_number_last4: string;
  updated_at: string;
}

/**
 * The member's own phone and bank account (migration 202610180001). Written
 * and read through the member's session; the database masks the account
 * number on the way out. Untyped until the database types are regenerated.
 */
export class SupabasePaymentDetailsRepository implements PaymentDetailsRepository {
  constructor(private readonly client: SupabaseClient) {}

  async readOwn(): Promise<OwnPaymentDetails | null> {
    const { data, error } = await this.client.rpc("my_payment_details");
    if (error) throw error;
    const row = (data as OwnRow[] | null)?.[0];
    if (!row) return null;
    return {
      accountHolderName: row.account_holder_name,
      accountNumberLast4: row.account_number_last4,
      bankCode: row.bank_code,
      bankName: bankName(row.bank_code),
      phone: row.phone_e164,
      updatedAt: row.updated_at,
    };
  }

  async saveOwn(input: {
    phone: string;
    bankCode: BankCode;
    accountHolderName: string;
    accountNumber: string;
  }): Promise<void> {
    const { error } = await this.client.rpc("set_own_payment_details", {
      new_account_holder_name: input.accountHolderName,
      new_account_number: input.accountNumber,
      new_bank_code: input.bankCode,
      new_phone_e164: input.phone,
    });
    if (error) throw error;
  }
}
