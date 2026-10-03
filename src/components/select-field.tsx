"use client";

export interface SelectFieldProps {
  readonly id: string;
  readonly label: string;
  readonly hint?: string;
  readonly value: string;
  readonly options: readonly {
    readonly id: string;
    readonly label: string;
    readonly disabled?: boolean;
  }[];
  readonly placeholder: string;
  readonly error: string | undefined;
  readonly onChange: (value: string) => void;
  /** Optional fields say so and let the placeholder stand as an answer. */
  readonly optional?: boolean;
}

/** A labelled native select with its hint and error, as the Wanted forms use it. */
export function SelectField({
  id,
  label,
  hint,
  value,
  options,
  placeholder,
  error,
  onChange,
  optional = false,
}: SelectFieldProps) {
  const hintId = hint === undefined ? undefined : `${id}-hint`;
  const errorId = error === undefined ? undefined : `${id}-error`;
  const describedBy = [hintId, errorId].filter((entry) => entry !== undefined).join(" ");

  return (
    <div className="form-field">
      <label className="form-field__label" htmlFor={id}>
        {label}
        <span className="form-field__required">{optional ? " (optional)" : " (required)"}</span>
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

      <select
        className="form-field__input"
        id={id}
        value={value}
        aria-invalid={error === undefined ? undefined : true}
        aria-describedby={describedBy === "" ? undefined : describedBy}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
