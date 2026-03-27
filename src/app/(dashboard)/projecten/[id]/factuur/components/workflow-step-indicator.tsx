"use client";

import { m } from "framer-motion";
import { Check } from "lucide-react";
import { useReducedMotion } from "@/hooks/use-accessibility";
import { transitions } from "@/lib/motion-config";
import { workflowSteps } from "./types";

export function WorkflowStepIndicator({
  currentStep,
  status,
}: {
  currentStep: number;
  status: string | null;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        {workflowSteps.map((step, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;
          const isUpcoming = stepNumber > currentStep;
          const Icon = step.icon;

          return (
            <div key={step.id} className="flex items-center flex-1 last:flex-none">
              <m.div
                initial={prefersReducedMotion ? {} : { scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{
                  delay: prefersReducedMotion ? 0 : index * 0.1,
                  ...transitions.fast,
                }}
                className="flex flex-col items-center"
              >
                <div
                  className={`
                    relative flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300
                    ${isCompleted ? "border-green-500 bg-green-500 text-white" : ""}
                    ${isCurrent ? "border-primary bg-primary text-white ring-4 ring-primary/20" : ""}
                    ${isUpcoming ? "border-muted-foreground/30 bg-muted text-muted-foreground" : ""}
                  `}
                >
                  {isCompleted ? (
                    <m.div
                      initial={prefersReducedMotion ? {} : { scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 15 }}
                    >
                      <Check className="h-5 w-5" />
                    </m.div>
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>
                <span
                  className={`
                    mt-2 text-xs font-medium whitespace-nowrap
                    ${isCompleted || isCurrent ? "text-foreground" : "text-muted-foreground"}
                  `}
                >
                  {step.label}
                </span>
              </m.div>

              {/* Connector line */}
              {index < workflowSteps.length - 1 && (
                <div className="flex-1 mx-2 h-0.5 rounded-full bg-muted-foreground/20 relative overflow-hidden">
                  <m.div
                    className="absolute inset-y-0 left-0 bg-green-500 rounded-full"
                    initial={{ width: "0%" }}
                    animate={{ width: isCompleted ? "100%" : "0%" }}
                    transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.5, delay: index * 0.1 }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
