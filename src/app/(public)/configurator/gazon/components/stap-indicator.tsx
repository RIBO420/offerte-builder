"use client";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { STAP_LABELS, TOTAAL_STAPPEN } from "./types";

interface StapIndicatorProps {
  huidigStap: number;
}

export function StapIndicator({ huidigStap }: StapIndicatorProps) {
  const voortgang = (huidigStap / TOTAAL_STAPPEN) * 100;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-muted-foreground">
          Stap {huidigStap} van {TOTAAL_STAPPEN}
        </span>
        <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50">
          {STAP_LABELS[huidigStap - 1]}
        </Badge>
      </div>
      <Progress value={voortgang} className="h-2 [&>div]:bg-green-600" />
      <div className="flex justify-between mt-3">
        {STAP_LABELS.map((label, index) => {
          const stapNummer = index + 1;
          const isActief = stapNummer === huidigStap;
          const isKlaar = stapNummer < huidigStap;
          return (
            <div
              key={label}
              className={cn(
                "flex flex-col items-center gap-1",
                "hidden sm:flex"
              )}
            >
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold border-2 transition-colors",
                  isKlaar
                    ? "bg-green-600 border-green-600 text-white"
                    : isActief
                    ? "border-green-600 text-green-700 bg-white"
                    : "border-gray-200 text-gray-400 bg-white"
                )}
              >
                {isKlaar ? <CheckCircle2 className="h-4 w-4" /> : stapNummer}
              </div>
              <span
                className={cn(
                  "text-xs text-center",
                  isActief ? "text-green-700 font-medium" : "text-muted-foreground"
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
