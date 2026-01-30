"use client";

import { cn } from "@/lib/utils";
import { Check, X, Loader2 } from "lucide-react";

type FeedbackStatus = "idle" | "valid" | "invalid" | "validating";

interface FormFieldFeedbackProps {
  status: FeedbackStatus;
  message?: string;
  className?: string;
  id?: string;
}

const statusConfig = {
  idle: {
    icon: null,
    iconClass: "",
    messageClass: "text-muted-foreground",
  },
  valid: {
    icon: Check,
    iconClass: "text-green-600 dark:text-green-400",
    messageClass: "text-green-600 dark:text-green-400",
  },
  invalid: {
    icon: X,
    iconClass: "text-destructive",
    messageClass: "text-destructive",
  },
  validating: {
    icon: Loader2,
    iconClass: "text-muted-foreground animate-spin",
    messageClass: "text-muted-foreground",
  },
} as const;

/**
 * FormFieldFeedback component
 *
 * Displays validation status and messages for form fields.
 *
 * Design:
 * - idle: geen indicator
 * - valid: groene check icon + optionele message
 * - invalid: rode X icon + error message
 * - validating: spinner
 *
 * Features:
 * - Animatie: fade in/out bij status change
 * - Inline of onder input positie
 */
function FormFieldFeedback({
  status,
  message,
  className,
  id,
}: FormFieldFeedbackProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  // Don't render anything for idle status without message
  if (status === "idle" && !message) {
    return null;
  }

  return (
    <div
      id={id}
      className={cn(
        "flex items-center gap-1.5 text-sm transition-opacity duration-200",
        status === "idle" ? "opacity-70" : "opacity-100",
        className
      )}
      role={status === "invalid" ? "alert" : undefined}
      aria-live={status === "invalid" ? "polite" : undefined}
    >
      {Icon && (
        <Icon
          className={cn("h-4 w-4 shrink-0", config.iconClass)}
          aria-hidden="true"
        />
      )}
      {message && (
        <span className={cn("text-sm", config.messageClass)}>{message}</span>
      )}
    </div>
  );
}

FormFieldFeedback.displayName = "FormFieldFeedback";

/**
 * FormFieldFeedbackIcon component
 *
 * Alleen het icon, voor inline gebruik in input velden.
 */
function FormFieldFeedbackIcon({
  status,
  className,
}: {
  status: FeedbackStatus;
  className?: string;
}) {
  const config = statusConfig[status];
  const Icon = config.icon;

  if (!Icon) {
    return null;
  }

  return (
    <Icon
      className={cn("h-4 w-4 shrink-0", config.iconClass, className)}
      aria-hidden="true"
    />
  );
}

FormFieldFeedbackIcon.displayName = "FormFieldFeedbackIcon";

export { FormFieldFeedback, FormFieldFeedbackIcon };
