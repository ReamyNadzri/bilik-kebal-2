"use client";

import type { MouseEvent, Ref } from "react";

export interface FieldError {
  fieldId: string;
  message: string;
}

export interface ErrorSummaryProps {
  errors: FieldError[];
  /** Lets a submit handler move focus to the summary itself. */
  ref?: Ref<HTMLDivElement>;
}

/**
 * Summary of validation failures at the top of a form.
 *
 * Each entry links to the field that failed, so a keyboard or screen-reader
 * user reaches the problem directly. tabIndex={-1} lets a submit handler move
 * focus here (context/ui-context.md: errors are summarised at the top of long
 * forms and linked to their fields).
 */
/**
 * Following the link must move focus, not merely scroll. A fragment target
 * becomes the sequential focus starting point but does not receive DOM focus,
 * so a keyboard or screen-reader user would land beside the field instead of
 * inside it.
 */
function focusField(fieldId: string) {
  return (event: MouseEvent<HTMLAnchorElement>) => {
    const field = document.getElementById(fieldId);

    if (field !== null) {
      event.preventDefault();
      field.focus();
      field.scrollIntoView({ block: "center" });
    }
  };
}

export function ErrorSummary({ errors, ref }: ErrorSummaryProps) {
  if (errors.length === 0) {
    return null;
  }

  return (
    <div className="error-summary" role="alert" tabIndex={-1} ref={ref}>
      <h2 className="error-summary__heading">There is a problem</h2>

      <ul className="error-summary__list">
        {errors.map((error) => (
          <li key={error.fieldId}>
            <a href={`#${error.fieldId}`} onClick={focusField(error.fieldId)}>
              {error.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
