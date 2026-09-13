import type { InputHTMLAttributes } from "react";

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
}

/**
 * Labelled text input with its hint and error linked for assistive technology.
 *
 * Errors are attached to the field itself rather than shown only in a summary
 * (context/ui-context.md: form errors are linked to fields and summarised at
 * the top of long forms). Required is stated in words, never by a coloured
 * asterisk alone.
 */
export function FormField({ id, label, hint, error, required, ...inputProps }: FormFieldProps) {
  const hintId = hint === undefined ? undefined : `${id}-hint`;
  const errorId = error === undefined ? undefined : `${id}-error`;
  const describedBy = [hintId, errorId].filter((value) => value !== undefined).join(" ");

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

      <input
        {...inputProps}
        id={id}
        required={required}
        aria-invalid={error === undefined ? undefined : true}
        aria-describedby={describedBy === "" ? undefined : describedBy}
        className="form-field__input"
      />
    </div>
  );
}
