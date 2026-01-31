"use client";

import { useState, useId } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
} from "recharts";
import { TrendingUp, Calendar } from "lucide-react";

interface MonthlyData {
  maand: string;
  omzet: number;
}

interface QuarterlyData {
  kwartaal: string;
  omzet: number;
  count: number;
}

interface RevenueChartProps {
  monthlyData: MonthlyData[];
  quarterlyData: QuarterlyData[];
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Premium custom tooltip component
function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number; payload: MonthlyData | QuarterlyData }>;
  label?: string;
}) {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0];
  const isQuarterly = 'count' in data.payload;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="relative overflow-hidden rounded-xl border border-white/10 bg-card/95 backdrop-blur-xl p-4 shadow-2xl shadow-black/20"
    >
      {/* Decorative gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-transparent to-orange-500/10 pointer-events-none" />
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-orange-500" />

      <div className="relative">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600">
            <Calendar className="h-3 w-3 text-white" />
          </div>
          <p className="font-semibold text-foreground">{label}</p>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Omzet</span>
            <span className="font-bold text-lg bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
              {formatCurrency(data.value)}
            </span>
          </div>

          {isQuarterly && (
            <div className="flex items-center justify-between gap-4 pt-1 border-t border-white/10">
              <span className="text-sm text-muted-foreground">Offertes</span>
              <span className="font-medium text-foreground">
                {(data.payload as QuarterlyData).count}
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function RevenueChart({ monthlyData, quarterlyData }: RevenueChartProps) {
  const [view, setView] = useState<"maand" | "kwartaal">("maand");
  const gradientId = useId();

  const data = view === "maand" ? monthlyData : quarterlyData;
  const dataKey = view === "maand" ? "maand" : "kwartaal";

  // Calculate total for the period
  const totalOmzet = data.reduce((sum, item) => sum + item.omzet, 0);

  if (data.length === 0) {
    return (
      <Card className="relative overflow-hidden bg-card/80 backdrop-blur-sm border-white/10 dark:border-white/5">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Omzet</CardTitle>
            <CardDescription>Omzet van geaccepteerde offertes</CardDescription>
          </div>
          <Tabs value={view} onValueChange={(v) => setView(v as "maand" | "kwartaal")}>
            <TabsList>
              <TabsTrigger value="maand">Maand</TabsTrigger>
              <TabsTrigger value="kwartaal">Kwartaal</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          <div className="flex h-[300px] items-center justify-center text-muted-foreground">
            Geen omzet data beschikbaar
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="group"
    >
      <Card className="relative overflow-hidden bg-card/80 backdrop-blur-sm border-white/10 dark:border-white/5 transition-all duration-300 hover:shadow-lg hover:shadow-amber-500/10 hover:border-amber-500/20">
        {/* Decorative gradient orb */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-amber-500/20 via-orange-500/10 to-transparent rounded-full blur-3xl opacity-50 group-hover:opacity-70 transition-opacity duration-500 pointer-events-none" />

        <CardHeader className="relative flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/30">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle>Omzet</CardTitle>
              <CardDescription>
                Totaal: <span className="font-semibold text-foreground">{formatCurrency(totalOmzet)}</span>
              </CardDescription>
            </div>
          </div>
          <Tabs value={view} onValueChange={(v) => setView(v as "maand" | "kwartaal")}>
            <TabsList className="bg-muted/50 backdrop-blur-sm">
              <TabsTrigger value="maand">Maand</TabsTrigger>
              <TabsTrigger value="kwartaal">Kwartaal</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, x: view === "maand" ? -20 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: view === "maand" ? 20 : -20 }}
              transition={{ duration: 0.3 }}
            >
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id={`gradient-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgb(245, 158, 11)" stopOpacity={1} />
                      <stop offset="50%" stopColor="rgb(249, 115, 22)" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="rgb(234, 88, 12)" stopOpacity={0.7} />
                    </linearGradient>
                    <linearGradient id={`glow-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgb(245, 158, 11)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="rgb(245, 158, 11)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--muted-foreground))"
                    strokeOpacity={0.1}
                    vertical={false}
                  />
                  <XAxis
                    dataKey={dataKey}
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={{ stroke: "hsl(var(--border))", strokeOpacity: 0.5 }}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(value) => `€${(value / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    content={<CustomTooltip />}
                    cursor={{ fill: "hsl(var(--muted))", opacity: 0.3, radius: 4 }}
                  />
                  <Bar
                    dataKey="omzet"
                    name="Omzet"
                    fill={`url(#gradient-${gradientId})`}
                    radius={[6, 6, 0, 0]}
                    animationDuration={1000}
                    animationEasing="ease-out"
                  />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
}
