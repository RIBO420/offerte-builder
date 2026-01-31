"use client";

import { memo, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Pencil,
  Calculator,
  Send,
  ThumbsUp,
  XCircle,
  Check,
} from "lucide-react";

interface OfferteWorkflowStepperProps {
  currentStatus: "concept" | "voorcalculatie" | "verzonden" | "geaccepteerd" | "afgewezen";
  hasVoorcalculatie: boolean;
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

  return (
    <div className="w-full">
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
                    step.state === "partially-complete" && "border-blue-500 bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
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
                    step.state === "partially-complete" && "border-blue-500 bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
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
