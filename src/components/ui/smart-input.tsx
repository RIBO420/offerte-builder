"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  FormFieldFeedback,
  FormFieldFeedbackIcon,
} from "@/components/ui/form-field-feedback";
import {
  inputPatterns,
  type InputPatternKey,
  formatInput,
  validateInput,
} from "@/lib/input-patterns";

type FeedbackStatus = "idle" | "valid" | "invalid" | "validating";

export interface SmartInputProps
  extends Omit<React.ComponentProps<"input">, "type"> {
  /** Het type input pattern voor Nederlandse formaten */
  variant: InputPatternKey;
  /** Toon validatie feedback (default: true) */
  showValidation?: boolean;
  /** Toon alleen validatie na blur (default: true) */
  validateOnBlur?: boolean;
  /** Format tijdens typen (default: true) */
  formatOnChange?: boolean;
  /** Callback met geformatteerde waarde en validatie status */
  onValueChange?: (value: string, isValid: boolean) => void;
  /** Custom foutmelding */
  errorMessage?: string;
  /** Custom succesmelding */
  successMessage?: string;
  /** Label voor accessibility */
  label?: string;
}

const statusBorderClasses: Record<FeedbackStatus, string> = {
  idle: "",
  valid:
    "border-ring focus-visible:border-ring focus-visible:ring-ring/50",
  invalid:
    "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20",
  validating: "",
};

/**
 * SmartInput Component
 *
 * Een intelligente input component voor Nederlandse formaten met:
 * - Auto-formatting tijdens typen (postcodes, telefoonnummers, IBAN, etc.)
 * - Validatie icoon rechts in het veld
 * - Juiste inputMode voor mobiel keyboard
 * - AutoComplete attributen voor browser autofill
 * - Prefix/suffix weergave (bijv. EUR, m2)
 * - Shake animatie bij invalid
 *
 * @example
 * ```tsx
 * // Postcode input
 * <SmartInput
 *   variant="postcode"
 *   onValueChange={(value, isValid) => {
 *     // "1234 AB", true
 *   }}
 * />
 *
 * // Telefoon input
 * <SmartInput variant="telefoon" />
 *
 * // Bedrag met prefix
 * <SmartInput variant="bedrag" />
 *
 * // Oppervlakte met suffix
 * <SmartInput variant="oppervlakte" />
 * ```
 */
export const SmartInput = React.forwardRef<HTMLInputElement, SmartInputProps>(
  (
    {
      variant,
      showValidation = true,
      validateOnBlur = true,
      formatOnChange = true,
      onValueChange,
      errorMessage,
      successMessage,
      label,
      className,
      value: controlledValue,
      defaultValue,
      onChange,
      onBlur,
      id,
      ...props
    },
    ref
  ) => {
    const pattern = inputPatterns[variant];
    const generatedId = React.useId();
    const inputId = id || generatedId;

    // Internal state for uncontrolled usage
    const [internalValue, setInternalValue] = React.useState(() => {
      const initial = controlledValue ?? defaultValue ?? "";
      return typeof initial === "string" ? formatInput(variant, initial) : "";
    });

    // Track if field has been touched (blurred)
    const [touched, setTouched] = React.useState(false);

    // Shake animation state
    const [shouldShake, setShouldShake] = React.useState(false);

    // Determine if controlled or uncontrolled
    const isControlled = controlledValue !== undefined;
    const currentValue = isControlled
      ? typeof controlledValue === "string"
        ? controlledValue
        : ""
      : internalValue;

    // Calculate validation status
    const status = React.useMemo((): FeedbackStatus => {
      if (!showValidation) return "idle";
      if (!currentValue) return "idle";
      if (validateOnBlur && !touched) return "idle";

      const isValid = validateInput(variant, currentValue);
      return isValid ? "valid" : "invalid";
    }, [showValidation, currentValue, validateOnBlur, touched, variant]);

    // Trigger shake on invalid
    const previousStatusRef = React.useRef(status);
    React.useEffect(() => {
      if (status === "invalid" && previousStatusRef.current !== "invalid") {
        setShouldShake(true);
        const timer = setTimeout(() => setShouldShake(false), 300);
        return () => clearTimeout(timer);
      }
      previousStatusRef.current = status;
    }, [status]);

    // Handle change
    const handleChange = React.useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        let newValue = e.target.value;

        // Format on change if enabled
        if (formatOnChange && pattern.format) {
          newValue = pattern.format(newValue);
        }

        // Update internal state for uncontrolled
        if (!isControlled) {
          setInternalValue(newValue);
        }

        // Call external onChange with modified event
        if (onChange) {
          const syntheticEvent = {
            ...e,
            target: { ...e.target, value: newValue },
            currentTarget: { ...e.currentTarget, value: newValue },
          };
          onChange(syntheticEvent as React.ChangeEvent<HTMLInputElement>);
        }

        // Call onValueChange callback
        if (onValueChange) {
          const isValid = validateInput(variant, newValue);
          onValueChange(newValue, isValid);
        }
      },
      [formatOnChange, pattern, isControlled, onChange, onValueChange, variant]
    );

    // Handle blur
    const handleBlur = React.useCallback(
      (e: React.FocusEvent<HTMLInputElement>) => {
        setTouched(true);

        // Format on blur if not formatting on change
        if (!formatOnChange && pattern.format) {
          const formatted = pattern.format(currentValue);
          if (!isControlled) {
            setInternalValue(formatted);
          }
          if (onValueChange) {
            const isValid = validateInput(variant, formatted);
            onValueChange(formatted, isValid);
          }
        }

        if (onBlur) {
          onBlur(e);
        }
      },
      [
        formatOnChange,
        pattern,
        currentValue,
        isControlled,
        onValueChange,
        variant,
        onBlur,
      ]
    );

    // Build input props from pattern
    const patternProps = React.useMemo(() => {
      const p: Partial<React.ComponentProps<"input">> = {};

      if (pattern.placeholder) {
        p.placeholder = pattern.placeholder;
      }

      if (pattern.inputMode) {
        p.inputMode = pattern.inputMode;
      }

      if (pattern.autoComplete) {
        p.autoComplete = pattern.autoComplete;
      }

      if (pattern.maxLength) {
        p.maxLength = pattern.maxLength;
      }

      return p;
    }, [pattern]);

    // Determine feedback message
    const feedbackMessage = React.useMemo(() => {
      if (status === "invalid" && errorMessage) return errorMessage;
      if (status === "valid" && successMessage) return successMessage;
      return undefined;
    }, [status, errorMessage, successMessage]);

    // Check for prefix/suffix
    const hasPrefix = "prefix" in pattern && pattern.prefix;
    const hasSuffix = "suffix" in pattern && pattern.suffix;

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {hasPrefix && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground text-sm">
              {pattern.prefix}
            </div>
          )}
          <Input
            ref={ref}
            id={inputId}
            type="text"
            value={currentValue}
            onChange={handleChange}
            onBlur={handleBlur}
            className={cn(
              statusBorderClasses[status],
              shouldShake && "field-invalid",
              hasPrefix && "pl-8",
              (hasSuffix || (showValidation && status !== "idle")) && "pr-12",
              hasSuffix && showValidation && status !== "idle" && "pr-16",
              className
            )}
            aria-invalid={status === "invalid" ? true : undefined}
            aria-describedby={
              feedbackMessage ? `${inputId}-feedback` : undefined
            }
            {...patternProps}
            {...props}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center gap-1.5">
            {showValidation && status !== "idle" && (
              <FormFieldFeedbackIcon status={status} />
            )}
            {hasSuffix && (
              <span className="text-muted-foreground text-sm">
                {pattern.suffix}
              </span>
            )}
          </div>
        </div>
        {feedbackMessage && (
          <FormFieldFeedback
            status={status}
            message={feedbackMessage}
            id={`${inputId}-feedback`}
          />
        )}
      </div>
    );
  }
);

