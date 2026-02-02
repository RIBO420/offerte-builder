"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
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
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
      >
        <Card className="border-emerald-200 dark:border-emerald-900/50 bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.2 }}
                className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500 text-white"
              >
                <PartyPopper className="h-6 w-6" />
              </motion.div>
              <div className="flex-1">
                <h3 className="font-semibold text-emerald-900 dark:text-emerald-100">
                  Gefeliciteerd!
                </h3>
                <p className="text-sm text-emerald-700 dark:text-emerald-300">
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
      </motion.div>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-blue-200 dark:border-blue-900/50 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500 text-white">
                <Rocket className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base text-blue-900 dark:text-blue-100">
                  Aan de slag
                </CardTitle>
                <CardDescription className="text-blue-700 dark:text-blue-300">
                  {completedSteps} van {totalSteps} stappen voltooid
                </CardDescription>
              </div>
            </div>
            <CardAction className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={onDismiss}
                className="h-8 w-8 text-blue-600 hover:text-blue-800 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-900/30"
                aria-label="Verbergen"
              >
                <X className="h-4 w-4" />
              </Button>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-blue-600 hover:text-blue-800 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-900/30"
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
              className="h-2 bg-blue-200 dark:bg-blue-900/50"
            />
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-4">
            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {steps.map((step, index) => (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Link
                      href={step.href}
                      className={cn(
                        "group flex items-center gap-3 rounded-lg p-3 transition-all",
                        step.completed
                          ? "bg-emerald-100/50 dark:bg-emerald-900/20"
                          : "bg-white/50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10"
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors",
                          step.completed
                            ? "bg-emerald-500 text-white"
                            : "bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 group-hover:bg-blue-200 dark:group-hover:bg-blue-800/50"
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
                              ? "text-emerald-800 dark:text-emerald-200 line-through opacity-70"
                              : "text-blue-900 dark:text-blue-100"
                          )}
                        >
                          {step.label}
                          {step.adminOnly && (
                            <span className="ml-2 text-xs font-normal text-blue-500 dark:text-blue-400">
                              (admin)
                            </span>
                          )}
                        </p>
                        <p
                          className={cn(
                            "text-xs",
                            step.completed
                              ? "text-emerald-600/70 dark:text-emerald-400/70"
                              : "text-blue-600 dark:text-blue-400"
                          )}
                        >
                          {step.description}
                        </p>
                      </div>
                      {!step.completed && (
                        <ArrowRight className="h-4 w-4 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </Link>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Next action suggestion */}
            {!isComplete && (
              <div className="mt-4 pt-3 border-t border-blue-200/50 dark:border-blue-800/50">
                {(() => {
                  const nextStep = steps.find((s) => !s.completed);
                  if (!nextStep) return null;
                  return (
                    <Link href={nextStep.href}>
                      <Button
                        variant="default"
                        size="sm"
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
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
