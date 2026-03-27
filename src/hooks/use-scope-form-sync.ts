import { useEffect, useRef } from "react";
import type { FieldErrors } from "react-hook-form";

/**
 * Syncs form validation state to a parent component.
 *
 * Replaces the recurring pattern:
 * ```ts
 * useEffect(() => {
 *   if (onValidationChange) { ... }
 *   // eslint-disable-next-line react-hooks/exhaustive-deps
 * }, [JSON.stringify(errors), isValid]);
 * ```
 *
 * Uses a ref for the callback to avoid stale closure issues, so
 * `onValidationChange` does NOT need to be in the dependency array.
 */
export function useFormValidationSync(
  errors: FieldErrors,
  isValid: boolean,
  onValidationChange?: (isValid: boolean, errors: Record<string, string>) => void
) {
  const callbackRef = useRef(onValidationChange);
  callbackRef.current = onValidationChange;

  // Serialize errors so the effect only fires when they actually change
  const serializedErrors = JSON.stringify(errors);

  useEffect(() => {
    if (callbackRef.current) {
      const errorMessages: Record<string, string> = {};
      Object.entries(errors).forEach(([key, error]) => {
        if (error && typeof error === "object" && "message" in error && error.message) {
          errorMessages[key] = error.message as string;
        }
      });
      callbackRef.current(isValid, errorMessages);
    }
    // serializedErrors captures the real changes; callbackRef is stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serializedErrors, isValid]);
}

/**
 * Variant of useFormValidationSync that flattens nested error objects.
 *
 * Useful for forms with nested schemas (e.g. gazonanalyse, bemesting).
 */
export function useFormValidationSyncNested(
  errors: FieldErrors,
  isValid: boolean,
  onValidationChange?: (isValid: boolean, errors: Record<string, string>) => void
) {
  const callbackRef = useRef(onValidationChange);
  callbackRef.current = onValidationChange;

  const serializedErrors = JSON.stringify(errors);

  useEffect(() => {
    if (callbackRef.current) {
      const errorMessages: Record<string, string> = {};
      const flattenErrors = (
        obj: Record<string, unknown>,
        prefix = ""
      ) => {
        Object.entries(obj).forEach(([key, val]) => {
          const fullKey = prefix ? `${prefix}.${key}` : key;
          if (val && typeof val === "object" && "message" in val) {
            errorMessages[fullKey] = String((val as { message: string }).message);
          } else if (val && typeof val === "object") {
            flattenErrors(val as Record<string, unknown>, fullKey);
          }
        });
      };
      flattenErrors(errors as Record<string, unknown>);
      callbackRef.current(isValid, errorMessages);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serializedErrors, isValid]);
}

/**
 * Syncs optional / extra form field changes to the parent `onChange`.
 *
 * Replaces the recurring pattern:
 * ```ts
 * useEffect(() => {
 *   const currentValues = form.getValues();
 *   onChange(buildCompleteData(currentValues));
 *   // eslint-disable-next-line react-hooks/exhaustive-deps
 * }, [optionalField1, optionalField2]);
 * ```
 *
 * Uses a ref for the callback so it does not need to be a dependency.
 */
export function useFormDataSync(
  buildAndNotify: () => void,
  deps: unknown[]
) {
  const callbackRef = useRef(buildAndNotify);
  callbackRef.current = buildAndNotify;

  useEffect(() => {
    callbackRef.current();
    // deps are the actual trigger values (optional fields, external state, etc.)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
