export type OperationResult<TData, TCode extends string> =
  | { ok: true; data: TData }
  | {
      ok: false;
      code: TCode;
      message: string;
      fieldErrors?: Record<string, string[]>;
    };

export function success<TData>(data: TData): OperationResult<TData, never> {
  return { ok: true, data };
}

export function failure<TCode extends string>(
  code: TCode,
  message: string,
  fieldErrors?: Record<string, string[]>,
): Extract<OperationResult<never, TCode>, { ok: false }> {
  return fieldErrors ? { ok: false, code, message, fieldErrors } : { ok: false, code, message };
}
