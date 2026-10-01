"use client";

import { useState, type FormEvent } from "react";
import {
  MALAYSIAN_BANKS,
  type OwnPaymentDetails,
  type PaymentDetailsOperationCode,
} from "@/contracts/payment-details";
import { callOperation } from "@/features/presentation/call-operation";

export interface PaymentDetailsFormProps {
  /** Saved details (account number masked), null when none, "unavailable" when unread. */
  readonly details: OwnPaymentDetails | null | "unavailable";
}

type FieldName = "phone" | "bankCode" | "accountHolderName" | "accountNumber";

const DATE = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" });

/** +60123456789 as 012-345 6789, the way it is usually written. */
function localPhone(e164: string): string {
  const local = `0${e164.slice(3)}`;
  return `${local.slice(0, 3)}-${local.slice(3, 6)} ${local.slice(6)}`;
}

/**
 * The member's phone number and bank account, where refunds and payouts are
 * sent. Paying for a Wanted needs them on file. The account number is never
 * shown back whole: after saving, only its last four digits.
 */
export function PaymentDetailsForm({ details }: PaymentDetailsFormProps) {
  const initial = details === "unavailable" ? null : details;
  const [saved, setSaved] = useState<OwnPaymentDetails | null>(initial);
  const [editing, setEditing] = useState(initial === null);
  const [phone, setPhone] = useState(initial ? localPhone(initial.phone) : "");
  const [bankCode, setBankCode] = useState<string>(initial?.bankCode ?? "");
  const [holder, setHolder] = useState(initial?.accountHolderName ?? "");
  const [accountNumber, setAccountNumber] = useState("");
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setNotice(null);
    setErrors({});
    const result = await callOperation<OwnPaymentDetails, PaymentDetailsOperationCode>(
      "/api/profile/payment-details",
      { accountHolderName: holder, accountNumber, bankCode, phone },
      "PAYMENT_DETAILS_UNAVAILABLE",
      "PUT",
    );
    setBusy(false);
    if (result.ok) {
      setSaved(result.data);
      setAccountNumber("");
      setEditing(false);
      setNotice({ kind: "ok", text: "Payment details saved." });
      return;
    }
    const fieldErrors: Partial<Record<FieldName, string>> = {};
    for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
      const first = messages[0];
      if (first !== undefined) fieldErrors[field as FieldName] = first;
    }
    setErrors(fieldErrors);
    setNotice({ kind: "error", text: result.message || "Your payment details were not saved." });
  }

  function field(name: FieldName) {
    return errors[name] === undefined
      ? { "aria-describedby": `payment-${name}-hint` }
      : { "aria-invalid": true, "aria-describedby": `payment-${name}-error payment-${name}-hint` };
  }

  return (
    <section
      className="panel profile-card"
      id="payment-details"
      aria-labelledby="payment-details-heading"
    >
      <h2 id="payment-details-heading">Payment details</h2>
      <p className="profile-card__hint">
        Refunds and bounty payouts are sent by bank transfer to this account. You need them on file
        before you pay for a Wanted. Only you and the Owner who sends the money can see them; other
        members never do.
      </p>

      {notice ? (
        <p
          className={`ops-alert ${notice.kind === "ok" ? "ops-alert--success" : "ops-alert--error"}`}
          role={notice.kind === "ok" ? "status" : "alert"}
        >
          {notice.text}
        </p>
      ) : null}

      {details === "unavailable" ? (
        <p className="ops-alert ops-alert--warning" role="status">
          Your saved details could not be read right now. Saving again replaces them.
        </p>
      ) : null}

      {!editing && saved ? (
        <>
          <dl className="money-breakdown payment-details__saved" aria-label="Saved payment details">
            <div className="money-breakdown__row">
              <dt>Phone</dt>
              <dd className="numeric">{localPhone(saved.phone)}</dd>
            </div>
            <div className="money-breakdown__row">
              <dt>Bank</dt>
              <dd>{saved.bankName}</dd>
            </div>
            <div className="money-breakdown__row">
              <dt>Account holder</dt>
              <dd>{saved.accountHolderName}</dd>
            </div>
            <div className="money-breakdown__row">
              <dt>Account number</dt>
              <dd className="numeric">
                <span aria-hidden="true">•••• </span>
                <span className="visually-hidden">ending in </span>
                {saved.accountNumberLast4}
              </dd>
            </div>
          </dl>
          <p className="profile-card__hint">
            Last updated {DATE.format(new Date(saved.updatedAt))}.
          </p>
          <div className="profile-form__actions">
            <button
              type="button"
              className="button button--secondary"
              onClick={() => {
                setEditing(true);
                setNotice(null);
              }}
            >
              Change payment details
            </button>
          </div>
        </>
      ) : (
        <form className="payment-details__form" onSubmit={save} noValidate>
          <div className="form-field">
            <label className="form-field__label" htmlFor="payment-phone">
              Mobile number
            </label>
            <p className="form-field__hint" id="payment-phone-hint">
              A Malaysian mobile number, for example 012-345 6789.
            </p>
            {errors.phone ? (
              <p className="form-field__error" id="payment-phone-error">
                {errors.phone}
              </p>
            ) : null}
            <input
              className="form-field__input"
              id="payment-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              maxLength={20}
              required
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              {...field("phone")}
            />
          </div>

          <div className="form-field">
            <label className="form-field__label" htmlFor="payment-bankCode">
              Bank
            </label>
            <p className="form-field__hint" id="payment-bankCode-hint">
              The bank that holds the account below.
            </p>
            {errors.bankCode ? (
              <p className="form-field__error" id="payment-bankCode-error">
                {errors.bankCode}
              </p>
            ) : null}
            <select
              className="select-field"
              id="payment-bankCode"
              required
              value={bankCode}
              onChange={(event) => setBankCode(event.target.value)}
              {...field("bankCode")}
            >
              <option value="">Choose your bank</option>
              {MALAYSIAN_BANKS.map((bank) => (
                <option key={bank.code} value={bank.code}>
                  {bank.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label className="form-field__label" htmlFor="payment-accountHolderName">
              Account holder name
            </label>
            <p className="form-field__hint" id="payment-accountHolderName-hint">
              Exactly as the bank has it, so the transfer is not returned.
            </p>
            {errors.accountHolderName ? (
              <p className="form-field__error" id="payment-accountHolderName-error">
                {errors.accountHolderName}
              </p>
            ) : null}
            <input
              className="form-field__input"
              id="payment-accountHolderName"
              type="text"
              autoComplete="name"
              maxLength={100}
              required
              value={holder}
              onChange={(event) => setHolder(event.target.value)}
              {...field("accountHolderName")}
            />
          </div>

          <div className="form-field">
            <label className="form-field__label" htmlFor="payment-accountNumber">
              Account number
            </label>
            <p className="form-field__hint" id="payment-accountNumber-hint">
              {saved
                ? `Enter it again to change your details (saved one ends in ${saved.accountNumberLast4}).`
                : "Digits only; spaces and dashes are ignored."}
            </p>
            {errors.accountNumber ? (
              <p className="form-field__error" id="payment-accountNumber-error">
                {errors.accountNumber}
              </p>
            ) : null}
            <input
              className="form-field__input numeric"
              id="payment-accountNumber"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              maxLength={30}
              required
              value={accountNumber}
              onChange={(event) => setAccountNumber(event.target.value)}
              {...field("accountNumber")}
            />
          </div>

          <div className="profile-form__actions">
            <button
              type="submit"
              className="button button--primary"
              aria-disabled={busy || undefined}
            >
              {busy ? "Saving…" : "Save payment details"}
            </button>
            {saved ? (
              <button
                type="button"
                className="button button--quiet"
                onClick={() => {
                  setEditing(false);
                  setErrors({});
                  setAccountNumber("");
                }}
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      )}
    </section>
  );
}
