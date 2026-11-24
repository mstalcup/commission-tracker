import { useState, type ChangeEvent } from 'react';
import { z, type ZodType } from 'zod';
import { ApiError } from './api';

type Values = Record<string, string>;

/**
 * Tiny form helper. Inputs are kept as strings (what the user typed); on
 * submit we build the API payload and check it with the same zod schema the
 * API uses, so error messages match on both sides.
 */
export function useForm<V extends Values>(initial: V) {
  const [values, setValues] = useState<V>(initial);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string>();

  const set = (name: keyof V, value: string) => {
    setValues((v) => ({ ...v, [name]: value }));
    if (errors[name as string]) setErrors((e) => ({ ...e, [name as string]: undefined }));
  };

  const field = (name: keyof V & string) => ({
    name,
    value: values[name],
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => set(name, e.target.value),
    error: errors[name],
  });

  /** Returns parsed data, or null (and shows field errors) when invalid. */
  function validate<T>(schema: ZodType<T>, payload: unknown, extraErrors: Record<string, string> = {}): T | null {
    const r = schema.safeParse(payload);
    const fieldErrors: Record<string, string | undefined> = { ...extraErrors };
    if (!r.success) {
      for (const [k, msgs] of Object.entries(z.flattenError(r.error).fieldErrors)) {
        fieldErrors[k] ??= (msgs as string[] | undefined)?.[0];
      }
    }
    setErrors(fieldErrors);
    setFormError(undefined);
    if (!r.success || Object.values(extraErrors).some(Boolean)) return null;
    return r.data;
  }

  /** Shows errors returned by the API next to the right fields. */
  function showServerError(err: unknown) {
    if (err instanceof ApiError && err.fieldErrors) {
      const mapped: Record<string, string> = {};
      for (const [k, msgs] of Object.entries(err.fieldErrors)) mapped[k] = msgs[0];
      setErrors(mapped);
    }
    setFormError(err instanceof Error ? err.message : 'Something went wrong');
  }

  return { values, setValues, set, field, errors, setErrors, formError, setFormError, validate, showServerError };
}
