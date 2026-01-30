"use client";

import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState } from "react";

export interface WizardStep {
  id: number;
  name: string;
  shortName?: string;
  icon?: React.ComponentType<{ className?: string }>;
  summary?: React.ReactNode;
  isValid?: boolean;
}

interface WizardStepsProps {
  steps: WizardStep[];
  currentStep: number;
  onStepClick?: (stepIndex: number) => void;
  allowNavigation?: boolean;
  showSummaries?: boolean;
  className?: string;
}

export function WizardSteps({
  steps,
  currentStep,
  onStepClick,
  allowNavigation = true,
  showSummaries = true,
  className,
}: WizardStepsProps) {
  const [expandedSummary, setExpandedSummary] = useState<number | null>(null);
  const progress = ((currentStep + 1) / steps.length) * 100;

  const canNavigateToStep = (stepIndex: number) => {
    if (!allowNavigation) return false;
    // Can always go back to previous steps
    if (stepIndex < currentStep) return true;
    // Cannot skip ahead past the current step
    return false;
  };

  const handleStepClick = (stepIndex: number) => {
    if (canNavigateToStep(stepIndex) && onStepClick) {
      onStepClick(stepIndex);
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Progress bar with percentage */}
      <div className="flex items-center gap-3">
        <Progress value={progress} className="h-2 flex-1" />
        <span className="text-sm font-medium text-muted-foreground whitespace-nowrap min-w-[3rem] text-right">
          {Math.round(progress)}%
        </span>
      </div>

      {/* Step indicators */}
      <nav aria-label="Wizard stappen">
        <ol className="flex items-center justify-between">
          {steps.map((step, index) => {
            const isCompleted = index < currentStep;
            const isCurrent = index === currentStep;
            const isClickable = canNavigateToStep(index);
            const Icon = step.icon;

            return (
              <li
                key={step.id}
                className={cn(
                  "flex-1 relative",
                  index !== steps.length - 1 && "pr-4 sm:pr-8"
                )}
              >
                {/* Connecting line */}
                {index !== steps.length - 1 && (
                  <div
                    className={cn(
                      "absolute top-4 left-1/2 h-0.5 w-full -translate-y-1/2",
                      isCompleted ? "bg-primary" : "bg-muted"
                    )}
                    aria-hidden="true"
                  />
                )}

                <div className="relative flex flex-col items-center group">
                  {/* Step circle */}
                  <button
                    type="button"
                    onClick={() => handleStepClick(index)}
                    disabled={!isClickable}
                    className={cn(
                      "relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all",
                      isCompleted && [
                        "border-primary bg-primary text-primary-foreground",
                        isClickable && "cursor-pointer hover:bg-primary/90",
                      ],
                      isCurrent && "border-primary bg-background text-primary ring-4 ring-primary/20",
                      !isCompleted && !isCurrent && "border-muted bg-background text-muted-foreground",
                      isClickable && "cursor-pointer",
                      !isClickable && "cursor-default"
                    )}
                    aria-current={isCurrent ? "step" : undefined}
                  >
                    {isCompleted ? (
                      <Check className="h-4 w-4" />
                    ) : Icon ? (
                      <Icon className="h-4 w-4" />
                    ) : (
                      <span className="text-xs font-semibold">{index + 1}</span>
                    )}
                  </button>

                  {/* Step name */}
                  <span
                    className={cn(
                      "mt-2 text-xs font-medium text-center transition-colors",
                      isCurrent && "text-primary",
                      isCompleted && "text-foreground",
                      !isCompleted && !isCurrent && "text-muted-foreground",
                      "hidden sm:block"
                    )}
                  >
                    {step.shortName || step.name}
                  </span>

                  {/* Clickable indicator tooltip */}
                  {isClickable && (
                    <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap hidden sm:block">
                      Klik om terug te gaan
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Summaries for completed steps */}
      {showSummaries && currentStep > 0 && (
        <div className="space-y-2 pt-2">
          {steps.slice(0, currentStep).map((step, index) => {
            if (!step.summary) return null;
            const isExpanded = expandedSummary === index;

            return (
              <Collapsible
                key={step.id}
                open={isExpanded}
                onOpenChange={(open) => setExpandedSummary(open ? index : null)}
              >
                <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-sm hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-green-600" />
                    <span className="font-medium">{step.name}</span>
                    {step.isValid === false && (
                      <span className="text-xs text-orange-600">(onvolledig)</span>
                    )}
                  </div>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform",
                      isExpanded && "rotate-180"
                    )}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent className="px-3 py-2 text-sm text-muted-foreground border-x border-b rounded-b-lg bg-muted/10">
                  {step.summary}
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Compact horizontal version for the header
interface WizardStepsCompactProps {
  steps: { id: number; name: string; shortName?: string }[];
  currentStep: number;
  onStepClick?: (stepIndex: number) => void;
  allowNavigation?: boolean;
  className?: string;
}

export function WizardStepsCompact({
  steps,
  currentStep,
  onStepClick,
  allowNavigation = true,
  className,
}: WizardStepsCompactProps) {
  const progress = ((currentStep + 1) / steps.length) * 100;

  const canNavigateToStep = (stepIndex: number) => {
    if (!allowNavigation) return false;
    return stepIndex < currentStep;
  };

  const handleStepClick = (stepIndex: number) => {
    if (canNavigateToStep(stepIndex) && onStepClick) {
      onStepClick(stepIndex);
    }
  };

  return (
    <div className={cn("flex items-center gap-4", className)}>
      {/* Compact step indicators */}
      <div className="flex items-center gap-1">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isClickable = canNavigateToStep(index);

          return (
            <button
              key={step.id}
              type="button"
              onClick={() => handleStepClick(index)}
              disabled={!isClickable}
              className={cn(
                "h-2 rounded-full transition-all",
                isCurrent && "w-6 bg-primary",
                isCompleted && "w-2 bg-primary",
                !isCompleted && !isCurrent && "w-2 bg-muted",
                isClickable && "cursor-pointer hover:opacity-80"
              )}
              title={isClickable ? `Terug naar ${step.shortName || step.name}` : step.shortName || step.name}
            />
          );
        })}
      </div>

      {/* Current step name */}
      <span className="text-sm text-muted-foreground">
        {steps[currentStep]?.shortName || steps[currentStep]?.name}
      </span>

      {/* Progress percentage */}
      <span className="text-sm font-medium text-muted-foreground">
        {Math.round(progress)}%
      </span>
    </div>
  );
}