SmartInput.displayName = "SmartInput";

/**
 * SmartInputGroup Component
 *
 * Wrapper voor meerdere SmartInputs naast elkaar (bijv. postcode + huisnummer)
 */
export function SmartInputGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-3", className)}>
      {children}
    </div>
  );
}

/**
 * Pre-configured SmartInput variants voor gemak
 */
export const PostcodeInput = React.forwardRef<
  HTMLInputElement,
  Omit<SmartInputProps, "variant">
>((props, ref) => <SmartInput ref={ref} variant="postcode" {...props} />);
PostcodeInput.displayName = "PostcodeInput";

export const TelefoonInput = React.forwardRef<
  HTMLInputElement,
  Omit<SmartInputProps, "variant">
>((props, ref) => <SmartInput ref={ref} variant="telefoon" {...props} />);
TelefoonInput.displayName = "TelefoonInput";

export const EmailInput = React.forwardRef<
  HTMLInputElement,
  Omit<SmartInputProps, "variant">
>((props, ref) => <SmartInput ref={ref} variant="email" {...props} />);
EmailInput.displayName = "EmailInput";

export const BedragInput = React.forwardRef<
  HTMLInputElement,
  Omit<SmartInputProps, "variant">
>((props, ref) => <SmartInput ref={ref} variant="bedrag" {...props} />);
BedragInput.displayName = "BedragInput";

export const OppervlakteInput = React.forwardRef<
  HTMLInputElement,
  Omit<SmartInputProps, "variant">
>((props, ref) => <SmartInput ref={ref} variant="oppervlakte" {...props} />);
OppervlakteInput.displayName = "OppervlakteInput";

export const HuisnummerInput = React.forwardRef<
  HTMLInputElement,
  Omit<SmartInputProps, "variant">
>((props, ref) => <SmartInput ref={ref} variant="huisnummer" {...props} />);
HuisnummerInput.displayName = "HuisnummerInput";

export const IBANInput = React.forwardRef<
  HTMLInputElement,
  Omit<SmartInputProps, "variant">
>((props, ref) => <SmartInput ref={ref} variant="iban" {...props} />);
IBANInput.displayName = "IBANInput";

export const KvKNummerInput = React.forwardRef<
  HTMLInputElement,
  Omit<SmartInputProps, "variant">
>((props, ref) => <SmartInput ref={ref} variant="kvkNummer" {...props} />);
KvKNummerInput.displayName = "KvKNummerInput";

export const BTWNummerInput = React.forwardRef<
  HTMLInputElement,
  Omit<SmartInputProps, "variant">
>((props, ref) => <SmartInput ref={ref} variant="btwNummer" {...props} />);
BTWNummerInput.displayName = "BTWNummerInput";
