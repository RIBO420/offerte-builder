"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  getScopeDisplayName,
  getScopeColor,
} from "@/lib/planning-templates";
import type { PlanningSummary } from "@/hooks/use-planning";
import { cn } from "@/lib/utils";
import { Clock, Calendar, CheckCircle2, ListTodo } from "lucide-react";

interface PlanningOverzichtProps {
  summary: PlanningSummary | null;
  isLoading?: boolean;
}

function StatCard({
  icon: Icon,
  label,
  value,
  subValue,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subValue?: string;
}) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 min-w-0">
      <div className="flex-shrink-0 p-1.5 rounded-md bg-background">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-lg font-bold tabular-nums truncate" title={String(value)}>{value}</p>
        <p className="text-xs text-muted-foreground truncate" title={label}>{label}</p>
        {subValue && (
          <p className="text-xs text-muted-foreground truncate" title={subValue}>{subValue}</p>
        )}
      </div>
    </div>
  );
}

function ScopeBar({
  scope,
  dagen,
  totaalDagen,
  voortgang,
}: {
  scope: string;
  dagen: number;
  totaalDagen: number;
  voortgang: number;
}) {
  const percentage = totaalDagen > 0 ? (dagen / totaalDagen) * 100 : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "w-3 h-3 rounded-full",
              getScopeColor(scope)
            )}
          />
          <span className="font-medium">{getScopeDisplayName(scope)}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="tabular-nums">{dagen.toFixed(1)} dagen</span>
          <span className="text-xs">({percentage.toFixed(0)}%)</span>
        </div>
      </div>
      <div className="h-8 bg-muted rounded-md overflow-hidden relative">
        {/* Background bar showing total allocation */}
        <div
          className={cn(
            "absolute inset-y-0 left-0 transition-all duration-300",
            getScopeColor(scope),
            "opacity-30"
          )}
          style={{ width: `${percentage}%` }}
        />
        {/* Foreground bar showing progress within scope */}
        <div
          className={cn(
            "absolute inset-y-0 left-0 transition-all duration-300",
            getScopeColor(scope)
          )}
          style={{ width: `${(percentage * voortgang) / 100}%` }}
        />
        {/* Progress text */}
        <div className="absolute inset-0 flex items-center px-3">
          <span className="text-xs font-medium text-white drop-shadow-sm">
            {voortgang}% voltooid
          </span>
        </div>
      </div>
    </div>
  );
}

export function PlanningOverzicht({
  summary,
  isLoading,
}: PlanningOverzichtProps) {
  if (isLoading || !summary) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Planning Overzicht</CardTitle>
          <CardDescription>
            Laden...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-20 bg-muted rounded-lg" />
            <div className="h-32 bg-muted rounded-lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const scopes = Object.keys(summary.perScope);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListTodo className="h-5 w-5" />
          Planning Overzicht
        </CardTitle>
        <CardDescription>
          Visueel overzicht van de projectfasen en voortgang
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-2">
          <StatCard
            icon={Clock}
            label="Totaal Uren"
            value={summary.totaalUren.toFixed(1)}
          />
          <StatCard
            icon={Calendar}
            label="Totaal Dagen"
            value={summary.totaalDagen.toFixed(1)}
          />
          <StatCard
            icon={ListTodo}
            label="Taken"
            value={`${summary.afgerondTaken}/${summary.totaalTaken}`}
            subValue={`${summary.gestartTaken} in uitvoering`}
          />
          <StatCard
            icon={CheckCircle2}
            label="Voortgang"
            value={`${summary.voortgang}%`}
          />
        </div>

        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Totale Voortgang</span>
            <span className="text-muted-foreground">{summary.voortgang}%</span>
          </div>
          <Progress value={summary.voortgang} className="h-3" />
        </div>

        {/* Scope Bars (Gantt-like visualization) */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-muted-foreground">
            Verdeling per Scope
          </h4>
          {scopes.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              Geen scopes gevonden
            </p>
          ) : (
            <div className="space-y-4">
              {scopes.map((scope) => {
                const scopeData = summary.perScope[scope];
                const voortgang =
                  scopeData.taken > 0
                    ? Math.round((scopeData.afgerond / scopeData.taken) * 100)
                    : 0;

                return (
                  <ScopeBar
                    key={scope}
                    scope={scope}
                    dagen={scopeData.dagen}
                    totaalDagen={summary.totaalDagen}
                    voortgang={voortgang}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Scope Details Table */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">
            Details per Scope
          </h4>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Scope</th>
                  <th className="text-right p-3 font-medium">Uren</th>
                  <th className="text-right p-3 font-medium">Dagen</th>
                  <th className="text-right p-3 font-medium">Taken</th>
                  <th className="text-right p-3 font-medium">Voltooid</th>
                </tr>
              </thead>
              <tbody>
                {scopes.map((scope) => {
                  const scopeData = summary.perScope[scope];
                  const voortgang =
                    scopeData.taken > 0
                      ? Math.round((scopeData.afgerond / scopeData.taken) * 100)
                      : 0;

                  return (
                    <tr key={scope} className="border-t">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              "w-2 h-2 rounded-full",
                              getScopeColor(scope)
                            )}
                          />
                          {getScopeDisplayName(scope)}
                        </div>
                      </td>
                      <td className="text-right p-3 tabular-nums">
                        {scopeData.uren.toFixed(1)}
                      </td>
                      <td className="text-right p-3 tabular-nums">
                        {scopeData.dagen.toFixed(1)}
                      </td>
                      <td className="text-right p-3 tabular-nums">
                        {scopeData.afgerond}/{scopeData.taken}
                      </td>
                      <td className="text-right p-3 tabular-nums">
                        <span
                          className={cn(
                            voortgang === 100 && "text-green-600 font-medium"
                          )}
                        >
                          {voortgang}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-muted/30 font-medium">
                <tr className="border-t">
                  <td className="p-3">Totaal</td>
                  <td className="text-right p-3 tabular-nums">
                    {summary.totaalUren.toFixed(1)}
                  </td>
                  <td className="text-right p-3 tabular-nums">
                    {summary.totaalDagen.toFixed(1)}
                  </td>
                  <td className="text-right p-3 tabular-nums">
                    {summary.afgerondTaken}/{summary.totaalTaken}
                  </td>
                  <td className="text-right p-3 tabular-nums">
                    {summary.voortgang}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
