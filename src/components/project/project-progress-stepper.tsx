"use client";

import Link from "next/link";
import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ProjectStatus =
  | "voorcalculatie"
  | "gepland"
  | "in_uitvoering"
  | "afgerond"
  | "nacalculatie_compleet";

export interface ProjectProgressStepperProps {
  projectId: string;
  currentStatus: ProjectStatus;
  hasVoorcalculatie?: boolean;
  hasPlanning?: boolean;
  hasUrenRegistraties?: boolean;
  hasNacalculatie?: boolean;
}

interface Step {
  id: ProjectStatus;
  label: string;
  href: string | null;
}

const statusOrder: ProjectStatus[] = [
  "voorcalculatie",
  "gepland",
  "in_uitvoering",
  "afgerond",
  "nacalculatie_compleet",
];

const statusLabels: Record<ProjectStatus, string> = {
  voorcalculatie: "Voorcalculatie",
  gepland: "Gepland",
  in_uitvoering: "In Uitvoering",
  afgerond: "Afgerond",
  nacalculatie_compleet: "Nacalculatie",
};

/**
 * ProjectProgressStepper - Shows the 5 project phases as a horizontal/vertical stepper
 *
 * Features:
 * - Current status is highlighted (primary color, filled circle)
 * - Completed steps have a checkmark
 * - Future steps are grayed out
 * - Clickable for navigation (when available)
 * - Responsive: horizontal on desktop, vertical on mobile
 */
export function ProjectProgressStepper({
  projectId,
  currentStatus,
  hasVoorcalculatie = false,
  hasPlanning = false,
  hasUrenRegistraties = false,
  hasNacalculatie = false,
}: ProjectProgressStepperProps) {
  const currentIndex = statusOrder.indexOf(currentStatus);

  // Define steps with their navigation targets
  const steps: Step[] = [
    {
      id: "voorcalculatie",
      label: statusLabels.voorcalculatie,
      href: hasVoorcalculatie ? `/projecten/${projectId}/voorcalculatie` : null,
    },
    {
      id: "gepland",
      label: statusLabels.gepland,
      href: hasPlanning ? `/projecten/${projectId}/planning` : null,
    },
    {
      id: "in_uitvoering",
      label: statusLabels.in_uitvoering,
      href: hasUrenRegistraties ? `/projecten/${projectId}/uitvoering` : null,
    },
    {
      id: "afgerond",
      label: statusLabels.afgerond,
      href: null, // Project overview
    },
    {
      id: "nacalculatie_compleet",
      label: statusLabels.nacalculatie_compleet,
      href: hasNacalculatie ? `/projecten/${projectId}/nacalculatie` : null,
    },
  ];

  const isStepCompleted = (stepIndex: number) => stepIndex < currentIndex;
  const isStepCurrent = (stepIndex: number) => stepIndex === currentIndex;
  const isStepFuture = (stepIndex: number) => stepIndex > currentIndex;

  return (
    <nav aria-label="Project voortgang" className="w-full">
      {/* Mobile view: Vertical stepper */}
      <div className="flex flex-col gap-0 md:hidden">
        {steps.map((step, index) => {
          const completed = isStepCompleted(index);
          const current = isStepCurrent(index);
          const future = isStepFuture(index);
          const isLast = index === steps.length - 1;
          const isClickable = step.href !== null && !future;

          const StepContent = (
            <div className="flex items-start gap-3">
              {/* Circle indicator */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold transition-all shrink-0",
                    completed && "bg-primary text-primary-foreground",
                    current && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                    future && "bg-muted text-muted-foreground border-2 border-muted-foreground/30"
                  )}
                >
                  {completed ? (
                    <Check className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <Circle className={cn("w-3 h-3", current && "fill-current")} aria-hidden="true" />
                  )}
                </div>
                {/* Vertical connector line */}
                {!isLast && (
                  <div
                    className={cn(
                      "w-0.5 h-8 mt-1",
                      completed ? "bg-primary" : "bg-border"
                    )}
                    aria-hidden="true"
                  />
                )}
              </div>

              {/* Step label */}
              <div className="pt-1">
                <span
                  className={cn(
                    "text-sm font-medium",
                    current && "text-primary",
                    completed && "text-foreground",
                    future && "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
              </div>
            </div>
          );

          return (
            <div key={step.id}>
              {isClickable ? (
                <Link
                  href={step.href!}
                  className="block hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-lg p-1 -m-1"
                  aria-current={current ? "step" : undefined}
                >
                  {StepContent}
                  <span className="sr-only">
                    {completed
                      ? `${step.label} voltooid - klik om te bekijken`
                      : current
                        ? `Huidige stap: ${step.label}`
                        : step.label}
                  </span>
                </Link>
              ) : (
                <div
                  className={cn(
                    "p-1 -m-1",
                    future && "opacity-50"
                  )}
                  aria-current={current ? "step" : undefined}
                >
                  {StepContent}
                  <span className="sr-only">
                    {completed
                      ? `${step.label} voltooid`
                      : current
                        ? `Huidige stap: ${step.label}`
                        : `${step.label} - nog niet beschikbaar`}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop view: Horizontal stepper */}
      <ol className="hidden md:flex items-center w-full">
        {steps.map((step, index) => {
          const completed = isStepCompleted(index);
          const current = isStepCurrent(index);
          const future = isStepFuture(index);
          const isLast = index === steps.length - 1;
          const isClickable = step.href !== null && !future;

          const StepIndicator = (
            <div className="flex flex-col items-center">
              {/* Circle indicator */}
              <div
                className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-full text-sm font-semibold transition-all",
                  completed && "bg-primary text-primary-foreground",
                  current && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                  future && "bg-muted text-muted-foreground border-2 border-muted-foreground/30",
                  isClickable && "group-hover:ring-4 group-hover:ring-primary/10"
                )}
              >
                {completed ? (
                  <Check className="w-5 h-5" aria-hidden="true" />
                ) : (
                  <Circle className={cn("w-4 h-4", current && "fill-current")} aria-hidden="true" />
                )}
              </div>

              {/* Step label */}
              <span
                className={cn(
                  "mt-2 text-sm font-medium text-center whitespace-nowrap",
                  current && "text-primary",
                  completed && "text-foreground",
                  future && "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </div>
          );

          return (
            <li
              key={step.id}
              className={cn(
                "flex items-center",
                !isLast && "flex-1"
              )}
            >
              {isClickable ? (
                <Link
                  href={step.href!}
                  className="group flex flex-col items-center focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-lg p-2 -m-2 hover:opacity-90 transition-opacity"
                  aria-current={current ? "step" : undefined}
                >
                  {StepIndicator}
                  <span className="sr-only">
                    {completed
                      ? `${step.label} voltooid - klik om te bekijken`
                      : current
                        ? `Huidige stap: ${step.label}`
                        : step.label}
                  </span>
                </Link>
              ) : (
                <div
                  className={cn(
                    "flex flex-col items-center p-2 -m-2",
                    future && "opacity-60"
                  )}
                  aria-current={current ? "step" : undefined}
                >
                  {StepIndicator}
                  <span className="sr-only">
                    {completed
                      ? `${step.label} voltooid`
                      : current
                        ? `Huidige stap: ${step.label}`
                        : `${step.label} - nog niet beschikbaar`}
                  </span>
                </div>
              )}

              {/* Horizontal connector line */}
              {!isLast && (
                <div
                  className={cn(
                    "flex-1 h-0.5 mx-3 mt-[-1.5rem]",
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
