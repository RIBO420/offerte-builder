"use client";

import Link from "next/link";
import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

// Project statuses - voorcalculatie is now at offerte level, projects start at "gepland"
// Note: "voorcalculatie" kept for backwards compatibility with existing projects
export type ProjectStatus =
  | "voorcalculatie"
  | "gepland"
  | "in_uitvoering"
  | "afgerond"
  | "nacalculatie_compleet"
  | "gefactureerd";

export interface ProjectProgressStepperProps {
  projectId: string;
  /** The actual project status from the database - determines which step is current/completed */
  projectStatus: ProjectStatus;
  /** @deprecated Use projectStatus instead. This prop is ignored. */
  currentStatus?: ProjectStatus;
  hasPlanning?: boolean;
  hasUrenRegistraties?: boolean;
  hasNacalculatie?: boolean;
  hasFactuur?: boolean;
}

interface Step {
  id: ProjectStatus;
  label: string;
  href: string | null;
}

// New workflow: Gepland -> In Uitvoering -> Afgerond -> Nacalculatie -> Gefactureerd
const statusOrder: ProjectStatus[] = [
  "gepland",
  "in_uitvoering",
  "afgerond",
  "nacalculatie_compleet",
  "gefactureerd",
];

const statusLabels: Record<ProjectStatus, string> = {
  voorcalculatie: "Voorcalculatie", // Legacy, maps to gepland
  gepland: "Gepland",
  in_uitvoering: "In Uitvoering",
  afgerond: "Afgerond",
  nacalculatie_compleet: "Nacalculatie",
  gefactureerd: "Gefactureerd",
};

/**
 * ProjectProgressStepper - Shows the project phases as a horizontal/vertical stepper
 *
 * Workflow: Gepland -> In Uitvoering -> Afgerond -> Nacalculatie -> Gefactureerd
 *
 * Features:
 * - Shows the ACTUAL project status from database (not the current page)
 * - Current step (based on projectStatus) is highlighted with primary color
 * - Completed steps show a checkmark and are clickable for navigation
 * - Future steps are grayed out but visible
 * - Responsive: horizontal on desktop, vertical on mobile
 *
 * @param projectStatus - The actual project status from database (e.g., project.status)
 */
export function ProjectProgressStepper({
  projectId,
  projectStatus,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  currentStatus: _deprecated, // Kept for backwards compatibility, but ignored
  hasPlanning = false,
  hasUrenRegistraties = false,
  hasNacalculatie = false,
  hasFactuur = false,
}: ProjectProgressStepperProps) {
  // Map legacy "voorcalculatie" status to "gepland" for display purposes
  const effectiveStatus = projectStatus === "voorcalculatie" ? "gepland" : projectStatus;
  const projectStatusIndex = statusOrder.indexOf(effectiveStatus);

  // Define steps with their navigation targets
  // Navigation is allowed to any step that has been reached (current or completed)
  const steps: Step[] = [
    {
      id: "gepland",
      label: statusLabels.gepland,
      // Planning is always accessible
      href: `/projecten/${projectId}/planning`,
    },
    {
      id: "in_uitvoering",
      label: statusLabels.in_uitvoering,
      // Uitvoering is accessible once project is in_uitvoering or beyond
      href: projectStatusIndex >= statusOrder.indexOf("in_uitvoering")
        ? `/projecten/${projectId}/uitvoering`
        : null,
    },
    {
      id: "afgerond",
      label: statusLabels.afgerond,
      // Project overview - always accessible
      href: `/projecten/${projectId}`,
    },
    {
      id: "nacalculatie_compleet",
      label: statusLabels.nacalculatie_compleet,
      // Nacalculatie is accessible once project is afgerond or beyond
      href: projectStatusIndex >= statusOrder.indexOf("afgerond")
        ? `/projecten/${projectId}/nacalculatie`
        : null,
    },
    {
      id: "gefactureerd",
      label: statusLabels.gefactureerd,
      // Factuur is accessible once nacalculatie is complete
      href: projectStatusIndex >= statusOrder.indexOf("nacalculatie_compleet")
        ? `/projecten/${projectId}/factuur`
        : null,
    },
  ];

  const isStepCompleted = (stepIndex: number) => stepIndex < projectStatusIndex;
  const isStepCurrent = (stepIndex: number) => stepIndex === projectStatusIndex;
  const isStepFuture = (stepIndex: number) => stepIndex > projectStatusIndex;

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
