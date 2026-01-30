"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface WizardStep {
  id: string;
  label: string;
  description?: string;
}

interface WizardStepperProps {
  steps: WizardStep[];
  currentStep: number;
  completedSteps?: number[];
  onStepClick?: (stepIndex: number) => void;
  className?: string;
}

/**
 * Accessible wizard stepper component
 * Provides visual progress indication for multi-step forms/wizards
 *
 * ARIA features:
 * - nav with aria-label for wizard context
 * - ol/li structure for semantic step list
 * - aria-current="step" for current step
 * - aria-disabled for unavailable steps
 */
export function WizardStepper({
  steps,
  currentStep,
  completedSteps = [],
  onStepClick,
  className,
}: WizardStepperProps) {
  const isStepCompleted = (index: number) => completedSteps.includes(index);
  const isStepCurrent = (index: number) => index === currentStep;
  const isStepClickable = (index: number) =>
    onStepClick && (isStepCompleted(index) || index <= currentStep);

  return (
    <nav aria-label="Wizard voortgang" className={className}>
      {/* Mobile view: Simple step indicator */}
      <div className="flex sm:hidden items-center justify-center py-4">
        <span className="text-sm font-medium text-foreground">
          Stap {currentStep + 1} van {steps.length}
        </span>
        <span className="mx-2 text-muted-foreground">-</span>
        <span className="text-sm text-muted-foreground">
          {steps[currentStep]?.label}
        </span>
      </div>

      {/* Desktop view: Full stepper */}
      <ol className="hidden sm:flex items-center w-full">
        {steps.map((step, index) => {
          const completed = isStepCompleted(index);
          const current = isStepCurrent(index);
          const clickable = isStepClickable(index);
          const isLast = index === steps.length - 1;

          return (
            <li
              key={step.id}
              className={cn(
                "flex items-center",
                !isLast && "flex-1"
              )}
            >
              {/* Step indicator */}
              <button
                type="button"
                onClick={() => clickable && onStepClick?.(index)}
                disabled={!clickable}
                aria-current={current ? "step" : undefined}
                aria-disabled={!clickable}
                className={cn(
                  "flex flex-col items-center group",
                  clickable && "cursor-pointer",
                  !clickable && "cursor-default"
                )}
              >
                {/* Circle indicator */}
                <span
                  className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-full text-sm font-semibold transition-all",
                    // Completed state
                    completed && "bg-primary text-primary-foreground",
                    // Current state
                    current && !completed && "bg-background ring-2 ring-primary text-primary",
                    // Future state
                    !completed && !current && "bg-muted text-muted-foreground",
                    // Focus styling
                    clickable && "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                    // Hover for clickable
                    clickable && !current && !completed && "group-hover:bg-muted/80"
                  )}
                >
                  {completed ? (
                    <Check className="w-5 h-5" aria-hidden="true" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </span>

                {/* Step label */}
                <span
                  className={cn(
                    "mt-2 text-sm font-medium text-center max-w-[100px]",
                    current && "text-primary",
                    completed && "text-foreground",
                    !current && !completed && "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>

                {/* Step description (optional) */}
                {step.description && (
                  <span className="mt-1 text-xs text-muted-foreground text-center max-w-[120px]">
                    {step.description}
                  </span>
                )}

                {/* Screen reader text */}
                <span className="sr-only">
                  {completed
                    ? `${step.label} voltooid`
                    : current
                      ? `Huidige stap: ${step.label}`
                      : `Stap ${index + 1}: ${step.label}`}
                </span>
              </button>

              {/* Connector line */}
              {!isLast && (
                <div
                  className={cn(
                    "flex-1 h-0.5 mx-4",
                    completed ? "bg-primary" : "bg-border"
                  )}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * Hook to manage wizard stepper state
 */
export function useWizardStepper(totalSteps: number) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  const goToStep = (step: number) => {
    if (step >= 0 && step < totalSteps) {
      setCurrentStep(step);
    }
  };

  const nextStep = () => {
    if (currentStep < totalSteps - 1) {
      setCompletedSteps((prev) =>
        prev.includes(currentStep) ? prev : [...prev, currentStep]
      );
      setCurrentStep((prev) => prev + 1);
    }
  };

  const previousStep = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const completeStep = (step: number) => {
    if (!completedSteps.includes(step)) {
      setCompletedSteps((prev) => [...prev, step]);
    }
  };

  const reset = () => {
    setCurrentStep(0);
    setCompletedSteps([]);
  };

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

  return {
    currentStep,
    completedSteps,
    goToStep,
    nextStep,
    previousStep,
    completeStep,
    reset,
    isFirstStep,
    isLastStep,
  };
}

