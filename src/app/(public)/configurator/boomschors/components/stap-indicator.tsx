import { CheckCircle2Icon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

interface StepIndicatorProps {
  huidigeStap: number;
  totaalStappen: number;
  stapLabels: string[];
}

export function StapIndicator({
  huidigeStap,
  totaalStappen,
  stapLabels,
}: StepIndicatorProps) {
  const voortgang = ((huidigeStap - 1) / (totaalStappen - 1)) * 100;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">
          Stap {huidigeStap} van {totaalStappen}
        </span>
        <span className="text-muted-foreground">{stapLabels[huidigeStap - 1]}</span>
      </div>
      <Progress value={voortgang} className="h-2" />
      <div className="hidden sm:flex justify-between">
        {stapLabels.map((label, index) => {
          const stapNummer = index + 1;
          const isVoltooid = stapNummer < huidigeStap;
          const isActief = stapNummer === huidigeStap;
          return (
            <div key={label} className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex items-center justify-center size-7 rounded-full text-xs font-semibold border-2 transition-colors",
                  isVoltooid &&
                    "bg-primary border-primary text-primary-foreground",
                  isActief && "bg-background border-primary text-primary",
                  !isVoltooid &&
                    !isActief &&
                    "bg-background border-muted-foreground/30 text-muted-foreground"
                )}
              >
                {isVoltooid ? (
                  <CheckCircle2Icon className="size-4" />
                ) : (
                  stapNummer
                )}
              </div>
              <span
                className={cn(
                  "text-xs",
                  isActief ? "text-foreground font-medium" : "text-muted-foreground"
                )}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
