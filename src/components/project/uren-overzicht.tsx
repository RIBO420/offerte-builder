"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Clock, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getScopeLabel,
  formatUren,
  formatDagen,
} from "@/lib/voorcalculatie-calculator";

interface UrenOverzichtProps {
  normUrenPerScope: Record<string, number>;
  normUrenTotaal: number;
  geschatteDagen?: number;
  bereikbaarheidFactor?: number;
  achterstallijkheidFactor?: number;
  showFactors?: boolean;
}

// Scope colors for visual distinction
const scopeColors: Record<string, string> = {
  grondwerk: "bg-amber-500",
  bestrating: "bg-stone-500",
  borders: "bg-green-500",
  gras: "bg-emerald-500",
  houtwerk: "bg-orange-600",
  water_elektra: "bg-blue-500",
  specials: "bg-purple-500",
  gras_onderhoud: "bg-emerald-400",
  borders_onderhoud: "bg-green-400",
  heggen: "bg-lime-500",
  bomen: "bg-teal-600",
  overig: "bg-gray-500",
};

function getScopeColor(scope: string): string {
  return scopeColors[scope] || "bg-primary";
}

interface FactorIndicatorProps {
  factor: number;
  label: string;
}

function FactorIndicator({ factor, label }: FactorIndicatorProps) {
  const isNeutral = factor === 1.0;
  const isIncrease = factor > 1.0;
  const percentage = Math.round((factor - 1) * 100);

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">{label}:</span>
      <div
        className={cn(
          "flex items-center gap-1 text-sm font-medium",
          isNeutral
            ? "text-muted-foreground"
            : isIncrease
              ? "text-orange-600"
              : "text-green-600"
        )}
      >
        {isNeutral ? (
          <Minus className="h-3 w-3" />
        ) : isIncrease ? (
          <TrendingUp className="h-3 w-3" />
        ) : (
          <TrendingDown className="h-3 w-3" />
        )}
        <span>
          {factor.toFixed(2)}x
          {!isNeutral && (
            <span className="text-xs ml-1">
              ({isIncrease ? "+" : ""}
              {percentage}%)
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

export function UrenOverzicht({
  normUrenPerScope,
  normUrenTotaal,
  geschatteDagen,
  bereikbaarheidFactor,
  achterstallijkheidFactor,
  showFactors = true,
}: UrenOverzichtProps) {
  // Sort scopes by hours (descending)
  const sortedScopes = Object.entries(normUrenPerScope)
    .filter(([, uren]) => uren > 0)
    .sort(([, a], [, b]) => b - a);

  const maxUren = Math.max(...Object.values(normUrenPerScope), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Uren Overzicht
        </CardTitle>
        <CardDescription>
          Berekende normuren per scope op basis van offerte gegevens
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Correction Factors */}
        {showFactors &&
          (bereikbaarheidFactor || achterstallijkheidFactor) && (
            <div className="rounded-lg bg-muted/50 p-4 space-y-2">
              <p className="text-sm font-medium">Toegepaste correctiefactoren</p>
              {bereikbaarheidFactor && (
                <FactorIndicator
                  factor={bereikbaarheidFactor}
                  label="Bereikbaarheid"
                />
              )}
              {achterstallijkheidFactor && achterstallijkheidFactor !== 1.0 && (
                <FactorIndicator
                  factor={achterstallijkheidFactor}
                  label="Achterstalligheid"
                />
              )}
            </div>
          )}

        {/* Scope breakdown */}
        <div className="space-y-4">
          {sortedScopes.length > 0 ? (
            sortedScopes.map(([scope, uren]) => {
              const percentage = (uren / normUrenTotaal) * 100;
              const barPercentage = (uren / maxUren) * 100;

              return (
                <div key={scope} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "h-3 w-3 rounded-full",
                          getScopeColor(scope)
                        )}
                      />
                      <span className="text-sm font-medium">
                        {getScopeLabel(scope)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold">
                        {formatUren(uren)}
                      </span>
                      <span className="text-xs text-muted-foreground ml-2">
                        ({percentage.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                  <Progress
                    value={barPercentage}
                    className="h-2"
                    // Custom color based on scope
                  />
                </div>
              );
            })
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Geen uren berekend</p>
              <p className="text-sm">
                Vul de offerte scopes in om uren te berekenen
              </p>
            </div>
          )}
        </div>

        <Separator />

        {/* Totals */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg bg-primary/10 p-4">
            <p className="text-sm font-medium text-muted-foreground">
              Totaal Normuren
            </p>
            <p className="text-3xl font-bold text-primary">
              {formatUren(normUrenTotaal)}
            </p>
          </div>
          {geschatteDagen !== undefined && (
            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm font-medium text-muted-foreground">
                Geschatte Duur
              </p>
              <p className="text-3xl font-bold">{formatDagen(geschatteDagen)}</p>
            </div>
          )}
        </div>

        {/* Scope distribution chart */}
        {sortedScopes.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              Verdeling per scope
            </p>
            <div className="flex h-4 rounded-full overflow-hidden">
              {sortedScopes.map(([scope, uren]) => {
                const percentage = (uren / normUrenTotaal) * 100;
                return (
                  <div
                    key={scope}
                    className={cn("transition-all", getScopeColor(scope))}
                    style={{ width: `${percentage}%` }}
                    title={`${getScopeLabel(scope)}: ${formatUren(uren)} (${percentage.toFixed(1)}%)`}
                  />
                );
              })}
            </div>
            <div className="flex flex-wrap gap-2">
              {sortedScopes.map(([scope]) => (
                <div key={scope} className="flex items-center gap-1 text-xs">
                  <div
                    className={cn("h-2 w-2 rounded-full", getScopeColor(scope))}
                  />
                  <span>{getScopeLabel(scope)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
