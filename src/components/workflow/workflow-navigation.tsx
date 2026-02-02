"use client";

import { memo, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Calculator,
  FolderKanban,
  Calendar,
  Hammer,
  ClipboardCheck,
  Receipt,
  Check,
  ChevronRight,
  ArrowRight,
} from "lucide-react";

/**
 * All steps in the offerte-to-factuur workflow
 */
export type WorkflowStep =
  | "offerte"
  | "voorcalculatie"
  | "project"
  | "planning"
  | "uitvoering"
  | "nacalculatie"
  | "factuur";

/**
 * Step state for visual distinction
 */
type StepState = "completed" | "current" | "upcoming" | "disabled";

/**
 * Step configuration
 */
interface StepConfig {
  id: WorkflowStep;
  label: string;
  shortLabel: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

/**
 * Step with computed state and navigation
 */
interface StepWithState extends StepConfig {
  state: StepState;
  href: string | null;
  isClickable: boolean;
}

/**
 * All workflow steps configuration
 */
const WORKFLOW_STEPS: StepConfig[] = [
  {
    id: "offerte",
    label: "Offerte",
    shortLabel: "Offerte",
    description: "Offerte opstellen",
    icon: FileText,
  },
  {
    id: "voorcalculatie",
    label: "Voorcalculatie",
    shortLabel: "Voorc.",
    description: "Uren & team bepalen",
    icon: Calculator,
  },
  {
    id: "project",
    label: "Project",
    shortLabel: "Project",
    description: "Project starten",
    icon: FolderKanban,
  },
  {
    id: "planning",
    label: "Planning",
    shortLabel: "Planning",
    description: "Taken plannen",
    icon: Calendar,
  },
  {
    id: "uitvoering",
    label: "Uitvoering",
    shortLabel: "Uitv.",
    description: "Uren registreren",
    icon: Hammer,
  },
  {
    id: "nacalculatie",
    label: "Nacalculatie",
    shortLabel: "Nacalc.",
    description: "Resultaat analyseren",
    icon: ClipboardCheck,
  },
  {
    id: "factuur",
    label: "Factuur",
    shortLabel: "Factuur",
    description: "Factureren",
    icon: Receipt,
  },
];

/**
 * Step order for determining completed/upcoming states
 */
const STEP_ORDER: WorkflowStep[] = [
  "offerte",
  "voorcalculatie",
  "project",
  "planning",
  "uitvoering",
  "nacalculatie",
  "factuur",
];

/**
 * Props for WorkflowNavigation component
 */
export interface WorkflowNavigationProps {
  /** Current step in the workflow */
  currentStep: WorkflowStep;
  /** Offerte ID (required for offerte-level navigation) */
  offerteId?: string;
  /** Project ID (required for project-level navigation) */
  projectId?: string;
  /** Callback when navigating to a step */
  onNavigate?: (step: WorkflowStep) => void;
  /** Whether to show the "Next step" button */
  showNextAction?: boolean;
  /** Custom label for the next action button */
  nextActionLabel?: string;
  /** Additional CSS classes */
  className?: string;
  /** Completed steps override (for more granular control) */
  completedSteps?: WorkflowStep[];
  /** Disabled steps (cannot be navigated to) */
  disabledSteps?: WorkflowStep[];
  /** Compact mode for smaller displays */
  compact?: boolean;
}

/**
 * Get the next step in the workflow
 */
function getNextStep(currentStep: WorkflowStep): WorkflowStep | null {
  const currentIndex = STEP_ORDER.indexOf(currentStep);
  if (currentIndex === -1 || currentIndex === STEP_ORDER.length - 1) {
    return null;
  }
  return STEP_ORDER[currentIndex + 1];
}

/**
 * Get the URL for a specific step
 */
function getStepUrl(
  step: WorkflowStep,
  offerteId?: string,
  projectId?: string
): string | null {
  switch (step) {
    case "offerte":
      return offerteId ? `/offertes/${offerteId}` : null;
    case "voorcalculatie":
      return offerteId ? `/offertes/${offerteId}/voorcalculatie` : null;
    case "project":
      return projectId ? `/projecten/${projectId}` : null;
    case "planning":
      return projectId ? `/projecten/${projectId}/planning` : null;
    case "uitvoering":
      return projectId ? `/projecten/${projectId}/uitvoering` : null;
    case "nacalculatie":
      return projectId ? `/projecten/${projectId}/nacalculatie` : null;
    case "factuur":
      return projectId ? `/projecten/${projectId}/factuur` : null;
    default:
      return null;
  }
}

/**
 * Get default label for next action based on next step
 */
function getDefaultNextLabel(nextStep: WorkflowStep | null): string {
  if (!nextStep) return "Voltooid";

  const stepLabels: Record<WorkflowStep, string> = {
    offerte: "Naar Offerte",
    voorcalculatie: "Voorcalculatie invullen",
    project: "Project starten",
    planning: "Planning maken",
    uitvoering: "Naar Uitvoering",
    nacalculatie: "Nacalculatie bekijken",
    factuur: "Factuur maken",
  };

  return stepLabels[nextStep];
}

/**
 * WorkflowNavigation - Unified navigation component for the offerte-to-factuur workflow
 *
 * Features:
 * - Shows all 7 steps: Offerte -> Voorcalculatie -> Project -> Planning -> Uitvoering -> Nacalculatie -> Factuur
 * - Horizontal stepper on desktop, vertical on mobile
 * - Visual distinction between completed, current, and upcoming steps
 * - Clickable navigation to completed and current steps
 * - Optional "Next step" action button
 * - Context-aware: adapts URLs based on offerteId and projectId
 */
export const WorkflowNavigation = memo(function WorkflowNavigation({
  currentStep,
  offerteId,
  projectId,
  onNavigate,
  showNextAction = false,
  nextActionLabel,
  className,
  completedSteps: customCompletedSteps,
  disabledSteps = [],
  compact = false,
}: WorkflowNavigationProps) {
  const router = useRouter();

  // Compute step states
  const stepsWithState = useMemo((): StepWithState[] => {
    const currentIndex = STEP_ORDER.indexOf(currentStep);

    return WORKFLOW_STEPS.map((step): StepWithState => {
      const stepIndex = STEP_ORDER.indexOf(step.id);
      const isDisabled = disabledSteps.includes(step.id);
      const href = getStepUrl(step.id, offerteId, projectId);

      // Determine state
      let state: StepState;
      if (isDisabled) {
        state = "disabled";
      } else if (customCompletedSteps) {
        // Use custom completed steps if provided
        if (customCompletedSteps.includes(step.id)) {
          state = "completed";
        } else if (step.id === currentStep) {
          state = "current";
        } else {
          state = "upcoming";
        }
      } else {
        // Default: based on step order
        if (stepIndex < currentIndex) {
          state = "completed";
        } else if (stepIndex === currentIndex) {
          state = "current";
        } else {
          state = "upcoming";
        }
      }

      // Determine if clickable (completed or current, has URL, not disabled)
      const isClickable =
        !isDisabled &&
        href !== null &&
        (state === "completed" || state === "current");

      return {
        ...step,
        state,
        href,
        isClickable,
      };
    });
  }, [currentStep, offerteId, projectId, customCompletedSteps, disabledSteps]);

  // Get next step info
  const nextStep = getNextStep(currentStep);
  const nextStepUrl = nextStep
    ? getStepUrl(nextStep, offerteId, projectId)
    : null;
  const nextLabel = nextActionLabel || getDefaultNextLabel(nextStep);

  // Handle step click
  const handleStepClick = (step: StepWithState) => {
    if (!step.isClickable || !step.href) return;

    if (onNavigate) {
      onNavigate(step.id);
    } else {
      router.push(step.href);
    }
  };

  // Handle next action click
  const handleNextAction = () => {
    if (!nextStep || !nextStepUrl) return;

    if (onNavigate) {
      onNavigate(nextStep);
    } else {
      router.push(nextStepUrl);
    }
  };

  return (
    <div className={cn("w-full", className)}>
      {/* Mobile view - Vertical stepper */}
      <div className="md:hidden">
        <div className="space-y-0">
          {stepsWithState.map((step, index) => {
            const Icon = step.icon;
            const isLast = index === stepsWithState.length - 1;

            const StepContent = (
              <div className="flex items-start gap-3 py-2">
                {/* Icon */}
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all shrink-0",
                      step.state === "completed" &&
                        "bg-primary border-primary text-primary-foreground",
                      step.state === "current" &&
                        "border-primary bg-primary/10 text-primary ring-2 ring-primary/20",
                      step.state === "upcoming" &&
                        "border-muted-foreground/30 bg-muted text-muted-foreground/50",
                      step.state === "disabled" &&
                        "border-muted bg-muted/50 text-muted-foreground/30"
                    )}
                  >
                    {step.state === "completed" ? (
                      <Check className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    )}
                  </div>
                  {!isLast && (
                    <div
                      className={cn(
                        "w-0.5 flex-1 min-h-[20px] mt-1",
                        step.state === "completed"
                          ? "bg-primary"
                          : "bg-muted-foreground/20"
                      )}
                      aria-hidden="true"
                    />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pt-0.5">
                  <p
                    className={cn(
                      "font-medium text-sm truncate",
                      step.state === "completed" && "text-primary",
                      step.state === "current" && "text-primary font-semibold",
                      step.state === "upcoming" && "text-muted-foreground",
                      step.state === "disabled" && "text-muted-foreground/50"
                    )}
                  >
                    {step.label}
                  </p>
                  {!compact && (
                    <p className="text-xs text-muted-foreground truncate" title={step.description}>
                      {step.description}
                    </p>
                  )}
                </div>

                {/* Chevron for clickable steps */}
                {step.isClickable && step.state !== "current" && (
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                )}
              </div>
            );

            return (
              <div key={step.id}>
                {step.isClickable ? (
                  <Link
                    href={step.href!}
                    onClick={(e) => {
                      if (onNavigate) {
                        e.preventDefault();
                        handleStepClick(step);
                      }
                    }}
                    className={cn(
                      "block rounded-lg transition-colors",
                      "hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    )}
                    aria-current={step.state === "current" ? "step" : undefined}
                  >
                    {StepContent}
                  </Link>
                ) : (
                  <div
                    className={cn(
                      "rounded-lg",
                      step.state === "disabled" && "opacity-50"
                    )}
                    aria-current={step.state === "current" ? "step" : undefined}
                  >
                    {StepContent}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Next action button (mobile) */}
        {showNextAction && nextStep && nextStepUrl && (
          <div className="mt-4 pt-4 border-t">
            <Button
              onClick={handleNextAction}
              className="w-full"
              size="lg"
            >
              {nextLabel}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Desktop view - Horizontal stepper */}
      <div className="hidden md:block">
        <nav aria-label="Workflow voortgang">
          <ol className="flex items-start justify-between">
            {stepsWithState.map((step, index) => {
              const Icon = step.icon;
              const isLast = index === stepsWithState.length - 1;

              const StepIndicator = (
                <div className="flex flex-col items-center">
                  {/* Circle indicator */}
                  <div
                    className={cn(
                      "flex items-center justify-center rounded-full border-2 transition-all",
                      compact ? "h-8 w-8" : "h-10 w-10",
                      step.state === "completed" &&
                        "bg-primary border-primary text-primary-foreground",
                      step.state === "current" &&
                        "border-primary bg-primary/10 text-primary ring-2 ring-primary/20",
                      step.state === "upcoming" &&
                        "border-muted-foreground/30 bg-muted text-muted-foreground/50",
                      step.state === "disabled" &&
                        "border-muted bg-muted/50 text-muted-foreground/30",
                      step.isClickable &&
                        "group-hover:ring-4 group-hover:ring-primary/10 cursor-pointer"
                    )}
                  >
                    {step.state === "completed" ? (
                      <Check
                        className={cn(compact ? "h-4 w-4" : "h-5 w-5")}
                        aria-hidden="true"
                      />
                    ) : (
                      <Icon
                        className={cn(compact ? "h-4 w-4" : "h-5 w-5")}
                        aria-hidden="true"
                      />
                    )}
                  </div>

                  {/* Label */}
                  <span
                    className={cn(
                      "mt-2 text-center font-medium",
                      compact ? "text-xs" : "text-sm",
                      step.state === "completed" && "text-primary",
                      step.state === "current" && "text-primary font-semibold",
                      step.state === "upcoming" && "text-muted-foreground",
                      step.state === "disabled" && "text-muted-foreground/50"
                    )}
                  >
                    {compact ? step.shortLabel : step.label}
                  </span>

                  {/* Description (only in non-compact mode) */}
                  {!compact && (
                    <span className="text-xs text-muted-foreground text-center max-w-[100px] mt-0.5">
                      {step.description}
                    </span>
                  )}
                </div>
              );

              return (
                <li
                  key={step.id}
                  className={cn("flex items-start", !isLast && "flex-1")}
                >
                  {step.isClickable ? (
                    <Link
                      href={step.href!}
                      onClick={(e) => {
                        if (onNavigate) {
                          e.preventDefault();
                          handleStepClick(step);
                        }
                      }}
                      className={cn(
                        "group flex flex-col items-center",
                        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-lg p-2 -m-2",
                        "hover:opacity-90 transition-opacity"
                      )}
                      aria-current={
                        step.state === "current" ? "step" : undefined
                      }
                    >
                      {StepIndicator}
                      <span className="sr-only">
                        {step.state === "completed"
                          ? `${step.label} voltooid - klik om te bekijken`
                          : `Huidige stap: ${step.label}`}
                      </span>
                    </Link>
                  ) : (
                    <div
                      className={cn(
                        "flex flex-col items-center p-2 -m-2",
                        step.state === "disabled" && "opacity-50"
                      )}
                      aria-current={
                        step.state === "current" ? "step" : undefined
                      }
                    >
                      {StepIndicator}
                      <span className="sr-only">
                        {step.state === "upcoming"
                          ? `${step.label} - nog niet beschikbaar`
                          : `${step.label} - uitgeschakeld`}
                      </span>
                    </div>
                  )}

                  {/* Connector line */}
                  {!isLast && (
                    <div
                      className={cn(
                        "flex-1 h-0.5 mx-2 self-center",
                        compact ? "mt-4" : "mt-5",
                        step.state === "completed"
                          ? "bg-primary"
                          : "bg-muted-foreground/20"
                      )}
                      aria-hidden="true"
                    />
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        {/* Next action button (desktop) */}
        {showNextAction && nextStep && nextStepUrl && (
          <div className="mt-6 flex justify-end">
            <Button onClick={handleNextAction} size="lg">
              {nextLabel}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
});

/**
 * Hook to get workflow context based on current page
 */
export function useWorkflowContext(
  offerteId?: string,
  projectId?: string,
  offerteStatus?: string,
  projectStatus?: string
): {
  currentStep: WorkflowStep;
  completedSteps: WorkflowStep[];
  isOfferteLevel: boolean;
  isProjectLevel: boolean;
} {
  return useMemo(() => {
    const isOfferteLevel = !!offerteId && !projectId;
    const isProjectLevel = !!projectId;

    let currentStep: WorkflowStep = "offerte";
    const completedSteps: WorkflowStep[] = [];

    if (isOfferteLevel) {
      // Offerte-level workflow
      switch (offerteStatus) {
        case "concept":
          currentStep = "offerte";
          break;
        case "voorcalculatie":
          currentStep = "voorcalculatie";
          completedSteps.push("offerte");
          break;
        case "verzonden":
        case "geaccepteerd":
          currentStep = "voorcalculatie";
          completedSteps.push("offerte", "voorcalculatie");
          break;
        default:
          currentStep = "offerte";
      }
    } else if (isProjectLevel) {
      // Project-level workflow - offerte and voorcalculatie are always completed
      completedSteps.push("offerte", "voorcalculatie");

      switch (projectStatus) {
        case "voorcalculatie":
        case "gepland":
          currentStep = "planning";
          completedSteps.push("project");
          break;
        case "in_uitvoering":
          currentStep = "uitvoering";
          completedSteps.push("project", "planning");
          break;
        case "afgerond":
          currentStep = "nacalculatie";
          completedSteps.push("project", "planning", "uitvoering");
          break;
        case "nacalculatie_compleet":
          currentStep = "factuur";
          completedSteps.push("project", "planning", "uitvoering", "nacalculatie");
          break;
        case "gefactureerd":
          currentStep = "factuur";
          completedSteps.push(
            "project",
            "planning",
            "uitvoering",
            "nacalculatie",
            "factuur"
          );
          break;
        default:
          currentStep = "project";
      }
    }

    return {
      currentStep,
      completedSteps,
      isOfferteLevel,
      isProjectLevel,
    };
  }, [offerteId, projectId, offerteStatus, projectStatus]);
}

export default WorkflowNavigation;
