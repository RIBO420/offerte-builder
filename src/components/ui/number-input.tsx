"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Minus, Plus } from "lucide-react";

interface NumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: number | string;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  decimals?: number;
  debounceMs?: number;
  showStepper?: boolean;
  prefix?: string;
  suffix?: string;
  error?: boolean;
  onBlur?: () => void;
  /** If true, rounds the value to the nearest step on blur */
  roundToStep?: boolean;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  (
    {
      className,
      value,
      onChange,
      min = 0,
      max = Infinity,
      step = 1,
      decimals = 2,
      debounceMs = 300,
      showStepper = true,
      prefix,
      suffix,
      disabled,
      error,
      onBlur: onBlurProp,
      roundToStep = false,
      ...props
    },
    ref
  ) => {
    // Internal state for the input field
    const [internalValue, setInternalValue] = React.useState<string>(
      typeof value === "number" ? value.toString() : value
    );
    const [isFocused, setIsFocused] = React.useState(false);

    // Debounced value
    const debouncedValue = useDebounce(internalValue, debounceMs);

    // Sync external value with internal state when not focused
    React.useEffect(() => {
      if (!isFocused) {
        setInternalValue(typeof value === "number" ? value.toString() : value);
      }
    }, [value, isFocused]);

    // Emit debounced changes
    React.useEffect(() => {
      if (!isFocused) return;

      const parsed = parseFloat(debouncedValue);
      if (!isNaN(parsed)) {
        const clamped = Math.max(min, Math.min(max, parsed));
        const rounded = Number(clamped.toFixed(decimals));
        if (rounded !== value) {
          onChange(rounded);
        }
      }
    }, [debouncedValue, min, max, decimals, onChange, value, isFocused]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      // Allow empty, numbers, and decimal point
      if (newValue === "" || /^-?\d*\.?\d*$/.test(newValue)) {
        setInternalValue(newValue);
      }
    };

    const handleBlur = () => {
      setIsFocused(false);
      const parsed = parseFloat(internalValue);
      if (isNaN(parsed) || internalValue === "") {
        setInternalValue(min.toString());
        onChange(min);
      } else {
        const clamped = Math.max(min, Math.min(max, parsed));
        // Round to nearest step if roundToStep is enabled, otherwise round to decimals
        const rounded = roundToStep
          ? Math.round(clamped / step) * step
          : Number(clamped.toFixed(decimals));
        const finalValue = Number(rounded.toFixed(decimals));
        setInternalValue(finalValue.toString());
        onChange(finalValue);
      }
      onBlurProp?.();
    };

    const handleFocus = () => {
      setIsFocused(true);
    };

    const handleStep = (direction: 1 | -1) => {
      const currentValue = parseFloat(internalValue) || 0;
      const newValue = currentValue + step * direction;
      const clamped = Math.max(min, Math.min(max, newValue));
      const rounded = Number(clamped.toFixed(decimals));
      setInternalValue(rounded.toString());
      onChange(rounded);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        handleStep(1);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        handleStep(-1);
      }
    };

    return (
      <div className={cn("flex items-center gap-1.5", className)}>
        {showStepper && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-11 w-11 sm:h-10 sm:w-10 shrink-0 touch-manipulation"
            onClick={() => handleStep(-1)}
            disabled={disabled || parseFloat(internalValue) <= min}
            aria-label="Verlaag waarde"
          >
            <Minus className="h-4 w-4" />
          </Button>
        )}
        <div className="relative flex-1">
          {prefix && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">
              {prefix}
            </span>
          )}
          <Input
            ref={ref}
            type="text"
            inputMode="decimal"
            value={internalValue}
            onChange={handleInputChange}
            onBlur={handleBlur}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            aria-invalid={error}
            className={cn(
              "h-10 sm:h-9",
              prefix && "pl-7",
              suffix && "pr-12",
              error && "border-destructive focus-visible:ring-destructive"
            )}
            {...props}
          />
          {suffix && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">
              {suffix}
            </span>
          )}
        </div>
        {showStepper && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-11 w-11 sm:h-10 sm:w-10 shrink-0 touch-manipulation"
            onClick={() => handleStep(1)}
            disabled={disabled || parseFloat(internalValue) >= max}
            aria-label="Verhoog waarde"
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }
);

NumberInput.displayName = "NumberInput";

// Preset variants for common use cases
type VariantInputProps<TOmit extends keyof NumberInputProps> = Omit<NumberInputProps, TOmit>;

const CurrencyInput = React.forwardRef<
  HTMLInputElement,
  VariantInputProps<"prefix" | "decimals">
>((props, ref) => (
  <NumberInput ref={ref} prefix="€" decimals={2} step={0.01} {...props} />
));

CurrencyInput.displayName = "CurrencyInput";

const AreaInput = React.forwardRef<
  HTMLInputElement,
  VariantInputProps<"suffix" | "decimals">
>((props, ref) => (
  <NumberInput ref={ref} suffix="m²" decimals={1} step={0.5} {...props} />
));

AreaInput.displayName = "AreaInput";

const LengthInput = React.forwardRef<
  HTMLInputElement,
  VariantInputProps<"suffix" | "decimals">
>((props, ref) => (
  <NumberInput ref={ref} suffix="m" decimals={1} step={0.1} {...props} />
));

LengthInput.displayName = "LengthInput";

const QuantityInput = React.forwardRef<
  HTMLInputElement,
  VariantInputProps<"decimals" | "step">
>((props, ref) => (
  <NumberInput ref={ref} decimals={0} step={1} {...props} />
));

QuantityInput.displayName = "QuantityInput";

const HoursInput = React.forwardRef<
  HTMLInputElement,
  VariantInputProps<"suffix" | "decimals" | "step" | "roundToStep">
>((props, ref) => (
  <NumberInput ref={ref} suffix="uur" decimals={2} step={0.25} roundToStep {...props} />
));

HoursInput.displayName = "HoursInput";

export {
  NumberInput,
  CurrencyInput,
  AreaInput,
  LengthInput,
  QuantityInput,
  HoursInput,
};
