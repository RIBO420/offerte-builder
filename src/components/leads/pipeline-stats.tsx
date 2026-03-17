"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Users, TrendingUp, Trophy, Percent } from "lucide-react";

// ============================================
// Formatters
// ============================================

const currencyFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const percentFormatter = new Intl.NumberFormat("nl-NL", {
  style: "percent",
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

// ============================================
// Stat item config
// ============================================

interface StatItem {
  label: string;
  icon: React.ElementType;
  format: (value: number) => string;
  key: "totaalLeads" | "pipelineWaarde" | "gewonnenWaarde" | "conversieRatio";
}

const stats: StatItem[] = [
  {
    label: "Actieve leads",
    icon: Users,
    format: (v) => String(v),
    key: "totaalLeads",
  },
  {
    label: "Pipeline waarde",
    icon: TrendingUp,
    format: (v) => currencyFormatter.format(v),
    key: "pipelineWaarde",
  },
  {
    label: "Gewonnen deze maand",
    icon: Trophy,
    format: (v) => currencyFormatter.format(v),
    key: "gewonnenWaarde",
  },
  {
    label: "Conversieratio",
    icon: Percent,
    format: (v) => percentFormatter.format(v),
    key: "conversieRatio",
  },
];

// ============================================
// PipelineStats component
// ============================================

export function PipelineStats() {
  const data = useQuery(api.configuratorAanvragen.pipelineStats);

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        const value = data?.[stat.key];

        return (
          <Card key={stat.key} className="rounded-xl">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Icon className="size-5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">
                  {stat.label}
                </p>
                <p className="text-lg font-semibold tabular-nums">
                  {value != null ? stat.format(value) : "-"}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
