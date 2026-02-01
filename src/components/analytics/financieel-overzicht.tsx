"use client";

import { useId, memo, useMemo } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Euro,
  TrendingUp,
  TrendingDown,
  Wallet,
  PiggyBank,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  BarChart3,
} from "lucide-react";

interface KostenCategorie {
  naam: string;
  bedrag: number;
  percentage: number;
  color: string;
}

interface MaandelijkseData {
  maand: string;
  omzet: number;
  kosten: number;
  winst: number;
  marge: number;
}

interface FinancieelOverzichtProps {
  kostenBreakdown: KostenCategorie[];
  maandelijksOverzicht: MaandelijkseData[];
  totaleOmzet?: number;
  previousTotaleOmzet?: number;
  totaleKosten?: number;
  previousTotaleKosten?: number;
  winstmarge?: number;
  previousWinstmarge?: number;
  nettoWinst?: number;
  previousNettoWinst?: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatCompactCurrency(amount: number): string {
  if (Math.abs(amount) >= 1000000) {
    return `€${(amount / 1000000).toFixed(1)}M`;
  }
  if (Math.abs(amount) >= 1000) {
    return `€${(amount / 1000).toFixed(0)}k`;
  }
  return formatCurrency(amount);
}

// Default colors for cost categories
const defaultColors = [
  "#10b981", // emerald-500
  "#3b82f6", // blue-500
  "#f59e0b", // amber-500
  "#8b5cf6", // violet-500
  "#ec4899", // pink-500
  "#06b6d4", // cyan-500
  "#84cc16", // lime-500
  "#f97316", // orange-500
];

// Custom tooltip for pie chart
function PieTooltip({ active, payload }: {
  active?: boolean;
  payload?: Array<{ payload: KostenCategorie; value: number }>;
}) {
  if (!active || !payload || !payload.length) return null;

  const item = payload[0].payload;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative overflow-hidden rounded-xl border border-white/10 bg-card/95 backdrop-blur-xl p-4 shadow-2xl shadow-black/20 min-w-[160px]"
    >
      <div
        className="absolute top-0 left-0 w-full h-1"
        style={{ backgroundColor: item.color }}
      />
      <div className="relative">
        <p className="font-semibold text-foreground mb-2">{item.naam}</p>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Bedrag</span>
            <span className="font-bold text-foreground">{formatCurrency(item.bedrag)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Percentage</span>
            <span className="font-bold" style={{ color: item.color }}>{item.percentage.toFixed(1)}%</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Custom tooltip for bar chart
function BarTooltip({ active, payload }: {
  active?: boolean;
  payload?: Array<{ payload: MaandelijkseData; dataKey: string; value: number }>;
}) {
  if (!active || !payload || !payload.length) return null;

  const item = payload[0].payload;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative overflow-hidden rounded-xl border border-white/10 bg-card/95 backdrop-blur-xl p-4 shadow-2xl shadow-black/20 min-w-[180px]"
    >
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-blue-500" />
      <div className="relative">
        <p className="font-semibold text-foreground mb-3">{item.maand}</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Omzet</span>
            <span className="font-medium text-emerald-500">{formatCurrency(item.omzet)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Kosten</span>
            <span className="font-medium text-red-400">{formatCurrency(item.kosten)}</span>
          </div>
          <div className="flex items-center justify-between gap-4 pt-2 border-t border-white/10">
            <span className="text-sm text-muted-foreground">Winst</span>
            <span className={`font-bold ${item.winst >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {formatCurrency(item.winst)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Marge</span>
            <span className={`font-bold ${item.marge >= 20 ? 'text-emerald-500' : item.marge >= 10 ? 'text-amber-500' : 'text-red-500'}`}>
              {item.marge.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Financial KPI Card
function FinancialKpiCard({
  title,
  value,
  previousValue,
  prefix = "€",
  suffix = "",
  icon: Icon,
  gradient,
  iconGradient,
  delay = 0,
  isPercentage = false,
  positiveIsGood = true,
}: {
  title: string;
  value: number;
  previousValue?: number;
  prefix?: string;
  suffix?: string;
  icon: typeof Euro;
  gradient: string;
  iconGradient: string;
  delay?: number;
  isPercentage?: boolean;
  positiveIsGood?: boolean;
}) {
  const change = previousValue !== undefined
    ? ((value - previousValue) / Math.abs(previousValue || 1)) * 100
    : undefined;

  const isPositiveChange = change !== undefined ? (positiveIsGood ? change >= 0 : change <= 0) : true;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="group"
    >
      <Card className="relative overflow-hidden bg-card/80 backdrop-blur-sm border-white/10 dark:border-white/5 transition-all duration-300 hover:shadow-lg">
        <div className={`absolute inset-0 bg-gradient-to-br ${gradient} pointer-events-none`} />
        <CardContent className="p-5 relative">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              <div className="flex items-baseline gap-1">
                {!isPercentage && prefix && <span className="text-lg text-muted-foreground">{prefix}</span>}
                <span className="text-3xl font-bold text-foreground">
                  <AnimatedNumber
                    value={isPercentage ? value : Math.abs(value)}
                    duration={1200}
                    formatOptions={isPercentage ? { minimumFractionDigits: 1, maximumFractionDigits: 1 } : { minimumFractionDigits: 0, maximumFractionDigits: 0 }}
                  />
                </span>
                {suffix && <span className="text-lg text-muted-foreground">{suffix}</span>}
              </div>
              {change !== undefined && (
                <div className={`flex items-center gap-1 text-xs ${isPositiveChange ? 'text-emerald-500' : 'text-red-500'}`}>
                  {isPositiveChange ? (
                    <ArrowUpRight className="h-3 w-3" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3" />
                  )}
                  {change >= 0 ? '+' : ''}{change.toFixed(1)}% vs vorige periode
                </div>
              )}
            </div>
            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${iconGradient} shadow-lg`}>
              <Icon className="h-6 w-6 text-white" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export const FinancieelOverzicht = memo(function FinancieelOverzicht({
  kostenBreakdown,
  maandelijksOverzicht,
  totaleOmzet = 125000,
  previousTotaleOmzet,
  totaleKosten = 87500,
  previousTotaleKosten,
  winstmarge = 30,
  previousWinstmarge,
  nettoWinst = 37500,
  previousNettoWinst,
}: FinancieelOverzichtProps) {
  const gradientId = useId();

  // Add colors to breakdown if not provided
  const coloredBreakdown = useMemo(() =>
    kostenBreakdown.map((item, index) => ({
      ...item,
      color: item.color || defaultColors[index % defaultColors.length],
    })),
    [kostenBreakdown]
  );

  // Calculate totals from breakdown
  const totalKostenFromBreakdown = coloredBreakdown.reduce((sum, item) => sum + item.bedrag, 0);

  if (kostenBreakdown.length === 0 && maandelijksOverzicht.length === 0) {
    return (
      <div className="space-y-4">
        {/* KPI Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FinancialKpiCard
            title="Totale Omzet"
            value={totaleOmzet}
            previousValue={previousTotaleOmzet}
            icon={Euro}
            gradient="from-emerald-500/5 via-transparent to-green-500/5"
            iconGradient="from-emerald-500 to-green-600"
          />
          <FinancialKpiCard
            title="Totale Kosten"
            value={totaleKosten}
            previousValue={previousTotaleKosten}
            icon={Receipt}
            gradient="from-red-500/5 via-transparent to-rose-500/5"
            iconGradient="from-red-500 to-rose-600"
            delay={0.1}
            positiveIsGood={false}
          />
          <FinancialKpiCard
            title="Winstmarge"
            value={winstmarge}
            previousValue={previousWinstmarge}
            prefix=""
            suffix="%"
            icon={Percent}
            gradient="from-blue-500/5 via-transparent to-cyan-500/5"
            iconGradient="from-blue-500 to-cyan-600"
            delay={0.2}
            isPercentage
          />
          <FinancialKpiCard
            title="Netto Winst"
            value={nettoWinst}
            previousValue={previousNettoWinst}
            icon={PiggyBank}
            gradient="from-amber-500/5 via-transparent to-orange-500/5"
            iconGradient="from-amber-500 to-orange-600"
            delay={0.3}
          />
        </div>

        <Card className="relative overflow-hidden bg-card/80 backdrop-blur-sm border-white/10 dark:border-white/5">
          <CardHeader>
            <CardTitle>Financieel Overzicht</CardTitle>
            <CardDescription>Kosten breakdown en maandelijks overzicht</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-[200px] items-center justify-center text-muted-foreground">
              Geen financiele data beschikbaar
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FinancialKpiCard
          title="Totale Omzet"
          value={totaleOmzet}
          previousValue={previousTotaleOmzet}
          icon={Euro}
          gradient="from-emerald-500/5 via-transparent to-green-500/5"
          iconGradient="from-emerald-500 to-green-600"
        />
        <FinancialKpiCard
          title="Totale Kosten"
          value={totaleKosten}
          previousValue={previousTotaleKosten}
          icon={Receipt}
          gradient="from-red-500/5 via-transparent to-rose-500/5"
          iconGradient="from-red-500 to-rose-600"
          delay={0.1}
          positiveIsGood={false}
        />
        <FinancialKpiCard
          title="Winstmarge"
          value={winstmarge}
          previousValue={previousWinstmarge}
          prefix=""
          suffix="%"
          icon={Percent}
          gradient="from-blue-500/5 via-transparent to-cyan-500/5"
          iconGradient="from-blue-500 to-cyan-600"
          delay={0.2}
          isPercentage
        />
        <FinancialKpiCard
          title="Netto Winst"
          value={nettoWinst}
          previousValue={previousNettoWinst}
          icon={PiggyBank}
          gradient="from-amber-500/5 via-transparent to-orange-500/5"
          iconGradient="from-amber-500 to-orange-600"
          delay={0.3}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Cost Breakdown Pie Chart */}
        {coloredBreakdown.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="group"
          >
            <Card className="relative overflow-hidden bg-card/80 backdrop-blur-sm border-white/10 dark:border-white/5 transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/10">
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-emerald-500/10 via-green-500/5 to-transparent rounded-full blur-3xl opacity-50 group-hover:opacity-70 transition-opacity duration-500 pointer-events-none" />

              <CardHeader className="relative">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 shadow-lg shadow-emerald-500/30">
                    <Wallet className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle>Kosten Breakdown</CardTitle>
                    <CardDescription>
                      Totaal: <span className="font-semibold text-foreground">{formatCurrency(totalKostenFromBreakdown)}</span>
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={coloredBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="bedrag"
                      animationDuration={1000}
                      animationEasing="ease-out"
                    >
                      {coloredBreakdown.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.color}
                          stroke="transparent"
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                    <Legend
                      formatter={(value, entry) => (
                        <span className="text-sm text-foreground">{value}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>

                {/* Cost breakdown list */}
                <div className="mt-4 space-y-2">
                  {coloredBreakdown.map((item, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-sm text-muted-foreground">{item.naam}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium">{formatCurrency(item.bedrag)}</span>
                        <Badge variant="secondary" className="text-xs">
                          {item.percentage.toFixed(0)}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Monthly Overview Bar Chart */}
        {maandelijksOverzicht.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="group"
          >
            <Card className="relative overflow-hidden bg-card/80 backdrop-blur-sm border-white/10 dark:border-white/5 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/10">
              <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-blue-500/10 via-cyan-500/5 to-transparent rounded-full blur-3xl opacity-50 group-hover:opacity-70 transition-opacity duration-500 pointer-events-none" />

              <CardHeader className="relative">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 shadow-lg shadow-blue-500/30">
                    <BarChart3 className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle>Maandelijks Overzicht</CardTitle>
                    <CardDescription>Omzet vs kosten per maand</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart
                    data={maandelijksOverzicht}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient id={`omzet-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgb(34, 197, 94)" stopOpacity={1} />
                        <stop offset="100%" stopColor="rgb(22, 163, 74)" stopOpacity={0.8} />
                      </linearGradient>
                      <linearGradient id={`kosten-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgb(239, 68, 68)" stopOpacity={0.7} />
                        <stop offset="100%" stopColor="rgb(220, 38, 38)" stopOpacity={0.5} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--muted-foreground))"
                      strokeOpacity={0.1}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="maand"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={{ stroke: "hsl(var(--border))", strokeOpacity: 0.5 }}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={(value) => formatCompactCurrency(value)}
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<BarTooltip />} />
                    <Legend
                      wrapperStyle={{ paddingTop: 20 }}
                      formatter={(value) => (
                        <span className="text-sm text-foreground">{value}</span>
                      )}
                    />
                    <Bar
                      dataKey="omzet"
                      name="Omzet"
                      fill={`url(#omzet-${gradientId})`}
                      radius={[4, 4, 0, 0]}
                      animationDuration={1000}
                    />
                    <Bar
                      dataKey="kosten"
                      name="Kosten"
                      fill={`url(#kosten-${gradientId})`}
                      radius={[4, 4, 0, 0]}
                      animationDuration={1000}
                      animationBegin={200}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>

      {/* Monthly Summary Table */}
      {maandelijksOverzicht.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
          className="group"
        >
          <Card className="relative overflow-hidden bg-card/80 backdrop-blur-sm border-white/10 dark:border-white/5">
            <CardHeader>
              <CardTitle>Maandelijkse Samenvatting</CardTitle>
              <CardDescription>Gedetailleerd overzicht per maand</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10">
                    <TableHead>Maand</TableHead>
                    <TableHead className="text-right">Omzet</TableHead>
                    <TableHead className="text-right">Kosten</TableHead>
                    <TableHead className="text-right">Winst</TableHead>
                    <TableHead className="text-right">Marge</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {maandelijksOverzicht.map((maand, index) => (
                    <TableRow
                      key={maand.maand}
                      className="border-white/5 transition-colors hover:bg-white/5 animate-in fade-in slide-in-from-left-2"
                      style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}
                    >
                      <TableCell className="font-medium">{maand.maand}</TableCell>
                      <TableCell className="text-right text-emerald-500 font-medium">
                        {formatCurrency(maand.omzet)}
                      </TableCell>
                      <TableCell className="text-right text-red-400">
                        {formatCurrency(maand.kosten)}
                      </TableCell>
                      <TableCell className={`text-right font-bold ${maand.winst >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {formatCurrency(maand.winst)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant="secondary"
                          className={`${
                            maand.marge >= 25
                              ? 'bg-emerald-500/10 text-emerald-500'
                              : maand.marge >= 15
                              ? 'bg-green-500/10 text-green-500'
                              : maand.marge >= 10
                              ? 'bg-amber-500/10 text-amber-500'
                              : 'bg-red-500/10 text-red-500'
                          }`}
                        >
                          {maand.marge.toFixed(1)}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Totals Row */}
                  <TableRow className="border-white/10 bg-muted/30 font-semibold">
                    <TableCell>Totaal</TableCell>
                    <TableCell className="text-right text-emerald-500">
                      {formatCurrency(maandelijksOverzicht.reduce((sum, m) => sum + m.omzet, 0))}
                    </TableCell>
                    <TableCell className="text-right text-red-400">
                      {formatCurrency(maandelijksOverzicht.reduce((sum, m) => sum + m.kosten, 0))}
                    </TableCell>
                    <TableCell className="text-right text-emerald-500">
                      {formatCurrency(maandelijksOverzicht.reduce((sum, m) => sum + m.winst, 0))}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary" className="bg-blue-500/10 text-blue-500">
                        {(
                          (maandelijksOverzicht.reduce((sum, m) => sum + m.winst, 0) /
                           maandelijksOverzicht.reduce((sum, m) => sum + m.omzet, 0)) *
                          100
                        ).toFixed(1)}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
});
