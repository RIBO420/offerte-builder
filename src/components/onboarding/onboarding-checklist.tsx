"use client";

import { useState } from "react";
import Link from "next/link";
import { REVEAL_KLASSE } from "@/components/pagina-reveal";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardAction,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronUp,
  X,
  Sparkles,
  ArrowRight,
  Rocket,
  PartyPopper,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { OnboardingStep } from "@/hooks/use-onboarding";

interface OnboardingChecklistProps {
  steps: OnboardingStep[];
  completedSteps: number;
  totalSteps: number;
  progressPercentage: number;
  isComplete: boolean;
  onDismiss: () => void;
}

export function OnboardingChecklist({
  steps,
  completedSteps,
  totalSteps,
  progressPercentage,
  isComplete,
  onDismiss,
}: OnboardingChecklistProps) {
  const [isOpen, setIsOpen] = useState(true);

  // Show completion celebration if all steps are done
  if (isComplete) {
    return (
      <div className={REVEAL_KLASSE}>
        <Card className="border-status-geaccepteerd-border bg-gradient-to-r from-status-geaccepteerd/60 to-status-geaccepteerd/25">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:duration-300">
                <PartyPopper className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-status-geaccepteerd-text">
                  Gefeliciteerd!
                </h3>
                <p className="text-sm text-status-geaccepteerd-text/90">
                  Je hebt alle stappen voltooid. Je bent klaar om te beginnen!
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onDismiss}
                className="shrink-0"
                aria-label="Sluiten"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-primary/25 bg-gradient-to-r from-accent/70 to-accent/25 overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Rocket className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base text-foreground">
                  Aan de slag
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  {completedSteps} van {totalSteps} stappen voltooid
                </CardDescription>
              </div>
            </div>
            <CardAction className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={onDismiss}
                className="h-8 w-8 text-primary hover:text-primary hover:bg-accent"
                aria-label="Verbergen"
              >
                <X className="h-4 w-4" />
              </Button>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-primary hover:text-primary hover:bg-accent"
                  aria-label={isOpen ? "Inklappen" : "Uitklappen"}
                >
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
            </CardAction>
          </div>
          <div className="mt-3">
            <Progress
              value={progressPercentage}
              className="h-2 bg-primary/15"
            />
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-4">
            <div className="space-y-2">
              {steps.map((step) => (
                  <div key={step.id} className={REVEAL_KLASSE}>
                    <Link
                      href={step.href}
                      className={cn(
                        "group flex items-center gap-3 rounded-lg p-3 transition-all",
                        step.completed
                          ? "bg-status-geaccepteerd/40"
                          : "bg-white/50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10"
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors",
                          step.completed
                            ? "bg-primary text-primary-foreground"
                            : "bg-accent text-accent-foreground group-hover:bg-primary/15"
                        )}
                      >
                        {step.completed ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <Circle className="h-4 w-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            "font-medium text-sm",
                            step.completed
                              ? "text-status-geaccepteerd-text line-through opacity-70"
                              : "text-foreground"
                          )}
                        >
                          {step.label}
                          {step.adminOnly && (
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              (admin)
                            </span>
                          )}
                        </p>
                        <p
                          className={cn(
                            "text-xs",
                            step.completed
                              ? "text-status-geaccepteerd-text/70"
                              : "text-muted-foreground"
                          )}
                        >
                          {step.description}
                        </p>
                      </div>
                      {!step.completed && (
                        <ArrowRight className="h-4 w-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </Link>
                  </div>
                ))}
            </div>

            {/* Next action suggestion */}
            {!isComplete && (
              <div className="mt-4 pt-3 border-t border-primary/20">
                {(() => {
                  const nextStep = steps.find((s) => !s.completed);
                  if (!nextStep) return null;
                  return (
                    <Link href={nextStep.href}>
                      <Button
                        variant="default"
                        size="sm"
                        className="w-full"
                      >
                        <Sparkles className="mr-2 h-4 w-4" />
                        {nextStep.label}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  );
                })()}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
