"use client";

import { useId } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Activity, Shovel, Trees } from "lucide-react";

interface TrendData {
  maand: string;
  aanleg: number;
  onderhoud: number;
  totaal: number;
  omzet: number;
}

interface OfferteTrendChartProps {
  data: TrendData[];
}

const CHART_COLORS = {
  aanleg: {
    stroke: "rgb(59, 130, 246)",
    fill: "rgba(59, 130, 246, 0.2)",
  },
  onderhoud: {
    stroke: "rgb(34, 197, 94)",
    fill: "rgba(34, 197, 94, 0.2)",
  },
};

// Custom tooltip component
function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string; color: string }>;
  label?: string;
}) {
  if (!active || !payload || !payload.length) return null;

  const aanleg = payload.find(p => p.dataKey === 'aanleg');
  const onderhoud = payload.find(p => p.dataKey === 'onderhoud');
  const totaal = (aanleg?.value || 0) + (onderhoud?.value || 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="relative overflow-hidden rounded-xl border border-white/10 bg-card/95 backdrop-blur-xl p-4 shadow-2xl shadow-black/20"
    >
      {/* Top gradient border */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-emerald-500 to-blue-500" />

      {/* Decorative gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-emerald-500/5 pointer-events-none" />

      <div className="relative">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-emerald-500">
            <Activity className="h-3 w-3 text-white" />
          </div>
          <p className="font-semibold text-foreground">{label}</p>
        </div>

        <div className="space-y-2">
          {aanleg && (
            <div className="flex items-center gap-3">
              <div className="flex h-5 w-5 items-center justify-center rounded bg-blue-500/20">
                <Shovel className="h-3 w-3 text-blue-500" />
              </div>
              <span className="text-sm text-muted-foreground flex-1">Aanleg</span>
              <span className="font-bold text-blue-500">{aanleg.value}</span>
            </div>
          )}
          {onderhoud && (
            <div className="flex items-center gap-3">
              <div className="flex h-5 w-5 items-center justify-center rounded bg-emerald-500/20">
                <Trees className="h-3 w-3 text-emerald-500" />
              </div>
              <span className="text-sm text-muted-foreground flex-1">Onderhoud</span>
              <span className="font-bold text-emerald-500">{onderhoud.value}</span>
            </div>
          )}
          <div className="flex items-center gap-3 pt-2 border-t border-white/10">
            <span className="text-sm font-medium text-muted-foreground flex-1">Totaal</span>
            <span className="font-bold text-foreground">{totaal}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Custom legend
function CustomLegend() {
  return (
    <div className="flex items-center justify-center gap-6 mt-4">
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 shadow-md shadow-blue-500/30">
          <Shovel className="h-3 w-3 text-white" />
        </div>
        <span className="text-sm font-medium text-muted-foreground">Aanleg</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 shadow-md shadow-emerald-500/30">
          <Trees className="h-3 w-3 text-white" />
        </div>
        <span className="text-sm font-medium text-muted-foreground">Onderhoud</span>
      </div>
    </div>
  );
}

export function OfferteTrendChart({ data }: OfferteTrendChartProps) {
  const gradientId = useId();

  // Calculate totals for the header
  const totaalAanleg = data.reduce((sum, item) => sum + item.aanleg, 0);
  const totaalOnderhoud = data.reduce((sum, item) => sum + item.onderhoud, 0);

  if (data.length === 0) {
    return (
      <Card className="relative overflow-hidden bg-card/80 backdrop-blur-sm border-white/10 dark:border-white/5">
        <CardHeader>
          <CardTitle>Offertes per Maand</CardTitle>
          <CardDescription>Trend van aanleg en onderhoud offertes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[300px] items-center justify-center text-muted-foreground">
            Geen data beschikbaar voor de geselecteerde periode
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
      className="group"
    >
      <Card className="relative overflow-hidden bg-card/80 backdrop-blur-sm border-white/10 dark:border-white/5 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/10 hover:border-blue-500/20">
        {/* Decorative gradient orbs */}
        <div className="absolute top-0 left-0 w-48 h-48 bg-gradient-to-br from-blue-500/20 via-transparent to-transparent rounded-full blur-3xl opacity-50 group-hover:opacity-70 transition-opacity duration-500 pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-48 h-48 bg-gradient-to-tl from-emerald-500/20 via-transparent to-transparent rounded-full blur-3xl opacity-50 group-hover:opacity-70 transition-opacity duration-500 pointer-events-none" />

        <CardHeader className="relative">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-emerald-500 shadow-lg shadow-blue-500/30">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle>Offertes per Maand</CardTitle>
              <CardDescription>
                <span className="text-blue-500 font-medium">{totaalAanleg} aanleg</span>
                {" / "}
                <span className="text-emerald-500 font-medium">{totaalOnderhoud} onderhoud</span>
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
              <defs>
                {/* Aanleg gradient */}
                <linearGradient id={`aanleg-gradient-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(59, 130, 246)" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="rgb(59, 130, 246)" stopOpacity={0} />
                </linearGradient>
                {/* Onderhoud gradient */}
                <linearGradient id={`onderhoud-gradient-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(34, 197, 94)" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="rgb(34, 197, 94)" stopOpacity={0} />
                </linearGradient>
                {/* Glow filters */}
                <filter id={`glow-blue-${gradientId}`}>
                  <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
                <filter id={`glow-green-${gradientId}`}>
                  <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--muted-foreground))"
                strokeOpacity={0.1}
                vertical={false}
              />
              <XAxis
                dataKey="maand"
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                axisLine={{ stroke: "hsl(var(--border))", strokeOpacity: 0.5 }}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ stroke: "hsl(var(--muted-foreground))", strokeOpacity: 0.2, strokeDasharray: "5 5" }}
              />
              <Legend content={<CustomLegend />} />
              <Area
                type="monotone"
                dataKey="aanleg"
                name="Aanleg"
                stroke={CHART_COLORS.aanleg.stroke}
                strokeWidth={3}
                fill={`url(#aanleg-gradient-${gradientId})`}
                dot={{ fill: CHART_COLORS.aanleg.stroke, strokeWidth: 2, r: 4, stroke: "white" }}
                activeDot={{
                  r: 8,
                  fill: CHART_COLORS.aanleg.stroke,
                  stroke: "white",
                  strokeWidth: 3,
                  filter: `url(#glow-blue-${gradientId})`
                }}
                animationDuration={1200}
                animationEasing="ease-out"
              />
              <Area
                type="monotone"
                dataKey="onderhoud"
                name="Onderhoud"
                stroke={CHART_COLORS.onderhoud.stroke}
                strokeWidth={3}
                fill={`url(#onderhoud-gradient-${gradientId})`}
                dot={{ fill: CHART_COLORS.onderhoud.stroke, strokeWidth: 2, r: 4, stroke: "white" }}
                activeDot={{
                  r: 8,
                  fill: CHART_COLORS.onderhoud.stroke,
                  stroke: "white",
                  strokeWidth: 3,
                  filter: `url(#glow-green-${gradientId})`
                }}
                animationDuration={1400}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </motion.div>
  );
}
