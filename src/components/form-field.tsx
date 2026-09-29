"use client";

import { useState, type InputHTMLAttributes } from "react";

export interface FormFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "id" | "aria-describedby"
> {
  id: string;
  label: string;
  // Explicit undefined: callers pass a lookup result under
  // exactOptionalPropertyTypes.
  hint?: string | undefined;
  error?: string | undefined;
  /**
   * Whether to show a password visibility toggle.
   * Defaults to true when type is "password".
   */
  showPasswordToggle?: boolean | undefined;
}

function EyeIcon({ size = 15 }: { readonly size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="shrink-0"
    >
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({ size = 15 }: { readonly size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="shrink-0"
    >
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}

/**
 * Labelled text input with its hint and error linked for assistive technology.
 *
 * Errors are attached to the field itself rather than shown only in a summary
 * (context/ui-context.md: form errors are linked to fields and summarised at
 * the top of long forms). Required is stated in words, never by a coloured
 * asterisk alone.
 */
export function FormField({
  id,
  label,
  hint,
  error,
  required,
  type,
  showPasswordToggle,
  ...inputProps
}: FormFieldProps) {
  const [showPassword, setShowPassword] = useState(false);
  const hintId = hint === undefined ? undefined : `${id}-hint`;
  const errorId = error === undefined ? undefined : `${id}-error`;
  const describedBy = [hintId, errorId].filter((value) => value !== undefined).join(" ");

  const isPassword = type === "password";
  const hasToggle = isPassword && (showPasswordToggle ?? true);
  const inputType = hasToggle ? (showPassword ? "text" : "password") : type;

  return (
    <div className="form-field">
      <label className="form-field__label" htmlFor={id}>
        {label}
        {required === true ? <span className="form-field__required"> (required)</span> : null}
      </label>

      {hint === undefined ? null : (
        <p className="form-field__hint" id={hintId}>
          {hint}
        </p>
      )}

      {error === undefined ? null : (
        <p className="form-field__error" id={errorId}>
          {error}
        </p>
      )}

      {hasToggle ? (
        <div className="form-field__control form-field__control--password">
          <input
            {...inputProps}
            id={id}
            type={inputType}
            required={required}
            aria-invalid={error === undefined ? undefined : true}
            aria-describedby={describedBy === "" ? undefined : describedBy}
            className="form-field__input"
          />
          <button
            type="button"
            className="form-field__toggle"
            aria-label={showPassword ? "Hide characters" : "Show characters"}
            aria-pressed={showPassword}
            title={showPassword ? "Hide password" : "Show password"}
            onClick={() => setShowPassword((prev) => !prev)}
            tabIndex={0}
          >
            {showPassword ? <EyeOffIcon size={15} /> : <EyeIcon size={15} />}
            <span>{showPassword ? "Hide" : "Show"}</span>
          </button>
        </div>
      ) : (
        <input
          {...inputProps}
          id={id}
          type={inputType}
          required={required}
          aria-invalid={error === undefined ? undefined : true}
          aria-describedby={describedBy === "" ? undefined : describedBy}
          className="form-field__input"
        />
      )}
    </div>
  );
}
