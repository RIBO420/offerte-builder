"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDown, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PipelineFunnelData {
  concept: number;
  definitief: number;
  verzonden: number;
  afgehandeld: number;
  geaccepteerd: number;
}

interface ConversionRates {
  conceptToDefinitief: number;
  definitiefToVerzonden: number;
  verzondenToAfgehandeld: number;
  afgehandeldToWon: number;
  overallConversion: number;
}

interface PipelineFunnelChartProps {
  data?: PipelineFunnelData;
  conversionRates?: ConversionRates;
}

const stageLabels = {
  concept: "Concept",
  definitief: "Definitief",
  verzonden: "Verzonden",
  afgehandeld: "Afgehandeld",
  geaccepteerd: "Gewonnen",
};

const stageColors = {
  concept: "bg-slate-100 dark:bg-slate-800",
  definitief: "bg-blue-100 dark:bg-blue-900/50",
  verzonden: "bg-amber-100 dark:bg-amber-900/50",
  afgehandeld: "bg-purple-100 dark:bg-purple-900/50",
  geaccepteerd: "bg-green-100 dark:bg-green-900/50",
};

const stageTextColors = {
  concept: "text-slate-700 dark:text-slate-300",
  definitief: "text-blue-700 dark:text-blue-300",
  verzonden: "text-amber-700 dark:text-amber-300",
  afgehandeld: "text-purple-700 dark:text-purple-300",
  geaccepteerd: "text-green-700 dark:text-green-300",
};

function ConversionArrow({ rate, label }: { rate: number; label: string }) {
  const isLow = rate < 50;
  const isGood = rate >= 75;

  return (
    <div className="flex flex-col items-center py-1">
      <ArrowDown className="h-4 w-4 text-muted-foreground" />
      <div className="flex items-center gap-1 text-xs">
        <span
          className={cn(
            "font-semibold",
            isLow && "text-red-600 dark:text-red-400",
            isGood && "text-green-600 dark:text-green-400",
            !isLow && !isGood && "text-amber-600 dark:text-amber-400"
          )}
        >
          {rate}%
        </span>
        {isLow && <AlertTriangle className="h-3 w-3 text-red-500" />}
        {isGood && <CheckCircle2 className="h-3 w-3 text-green-500" />}
      </div>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}

export function PipelineFunnelChart({ data, conversionRates }: PipelineFunnelChartProps) {
  if (!data || !conversionRates) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Sales Pipeline
          </CardTitle>
          <CardDescription>Conversie door het sales proces</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[300px] items-center justify-center text-muted-foreground">
            Geen pipeline data beschikbaar
          </div>
        </CardContent>
      </Card>
    );
  }

  const stages: (keyof PipelineFunnelData)[] = ["concept", "definitief", "verzonden", "afgehandeld", "geaccepteerd"];
  const maxValue = Math.max(...Object.values(data));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Sales Pipeline
            </CardTitle>
            <CardDescription>Conversie door het sales proces</CardDescription>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-green-600">
              {conversionRates.overallConversion}%
            </div>
            <div className="text-xs text-muted-foreground">Totale conversie</div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {stages.map((stage, index) => {
            const value = data[stage];
            const widthPercentage = maxValue > 0 ? (value / maxValue) * 100 : 0;

            return (
              <div key={stage}>
                <div className="flex items-center gap-3">
                  <div className="w-24 text-sm font-medium">
                    {stageLabels[stage]}
                  </div>
                  <div className="flex-1">
                    <div
                      className={cn(
                        "h-10 rounded-md flex items-center px-3 transition-all",
                        stageColors[stage]
                      )}
                      style={{ width: `${Math.max(widthPercentage, 15)}%` }}
                    >
                      <span className={cn("font-semibold", stageTextColors[stage])}>
                        {value}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Conversion arrow between stages */}
                {index === 0 && (
                  <div className="ml-12 pl-3">
                    <ConversionArrow rate={conversionRates.conceptToDefinitief} label="naar definitief" />
                  </div>
                )}
                {index === 1 && (
                  <div className="ml-12 pl-3">
                    <ConversionArrow rate={conversionRates.definitiefToVerzonden} label="naar verzonden" />
                  </div>
                )}
                {index === 2 && (
                  <div className="ml-12 pl-3">
                    <ConversionArrow rate={conversionRates.verzondenToAfgehandeld} label="naar afgehandeld" />
                  </div>
                )}
                {index === 3 && (
                  <div className="ml-12 pl-3">
                    <ConversionArrow rate={conversionRates.afgehandeldToWon} label="win rate" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Insights section */}
        <div className="mt-4 pt-4 border-t">
          <h4 className="text-sm font-medium mb-2">Inzichten</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {conversionRates.conceptToDefinitief < 50 && (
              <div className="flex items-start gap-1 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span>Veel concepten worden niet afgerond</span>
              </div>
            )}
            {conversionRates.definitiefToVerzonden < 70 && (
              <div className="flex items-start gap-1 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span>Offertes blijven liggen na definitief</span>
              </div>
            )}
            {conversionRates.afgehandeldToWon >= 60 && (
              <div className="flex items-start gap-1 text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span>Sterke win rate bij verzonden offertes</span>
              </div>
            )}
            {conversionRates.overallConversion < 20 && (
              <div className="flex items-start gap-1 text-red-600 dark:text-red-400">
                <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span>Lage totale conversie - check bottlenecks</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
