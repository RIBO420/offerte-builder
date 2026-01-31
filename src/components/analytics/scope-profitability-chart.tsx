"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ComposedChart,
  Line,
} from "recharts";
import { TrendingUp, DollarSign, Percent, Award } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScopeProfitabilityData {
  scope: string;
  totaal: number;
  marge: number;
  margePercentage: number;
  count: number;
  omzet?: number;
  gemiddeldPerOfferte?: number;
}

interface ScopeProfitabilityChartProps {
  data: ScopeProfitabilityData[];
  totalRevenue?: number;
}

// Scope display names in Dutch
const scopeLabels: Record<string, string> = {
  grondwerk: "Grondwerk",
  bestrating: "Bestrating",
  borders: "Borders",
  gras: "Gras",
  houtwerk: "Houtwerk",
  water_elektra: "Water & Elektra",
  specials: "Specials",
  gras_onderhoud: "Grasonderhoud",
  borders_onderhoud: "Borders Onderhoud",
  heggen: "Heggen",
  bomen: "Bomen",
  overig: "Overig",
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatCompact(amount: number): string {
  if (amount >= 1000000) return `€${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `€${(amount / 1000).toFixed(0)}k`;
  return formatCurrency(amount);
}

// Colors for revenue bars
const REVENUE_COLORS = [
  "hsl(221.2, 83.2%, 53.3%)", // Blue
  "hsl(230, 70%, 60%)",
  "hsl(240, 60%, 65%)",
  "hsl(250, 55%, 68%)",
  "hsl(260, 50%, 70%)",
  "hsl(270, 45%, 72%)",
  "hsl(280, 40%, 74%)",
  "hsl(290, 35%, 76%)",
];

// Colors based on margin percentage
function getMargeColor(percentage: number): string {
  if (percentage >= 30) return "hsl(142.1, 76.2%, 36.3%)";
  if (percentage >= 20) return "hsl(142.1, 76.2%, 46.3%)";
  if (percentage >= 10) return "hsl(45, 93%, 47%)";
  return "hsl(0, 72%, 51%)";
}

export function ScopeProfitabilityChart({ data, totalRevenue = 0 }: ScopeProfitabilityChartProps) {
  const [view, setView] = useState<"revenue" | "margin" | "combined">("combined");

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Scope Winstgevendheid
          </CardTitle>
          <CardDescription>Omzet en marge per werksoort</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[350px] items-center justify-center text-muted-foreground">
            Geen scope data beschikbaar
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map((item, index) => {
    const displayName = scopeLabels[item.scope] ?? item.scope;
    const omzet = item.omzet ?? item.totaal + item.marge;
    const revenuePercentage = totalRevenue > 0 ? Math.round((omzet / totalRevenue) * 100) : 0;

    return {
      ...item,
      displayName,
      omzet,
      revenuePercentage,
      color: REVENUE_COLORS[index % REVENUE_COLORS.length],
    };
  }).slice(0, 8); // Top 8 scopes

  // Calculate totals for summary
  const totalOmzet = chartData.reduce((sum, item) => sum + item.omzet, 0);
  const avgMargin = Math.round(chartData.reduce((sum, item) => sum + item.margePercentage, 0) / chartData.length);
  const topScope = chartData[0];

  return (
    <Card className="relative overflow-hidden">
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/30">
              <Award className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle>Scope Winstgevendheid</CardTitle>
              <CardDescription>
                Ranking op basis van omzet en marge
              </CardDescription>
            </div>
          </div>
          <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
            <TabsList>
              <TabsTrigger value="combined" className="gap-1">
                <TrendingUp className="h-3 w-3" />
                Gecombineerd
              </TabsTrigger>
              <TabsTrigger value="revenue" className="gap-1">
                <DollarSign className="h-3 w-3" />
                Omzet
              </TabsTrigger>
              <TabsTrigger value="margin" className="gap-1">
                <Percent className="h-3 w-3" />
                Marge
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
            <div className="text-xs text-muted-foreground mb-1">Totale Scope Omzet</div>
            <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
              {formatCompact(totalOmzet)}
            </div>
          </div>
          <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
            <div className="text-xs text-muted-foreground mb-1">Gem. Marge</div>
            <div className={cn(
              "text-lg font-bold",
              avgMargin >= 25 ? "text-green-600 dark:text-green-400" :
              avgMargin >= 15 ? "text-amber-600 dark:text-amber-400" :
              "text-red-600 dark:text-red-400"
            )}>
              {avgMargin}%
            </div>
          </div>
          <div className="text-center p-3 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
            <div className="text-xs text-muted-foreground mb-1">Top Scope</div>
            <div className="text-lg font-bold text-purple-600 dark:text-purple-400 truncate">
              {topScope?.displayName ?? "-"}
            </div>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={300}>
          {view === "combined" ? (
            <ComposedChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 60, left: 80, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
              <XAxis
                type="number"
                tickFormatter={(value) => formatCompact(value)}
                tick={{ fontSize: 11 }}
                className="fill-muted-foreground"
              />
              <YAxis
                type="category"
                dataKey="displayName"
                tick={{ fontSize: 11 }}
                className="fill-muted-foreground"
                width={75}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const item = payload[0].payload;
                  return (
                    <div className="rounded-lg border bg-card p-3 shadow-lg min-w-[180px]">
                      <p className="font-medium mb-2">{item.displayName}</p>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Omzet:</span>
                          <span className="font-medium">{formatCurrency(item.omzet)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Marge:</span>
                          <span className="font-medium" style={{ color: getMargeColor(item.margePercentage) }}>
                            {item.margePercentage}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Marge bedrag:</span>
                          <span className="font-medium">{formatCurrency(item.marge)}</span>
                        </div>
                        <div className="flex justify-between pt-1 border-t">
                          <span className="text-muted-foreground">Offertes:</span>
                          <span className="font-medium">{item.count}</span>
                        </div>
                      </div>
                    </div>
                  );
                }}
              />
              {/* Revenue bar */}
              <Bar dataKey="omzet" name="Omzet" radius={[0, 4, 4, 0]} barSize={20}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
              {/* Margin line */}
              <Line
                type="monotone"
                dataKey="margePercentage"
                name="Marge %"
                stroke="hsl(142.1, 76.2%, 36.3%)"
                strokeWidth={2}
                dot={{ fill: "hsl(142.1, 76.2%, 36.3%)", strokeWidth: 0, r: 4 }}
                yAxisId="margin"
              />
              <YAxis
                yAxisId="margin"
                type="number"
                orientation="right"
                domain={[0, 50]}
                tickFormatter={(v) => `${v}%`}
                tick={{ fontSize: 11 }}
                className="fill-muted-foreground"
                width={40}
              />
            </ComposedChart>
          ) : view === "revenue" ? (
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
              <XAxis
                type="number"
                tickFormatter={(value) => formatCompact(value)}
                tick={{ fontSize: 11 }}
                className="fill-muted-foreground"
              />
              <YAxis
                type="category"
                dataKey="displayName"
                tick={{ fontSize: 11 }}
                className="fill-muted-foreground"
                width={75}
              />
              <Tooltip
                formatter={(value) => [formatCurrency(value as number), "Omzet"]}
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  borderColor: "hsl(var(--border))",
                  borderRadius: "var(--radius)",
                }}
              />
              <Bar dataKey="omzet" name="Omzet" radius={[0, 6, 6, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          ) : (
            <BarChart
              data={[...chartData].sort((a, b) => b.margePercentage - a.margePercentage)}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
              <XAxis
                type="number"
                domain={[0, 50]}
                tickFormatter={(v) => `${v}%`}
                tick={{ fontSize: 11 }}
                className="fill-muted-foreground"
              />
              <YAxis
                type="category"
                dataKey="displayName"
                tick={{ fontSize: 11 }}
                className="fill-muted-foreground"
                width={75}
              />
              <Tooltip
                formatter={(value) => [`${value}%`, "Marge"]}
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  borderColor: "hsl(var(--border))",
                  borderRadius: "var(--radius)",
                }}
              />
              <Bar dataKey="margePercentage" name="Marge %" radius={[0, 6, 6, 0]}>
                {[...chartData].sort((a, b) => b.margePercentage - a.margePercentage).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getMargeColor(entry.margePercentage)} />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>

        {/* Legend */}
        <div className="mt-4 pt-4 border-t">
          <div className="flex flex-wrap gap-4 justify-center">
            {chartData.slice(0, 5).map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: item.color }} />
                <span className="text-muted-foreground">
                  {item.displayName}: {item.revenuePercentage}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
