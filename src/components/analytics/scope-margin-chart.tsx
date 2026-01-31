"use client";

import { useId, memo } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { PieChart, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface ScopeMargeData {
  scope: string;
  totaal: number;
  marge: number;
  margePercentage: number;
  count: number;
}

interface ScopeMarginChartProps {
  data: ScopeMargeData[];
}

// Scope display names in Dutch
const scopeLabels: Record<string, string> = {
  grondwerk: "Grondwerk",
  bestrating: "Bestrating",
  beplanting: "Beplanting",
  grasveld: "Grasveld",
  schutting: "Schutting",
  vijver: "Vijver",
  verlichting: "Verlichting",
  irrigatie: "Irrigatie",
  snoeiwerk: "Snoeiwerk",
  onkruid: "Onkruidbestrijding",
  bemesting: "Bemesting",
  gazon: "Gazononderhoud",
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Color scale based on margin percentage
function getMargeColor(percentage: number): { color: string; gradient: string } {
  if (percentage >= 30) return {
    color: "rgb(34, 197, 94)",
    gradient: "from-emerald-500 to-green-500"
  };
  if (percentage >= 20) return {
    color: "rgb(74, 222, 128)",
    gradient: "from-green-400 to-emerald-400"
  };
  if (percentage >= 10) return {
    color: "rgb(245, 158, 11)",
    gradient: "from-amber-500 to-orange-500"
  };
  return {
    color: "rgb(239, 68, 68)",
    gradient: "from-red-500 to-rose-500"
  };
}

function getMargeIcon(percentage: number) {
  if (percentage >= 20) return <TrendingUp className="h-3 w-3 text-emerald-500" />;
  if (percentage >= 10) return <Minus className="h-3 w-3 text-amber-500" />;
  return <TrendingDown className="h-3 w-3 text-red-500" />;
}

// Custom tooltip component
function CustomTooltip({ active, payload }: {
  active?: boolean;
  payload?: Array<{ payload: ScopeMargeData & { displayName: string } }>;
}) {
  if (!active || !payload || !payload.length) return null;

  const item = payload[0].payload;
  const colors = getMargeColor(item.margePercentage);

  return (
    <motion.div
      initial={{ opacity: 0, x: -10, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      className="relative overflow-hidden rounded-xl border border-white/10 bg-card/95 backdrop-blur-xl p-4 shadow-2xl shadow-black/20 min-w-[200px]"
    >
      {/* Colored top border */}
      <div
        className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${colors.gradient}`}
      />

      <div className="relative">
        <div className="flex items-center justify-between gap-4 mb-3">
          <p className="font-semibold text-foreground">{item.displayName}</p>
          {getMargeIcon(item.margePercentage)}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Marge</span>
            <span
              className="font-bold text-lg"
              style={{ color: colors.color }}
            >
              {item.margePercentage}%
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Totaal</span>
            <span className="font-medium text-foreground">
              {formatCurrency(item.totaal)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4 pt-2 border-t border-white/10">
            <span className="text-sm text-muted-foreground">Offertes</span>
            <span className="font-medium text-foreground">{item.count}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export const ScopeMarginChart = memo(function ScopeMarginChart({ data }: ScopeMarginChartProps) {
  const gradientId = useId();

  if (data.length === 0) {
    return (
      <Card className="relative overflow-hidden bg-card/80 backdrop-blur-sm border-white/10 dark:border-white/5">
        <CardHeader>
          <CardTitle>Marge per Scope</CardTitle>
          <CardDescription>Gemiddelde marge percentage per werksoort</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[300px] items-center justify-center text-muted-foreground">
            Geen scope data beschikbaar
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map((item) => ({
    ...item,
    displayName: scopeLabels[item.scope] ?? item.scope,
  }));

  // Calculate average margin
  const avgMargin = Math.round(
    chartData.reduce((sum, item) => sum + item.margePercentage, 0) / chartData.length
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="group"
    >
      <Card className="relative overflow-hidden bg-card/80 backdrop-blur-sm border-white/10 dark:border-white/5 transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/10 hover:border-emerald-500/20">
        {/* Decorative gradient orb */}
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-emerald-500/20 via-green-500/10 to-transparent rounded-full blur-3xl opacity-50 group-hover:opacity-70 transition-opacity duration-500 pointer-events-none" />

        <CardHeader className="relative">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 shadow-lg shadow-emerald-500/30">
              <PieChart className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle>Marge per Scope</CardTitle>
              <CardDescription>
                Gemiddeld: <span className={`font-semibold ${avgMargin >= 20 ? 'text-emerald-500' : avgMargin >= 10 ? 'text-amber-500' : 'text-red-500'}`}>{avgMargin}%</span>
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
            >
              <defs>
                {/* Create gradients for each color tier */}
                <linearGradient id={`gradient-high-${gradientId}`} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="rgb(34, 197, 94)" stopOpacity={1} />
                  <stop offset="100%" stopColor="rgb(16, 185, 129)" stopOpacity={0.8} />
                </linearGradient>
                <linearGradient id={`gradient-medium-${gradientId}`} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="rgb(74, 222, 128)" stopOpacity={1} />
                  <stop offset="100%" stopColor="rgb(52, 211, 153)" stopOpacity={0.8} />
                </linearGradient>
                <linearGradient id={`gradient-low-${gradientId}`} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="rgb(245, 158, 11)" stopOpacity={1} />
                  <stop offset="100%" stopColor="rgb(251, 191, 36)" stopOpacity={0.8} />
                </linearGradient>
                <linearGradient id={`gradient-critical-${gradientId}`} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="rgb(239, 68, 68)" stopOpacity={1} />
                  <stop offset="100%" stopColor="rgb(248, 113, 113)" stopOpacity={0.8} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--muted-foreground))"
                strokeOpacity={0.1}
                horizontal={false}
              />
              <XAxis
                type="number"
                domain={[0, 50]}
                tickFormatter={(value) => `${value}%`}
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                axisLine={{ stroke: "hsl(var(--border))", strokeOpacity: 0.5 }}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="displayName"
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                width={75}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: "hsl(var(--muted))", opacity: 0.3, radius: 4 }}
              />
              <Bar
                dataKey="margePercentage"
                name="Marge %"
                radius={[0, 6, 6, 0]}
                animationDuration={1000}
                animationEasing="ease-out"
              >
                {chartData.map((entry, index) => {
                  const gradientKey = entry.margePercentage >= 30
                    ? `gradient-high-${gradientId}`
                    : entry.margePercentage >= 20
                      ? `gradient-medium-${gradientId}`
                      : entry.margePercentage >= 10
                        ? `gradient-low-${gradientId}`
                        : `gradient-critical-${gradientId}`;
                  return (
                    <Cell
                      key={`cell-${index}`}
                      fill={`url(#${gradientKey})`}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </motion.div>
  );
});