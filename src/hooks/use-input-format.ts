"use client";

import * as React from "react";
import {
  inputPatterns,
  type InputPatternKey,
  formatInput,
  validateInput,
} from "@/lib/input-patterns";

interface UseInputFormatReturn {
  /** De rauwe waarde (zonder formatting) */
  value: string;
  /** De geformatteerde display waarde */
  displayValue: string;
  /** Of de huidige waarde valide is */
  isValid: boolean;
  /** OnChange handler voor input element */
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** OnBlur handler voor input element (format on blur) */
  onBlur: () => void;
  /** Reset naar een nieuwe waarde */
  setValue: (value: string) => void;
  /** Input props om te spreaden op het input element */
  inputProps: Partial<React.ComponentProps<"input">>;
}

/**
 * Hook voor het formatteren en valideren van input velden
 * op basis van Nederlandse input patterns
 *
 * @param variant - Het type input pattern (postcode, telefoon, etc.)
 * @param initialValue - Optionele startwaarde
 * @param formatOnChange - Of direct tijdens typen geformatteerd moet worden (default: true)
 *
 * @example
 * ```tsx
 * const { displayValue, isValid, onChange, inputProps } = useInputFormat('postcode');
 *
 * return (
 *   <input
 *     value={displayValue}
 *     onChange={onChange}
 *     {...inputProps}
 *   />
 * );
 * ```
 */
export function useInputFormat(
  variant: InputPatternKey,
  initialValue: string = "",
  formatOnChange: boolean = true
): UseInputFormatReturn {
  const pattern = inputPatterns[variant];

  // Format initial value
  const formatValue = React.useCallback(
    (val: string) => formatInput(variant, val),
    [variant]
  );

  const [value, setValueState] = React.useState(() =>
    initialValue ? formatValue(initialValue) : ""
  );

  // Validate current value
  const isValid = React.useMemo(() => {
    if (!value) return true; // Lege waarde is niet invalid (kan required zijn)
    return validateInput(variant, value);
  }, [value, variant]);

  // Display value (kan anders zijn dan raw value bij sommige patterns)
  const displayValue = value;

  // OnChange handler
  const onChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      if (formatOnChange && pattern.format) {
        setValueState(pattern.format(newValue));
      } else {
        setValueState(newValue);
      }
    },
    [formatOnChange, pattern]
  );

  // OnBlur handler - format on blur if not formatting on change
  const onBlur = React.useCallback(() => {
    if (!formatOnChange && pattern.format) {
      setValueState(pattern.format(value));
    }
  }, [formatOnChange, pattern, value]);

  // Manual setValue
  const setValue = React.useCallback(
    (newValue: string) => {
      setValueState(formatValue(newValue));
    },
    [formatValue]
  );

  // Build input props based on pattern
  const inputProps = React.useMemo((): Partial<React.ComponentProps<"input">> => {
    const props: Partial<React.ComponentProps<"input">> = {};

    if (pattern.placeholder) {
      props.placeholder = pattern.placeholder;
    }

    if (pattern.inputMode) {
      props.inputMode = pattern.inputMode;
    }

    if (pattern.autoComplete) {
      props.autoComplete = pattern.autoComplete;
    }

    if (pattern.maxLength) {
      props.maxLength = pattern.maxLength;
    }

    if (pattern.pattern) {
      props.pattern = pattern.pattern;
    }

    // Numeric inputs
    if ("min" in pattern && pattern.min !== undefined) {
      props.min = pattern.min;
    }

    if ("max" in pattern && pattern.max !== undefined) {
      props.max = pattern.max;
    }

    if ("step" in pattern && pattern.step !== undefined) {
      props.step = pattern.step;
    }

    return props;
  }, [pattern]);

  return {
    value,
    displayValue,
    isValid,
    onChange,
    onBlur,
    setValue,
    inputProps,
  };
}

/**
 * Hook variant die werkt met controlled components
 * en externe state management (bijv. react-hook-form)
 */
export function useInputFormatControlled(
  variant: InputPatternKey,
  value: string,
  onValueChange: (value: string) => void,
  formatOnChange: boolean = true
): Omit<UseInputFormatReturn, "value" | "setValue"> {
  const pattern = inputPatterns[variant];

  // Validate current value
  const isValid = React.useMemo(() => {
    if (!value) return true;
    return validateInput(variant, value);
  }, [value, variant]);

  // Display value
  const displayValue = value;

  // OnChange handler
  const onChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      if (formatOnChange && pattern.format) {
        onValueChange(pattern.format(newValue));
      } else {
        onValueChange(newValue);
      }
    },
    [formatOnChange, pattern, onValueChange]
  );

  // OnBlur handler
  const onBlur = React.useCallback(() => {
    if (!formatOnChange && pattern.format) {
      onValueChange(pattern.format(value));
    }
  }, [formatOnChange, pattern, value, onValueChange]);

  // Build input props
  const inputProps = React.useMemo((): Partial<React.ComponentProps<"input">> => {
    const props: Partial<React.ComponentProps<"input">> = {};

    if (pattern.placeholder) {
      props.placeholder = pattern.placeholder;
    }

    if (pattern.inputMode) {
      props.inputMode = pattern.inputMode;
    }

    if (pattern.autoComplete) {
      props.autoComplete = pattern.autoComplete;
    }

    if (pattern.maxLength) {
      props.maxLength = pattern.maxLength;
    }

    if (pattern.pattern) {
      props.pattern = pattern.pattern;
    }

    if ("min" in pattern && pattern.min !== undefined) {
      props.min = pattern.min;
    }

    if ("max" in pattern && pattern.max !== undefined) {
      props.max = pattern.max;
    }

    if ("step" in pattern && pattern.step !== undefined) {
      props.step = pattern.step;
    }

    return props;
  }, [pattern]);

  return {
    displayValue,
    isValid,
    onChange,
    onBlur,
    inputProps,
  };
}
