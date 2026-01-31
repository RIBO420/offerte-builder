"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { FormFieldFeedback, FormFieldFeedbackIcon } from "@/components/ui/form-field-feedback";

type FeedbackStatus = "idle" | "valid" | "invalid" | "validating";

interface InputWithFeedbackProps extends React.ComponentProps<"input"> {
  status?: FeedbackStatus;
  feedbackMessage?: string;
  showFeedbackIcon?: boolean;
}

const statusBorderClasses: Record<FeedbackStatus, string> = {
  idle: "",
  valid: "border-ring focus-visible:border-ring focus-visible:ring-ring/50",
  invalid: "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20",
  validating: "",
};

/**
 * InputWithFeedback component
 *
 * Wrapper rond de bestaande Input component die:
 * - Status icon rechts in het veld toont
 * - Border kleur aanpast op basis van status
 * - Feedback message eronder toont
 * - Shake animatie bij invalid (gebruikt bestaande .field-invalid class)
 */
const InputWithFeedback = React.forwardRef<HTMLInputElement, InputWithFeedbackProps>(
  (
    {
      status = "idle",
      feedbackMessage,
      showFeedbackIcon = true,
      className,
      ...props
    },
    ref
  ) => {
  const [shouldShake, setShouldShake] = React.useState(false);
  const previousStatusRef = React.useRef(status);

  // Trigger shake animation when status changes to invalid
  React.useEffect(() => {
    if (status === "invalid" && previousStatusRef.current !== "invalid") {
      setShouldShake(true);
      const timer = setTimeout(() => setShouldShake(false), 300);
      return () => clearTimeout(timer);
    }
    previousStatusRef.current = status;
  }, [status]);

    return (
      <div className="w-full space-y-1.5">
        <div className="relative">
          <Input
            ref={ref}
            className={cn(
              statusBorderClasses[status],
              shouldShake && "field-invalid",
              showFeedbackIcon && status !== "idle" && "pr-10",
              className
            )}
            aria-invalid={status === "invalid" ? true : undefined}
            aria-describedby={feedbackMessage ? `${props.id}-feedback` : undefined}
            {...props}
          />
          {showFeedbackIcon && status !== "idle" && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <FormFieldFeedbackIcon status={status} />
            </div>
          )}
        </div>
        {feedbackMessage && (
          <FormFieldFeedback
            status={status}
            message={feedbackMessage}
            id={props.id ? `${props.id}-feedback` : undefined}
          />
        )}
      </div>
    );
  }
);

InputWithFeedback.displayName = "InputWithFeedback";

export { InputWithFeedback };
