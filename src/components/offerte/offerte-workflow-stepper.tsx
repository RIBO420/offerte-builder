"use client";

import { memo, useMemo } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Pencil,
  Calculator,
  Send,
  ThumbsUp,
  XCircle,
  Check,
  ChevronRight,
  Info,
} from "lucide-react";

interface OfferteWorkflowStepperProps {
  currentStatus: "concept" | "voorcalculatie" | "verzonden" | "geaccepteerd" | "afgewezen";
  hasVoorcalculatie: boolean;
  offerteId?: string;
  showNextStepAction?: boolean;
  onSendOfferte?: () => void;
}

interface Step {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

type StepState = "completed" | "current" | "partially-complete" | "upcoming" | "rejected";

interface StepWithState extends Step {
  state: StepState;
  isRejected?: boolean;
}

const steps: Step[] = [
  {
    id: "concept",
    label: "Concept",
    description: "Offerte opstellen",
    icon: Pencil,
  },
  {
    id: "voorcalculatie",
    label: "Voorcalculatie",
    description: "Team & uren bepalen",
    icon: Calculator,
  },
  {
    id: "verzonden",
    label: "Verzonden",
    description: "Naar klant gestuurd",
    icon: Send,
  },
  {
    id: "geaccepteerd",
    label: "Geaccepteerd",
    description: "Klant akkoord",
    icon: ThumbsUp,
  },
];

export const OfferteWorkflowStepper = memo(function OfferteWorkflowStepper({
  currentStatus,
  hasVoorcalculatie,
  offerteId,
  showNextStepAction = false,
  onSendOfferte,
}: OfferteWorkflowStepperProps) {
  // Determine step states
  const stepStates = useMemo((): StepWithState[] => {
    const statusOrder = ["concept", "voorcalculatie", "verzonden", "geaccepteerd"];
    const currentIndex = statusOrder.indexOf(currentStatus);

    // Handle afgewezen - show it separately
    if (currentStatus === "afgewezen") {
      return steps.map((step, index): StepWithState => {
        if (step.id === "geaccepteerd") {
          return { ...step, state: "rejected", isRejected: true };
        }
        if (index < 3) {
          return { ...step, state: "completed" };
        }
        return { ...step, state: "upcoming" };
      });
    }

    return steps.map((step): StepWithState => {
      const stepIndex = statusOrder.indexOf(step.id);

      if (stepIndex < currentIndex) {
        return { ...step, state: "completed" };
      } else if (stepIndex === currentIndex) {
        // Special case: concept with voorcalculatie should show voorcalculatie as partially complete
        if (step.id === "voorcalculatie" && currentStatus === "concept" && hasVoorcalculatie) {
          return { ...step, state: "partially-complete" };
        }
        return { ...step, state: "current" };
      } else {
        // Check if voorcalculatie step should be marked as ready
        if (step.id === "voorcalculatie" && currentStatus === "concept" && hasVoorcalculatie) {
          return { ...step, state: "completed" };
        }
        return { ...step, state: "upcoming" };
      }
    });
  }, [currentStatus, hasVoorcalculatie]);

  // Determine what the next action should be
  const nextStepInfo = useMemo(() => {
    if (currentStatus === "concept" && !hasVoorcalculatie) {
      return {
        title: "Volgende stap: Voorcalculatie",
        description: "Bepaal het team en bereken de benodigde uren om de offerte te kunnen verzenden.",
        actionLabel: "Start voorcalculatie",
        actionHref: offerteId ? `/offertes/${offerteId}/voorcalculatie` : undefined,
        variant: "primary" as const,
      };
    }
    if (currentStatus === "concept" && hasVoorcalculatie) {
      return {
        title: "Voorcalculatie ingevuld",
        description: "De voorcalculatie is gereed. Je kunt de offerte nu verzenden naar de klant.",
        actionLabel: "Verzend offerte",
        onAction: onSendOfferte,
        variant: "success" as const,
      };
    }
    if (currentStatus === "voorcalculatie") {
      return {
        title: "Klaar om te verzenden",
        description: "De voorcalculatie is afgerond. Verzend de offerte naar de klant via email of deel een link.",
        actionLabel: "Verzend offerte",
        onAction: onSendOfferte,
        variant: "success" as const,
      };
    }
    if (currentStatus === "verzonden") {
      return {
        title: "Wachten op reactie",
        description: "De offerte is verzonden naar de klant. Je ontvangt een melding wanneer de klant reageert.",
        variant: "info" as const,
      };
    }
    if (currentStatus === "geaccepteerd") {
      return {
        title: "Offerte geaccepteerd!",
        description: "De klant heeft de offerte geaccepteerd. Je kunt nu een project aanmaken.",
        actionLabel: "Start project",
        actionHref: offerteId ? `/projecten/nieuw?offerte=${offerteId}` : undefined,
        variant: "success" as const,
      };
    }
    return null;
  }, [currentStatus, hasVoorcalculatie, offerteId, onSendOfferte]);

  return (
    <div className="w-full space-y-6">
      {/* Next step guidance banner */}
      {showNextStepAction && nextStepInfo && currentStatus !== "afgewezen" && (
        <div
          className={cn(
            "rounded-lg p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4",
            nextStepInfo.variant === "primary" && "bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800",
            nextStepInfo.variant === "success" && "bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800",
            nextStepInfo.variant === "info" && "bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800"
          )}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Info
                className={cn(
                  "h-4 w-4 shrink-0",
                  nextStepInfo.variant === "primary" && "text-blue-600",
                  nextStepInfo.variant === "success" && "text-green-600",
                  nextStepInfo.variant === "info" && "text-amber-600"
                )}
              />
              <p
                className={cn(
                  "font-medium text-sm",
                  nextStepInfo.variant === "primary" && "text-blue-800 dark:text-blue-200",
                  nextStepInfo.variant === "success" && "text-green-800 dark:text-green-200",
                  nextStepInfo.variant === "info" && "text-amber-800 dark:text-amber-200"
                )}
              >
                {nextStepInfo.title}
              </p>
            </div>
            <p className="text-sm text-muted-foreground pl-6">
              {nextStepInfo.description}
            </p>
          </div>
          {nextStepInfo.actionLabel && (nextStepInfo.actionHref || nextStepInfo.onAction) && (
            <div className="shrink-0 pl-6 sm:pl-0">
              {nextStepInfo.actionHref ? (
                <Button
                  asChild
                  size="sm"
                  className={cn(
                    nextStepInfo.variant === "primary" && "bg-blue-600 hover:bg-blue-700",
                    nextStepInfo.variant === "success" && "bg-green-600 hover:bg-green-700"
                  )}
                >
                  <Link href={nextStepInfo.actionHref}>
                    {nextStepInfo.actionLabel}
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={nextStepInfo.onAction}
                  className={cn(
                    nextStepInfo.variant === "primary" && "bg-blue-600 hover:bg-blue-700",
                    nextStepInfo.variant === "success" && "bg-green-600 hover:bg-green-700"
                  )}
                >
                  {nextStepInfo.actionLabel}
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Mobile view - vertical stepper */}
      <div className="md:hidden space-y-4">
        {stepStates.map((step, index) => {
          const Icon = step.isRejected ? XCircle : step.icon;
          const isLast = index === stepStates.length - 1;

          return (
            <div key={step.id} className="flex gap-3">
              {/* Icon */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors",
                    step.state === "completed" && "bg-primary border-primary text-primary-foreground",
                    step.state === "current" && "border-primary bg-primary/10 text-primary",
                    step.state === "partially-complete" && "border-blue-600 bg-blue-200 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
                    step.state === "upcoming" && "border-muted-foreground/30 text-muted-foreground/50",
                    step.isRejected && "bg-red-500 border-red-500 text-white"
                  )}
                >
                  {step.state === "completed" ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                {!isLast && (
                  <div
                    className={cn(
                      "w-0.5 flex-1 min-h-[24px] mt-2",
                      step.state === "completed" ? "bg-primary" : "bg-muted-foreground/20"
                    )}
                  />
                )}
              </div>

              {/* Content */}
              <div className="pb-4">
                <p
                  className={cn(
                    "font-medium text-sm",
                    step.state === "completed" && "text-primary",
                    step.state === "current" && "text-primary",
                    step.state === "upcoming" && "text-muted-foreground",
                    step.isRejected && "text-red-500"
                  )}
                >
                  {step.isRejected ? "Afgewezen" : step.label}
                </p>
                <p className="text-xs text-muted-foreground">
                  {step.isRejected ? "Klant heeft afgewezen" : step.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop view - horizontal stepper */}
      <div className="hidden md:flex items-center justify-between">
        {stepStates.map((step, index) => {
          const Icon = step.isRejected ? XCircle : step.icon;
          const isLast = index === stepStates.length - 1;

          return (
            <div key={step.id} className="flex items-center flex-1">
              {/* Step */}
              <div className="flex flex-col items-center gap-2">
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors",
                    step.state === "completed" && "bg-primary border-primary text-primary-foreground",
                    step.state === "current" && "border-primary bg-primary/10 text-primary",
                    step.state === "partially-complete" && "border-blue-600 bg-blue-200 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
                    step.state === "upcoming" && "border-muted-foreground/30 text-muted-foreground/50",
                    step.isRejected && "bg-red-500 border-red-500 text-white"
                  )}
                >
                  {step.state === "completed" ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>
                <div className="text-center">
                  <p
                    className={cn(
                      "font-medium text-sm",
                      step.state === "completed" && "text-primary",
                      step.state === "current" && "text-primary",
                      step.state === "upcoming" && "text-muted-foreground",
                      step.isRejected && "text-red-500"
                    )}
                  >
                    {step.isRejected ? "Afgewezen" : step.label}
                  </p>
                  <p className="text-xs text-muted-foreground max-w-[120px]">
                    {step.isRejected ? "Klant heeft afgewezen" : step.description}
                  </p>
                </div>
              </div>

              {/* Connector line */}
              {!isLast && (
                <div
                  className={cn(
                    "flex-1 h-0.5 mx-4",
                    step.state === "completed" ? "bg-primary" : "bg-muted-foreground/20"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
