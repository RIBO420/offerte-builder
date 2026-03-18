"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Target,
  CheckCircle,
  AlertTriangle,
  Lightbulb,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ProgressIndicatorProps {
  urenTotaal: number;
  begroteUren: number;
  verschilUren: number;
  progressPercentage: number;
  actualProgressPercentage: number;
  isOverBudget: boolean;
  isNearBudget: boolean;
}

export function ProgressIndicator({
  urenTotaal,
  begroteUren,
  verschilUren,
  progressPercentage,
  actualProgressPercentage,
  isOverBudget,
  isNearBudget,
}: ProgressIndicatorProps) {
  return (
    <Card className={cn(
      "border-2 transition-colors",
      isOverBudget ? "border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20" :
      isNearBudget ? "border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20" :
      "border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20"
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Voortgang t.o.v. Begroting
          </CardTitle>
          <Badge
            variant={isOverBudget ? "destructive" : isNearBudget ? "secondary" : "default"}
            className={cn(
              !isOverBudget && !isNearBudget && "bg-green-600"
            )}
          >
            {actualProgressPercentage.toFixed(0)}%
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Progress
            value={progressPercentage}
            className={cn(
              "h-3",
              isOverBudget ? "[&>div]:bg-red-500" :
              isNearBudget ? "[&>div]:bg-amber-500" :
              "[&>div]:bg-green-500"
            )}
          />
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {urenTotaal.toFixed(1)} van {begroteUren.toFixed(1)} uur
            </span>
            <span className={cn(
              "font-medium",
              isOverBudget ? "text-red-600" :
              isNearBudget ? "text-amber-600" :
              "text-green-600"
            )}>
              {verschilUren >= 0 ? "+" : ""}{verschilUren.toFixed(1)} uur
            </span>
          </div>
        </div>

        {/* Status message */}
        <div className={cn(
          "flex items-start gap-2 rounded-lg p-3",
          isOverBudget ? "bg-red-100 dark:bg-red-950/50" :
          isNearBudget ? "bg-amber-100 dark:bg-amber-950/50" :
          "bg-green-100 dark:bg-green-950/50"
        )}>
          {isOverBudget ? (
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          ) : isNearBudget ? (
            <Lightbulb className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
          )}
          <div className="text-sm">
            {isOverBudget ? (
              <>
                <span className="font-medium text-red-700 dark:text-red-400">Budget overschreden.</span>
                <span className="text-red-600 dark:text-red-300 ml-1">
                  Let op: er zijn {Math.abs(verschilUren).toFixed(1)} uur meer gewerkt dan begroot.
                </span>
              </>
            ) : isNearBudget ? (
              <>
                <span className="font-medium text-amber-700 dark:text-amber-400">Bijna bij budget.</span>
                <span className="text-amber-600 dark:text-amber-300 ml-1">
                  Nog {Math.abs(verschilUren).toFixed(1)} uur beschikbaar binnen begroting.
                </span>
              </>
            ) : (
              <>
                <span className="font-medium text-green-700 dark:text-green-400">Op schema.</span>
                <span className="text-green-600 dark:text-green-300 ml-1">
                  Nog {Math.abs(verschilUren).toFixed(1)} uur beschikbaar binnen begroting.
                </span>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
