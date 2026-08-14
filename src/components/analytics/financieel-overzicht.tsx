"use client";

import { useId, memo, useMemo } from "react";
import { m } from "framer-motion";
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
import {
  Euro,
  Wallet,
  PiggyBank,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  BarChart3,
} from "lucide-react";
import { formatCurrency, formatCurrencyCompact } from "@/lib/format";

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

// Helper to format currency without decimals
function formatCurrencyNoDecimals(amount: number): string {
  return formatCurrency(amount, "nl-NL", false);
}

// Default colors for cost categories - using CSS custom properties for theme support
const defaultColors = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-5))",
  "hsl(var(--chart-1) / 0.7)",
  "hsl(var(--chart-2) / 0.7)",
  "hsl(var(--chart-4) / 0.7)",
];

// Custom tooltip for pie chart
function PieTooltip({ active, payload }: {
  active?: boolean;
  payload?: Array<{ payload: KostenCategorie; value: number }>;
}) {
  if (!active || !payload || !payload.length) return null;

  const item = payload[0].payload;

  return (
    <m.div
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
            <span className="font-bold text-foreground">{formatCurrencyNoDecimals(item.bedrag)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Percentage</span>
            <span className="font-bold" style={{ color: item.color }}>{item.percentage.toFixed(1)}%</span>
          </div>
        </div>
      </div>
    </m.div>
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
    <m.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative overflow-hidden rounded-xl border border-white/10 bg-card/95 backdrop-blur-xl p-4 shadow-2xl shadow-black/20 min-w-[180px]"
    >
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-chart-1 to-chart-3" />
      <div className="relative">
        <p className="font-semibold text-foreground mb-3">{item.maand}</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Omzet</span>
            <span className="font-medium text-trend-positive">{formatCurrencyNoDecimals(item.omzet)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Kosten</span>
            <span className="font-medium text-trend-negative">{formatCurrencyNoDecimals(item.kosten)}</span>
          </div>
          <div className="flex items-center justify-between gap-4 pt-2 border-t border-white/10">
            <span className="text-sm text-muted-foreground">Winst</span>
            <span className={`font-bold ${item.winst >= 0 ? 'text-trend-positive' : 'text-trend-negative'}`}>
              {formatCurrencyNoDecimals(item.winst)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Marge</span>
            <span className={`font-bold ${item.marge >= 20 ? 'text-trend-positive' : item.marge >= 10 ? 'text-status-verzonden-dot' : 'text-trend-negative'}`}>
              {item.marge.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    </m.div>
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
    <m.div
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
                <div className={`flex items-center gap-1 text-xs ${isPositiveChange ? 'text-trend-positive' : 'text-trend-negative'}`}>
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
    </m.div>
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
            gradient="from-chart-1/5 via-transparent to-primary/5"
            iconGradient="from-chart-1 to-primary"
          />
          <FinancialKpiCard
            title="Totale Kosten"
            value={totaleKosten}
            previousValue={previousTotaleKosten}
            icon={Receipt}
            gradient="from-destructive/5 via-transparent to-destructive/5"
            iconGradient="from-destructive to-destructive"
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
            gradient="from-chart-3/5 via-transparent to-chart-5/5"
            iconGradient="from-chart-3 to-chart-5"
            delay={0.2}
            isPercentage
          />
          <FinancialKpiCard
            title="Netto Winst"
            value={nettoWinst}
            previousValue={previousNettoWinst}
            icon={PiggyBank}
            gradient="from-chart-4/5 via-transparent to-accent-warm/5"
            iconGradient="from-chart-4 to-accent-warm"
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
          gradient="from-chart-1/5 via-transparent to-primary/5"
          iconGradient="from-chart-1 to-primary"
        />
        <FinancialKpiCard
          title="Totale Kosten"
          value={totaleKosten}
          previousValue={previousTotaleKosten}
          icon={Receipt}
          gradient="from-destructive/5 via-transparent to-destructive/5"
          iconGradient="from-destructive to-destructive"
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
          gradient="from-chart-3/5 via-transparent to-chart-5/5"
          iconGradient="from-chart-3 to-chart-5"
          delay={0.2}
          isPercentage
        />
        <FinancialKpiCard
          title="Netto Winst"
          value={nettoWinst}
          previousValue={previousNettoWinst}
          icon={PiggyBank}
          gradient="from-chart-4/5 via-transparent to-accent-warm/5"
          iconGradient="from-chart-4 to-accent-warm"
          delay={0.3}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Cost Breakdown Pie Chart */}
        {coloredBreakdown.length > 0 && (
          <m.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="group"
          >
            <Card className="relative overflow-hidden bg-card/80 backdrop-blur-sm border-white/10 dark:border-white/5 transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/10">
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-chart-1/10 via-chart-1/5 to-transparent rounded-full blur-3xl opacity-50 group-hover:opacity-70 transition-opacity duration-500 pointer-events-none" />

              <CardHeader className="relative">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-chart-1 to-primary shadow-lg shadow-emerald-500/30">
                    <Wallet className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle>Kosten Breakdown</CardTitle>
                    <CardDescription>
                      Totaal: <span className="font-semibold text-foreground">{formatCurrencyNoDecimals(totalKostenFromBreakdown)}</span>
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
                      formatter={(value) => (
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
                        <span className="text-sm font-medium">{formatCurrencyNoDecimals(item.bedrag)}</span>
                        <Badge variant="secondary" className="text-xs">
                          {item.percentage.toFixed(0)}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </m.div>
        )}

        {/* Monthly Overview Bar Chart */}
        {maandelijksOverzicht.length > 0 && (
          <m.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="group"
          >
            <Card className="relative overflow-hidden bg-card/80 backdrop-blur-sm border-white/10 dark:border-white/5 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/10">
              <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-chart-3/10 via-chart-5/5 to-transparent rounded-full blur-3xl opacity-50 group-hover:opacity-70 transition-opacity duration-500 pointer-events-none" />

              <CardHeader className="relative">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-chart-3 to-chart-5 shadow-lg shadow-blue-500/30">
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
                        <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={1} />
                        <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0.7} />
                      </linearGradient>
                      <linearGradient id={`kosten-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--chart-5))" stopOpacity={0.7} />
                        <stop offset="100%" stopColor="hsl(var(--chart-5))" stopOpacity={0.4} />
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
                      tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={{ stroke: "hsl(var(--border))", strokeOpacity: 0.5 }}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={(value) => formatCurrencyCompact(value)}
                      tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
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
          </m.div>
        )}
      </div>

      {/* Monthly Summary Table */}
      {maandelijksOverzicht.length > 0 && (
        <m.div
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
                      <TableCell className="text-right text-trend-positive font-medium">
                        {formatCurrencyNoDecimals(maand.omzet)}
                      </TableCell>
                      <TableCell className="text-right text-trend-negative">
                        {formatCurrencyNoDecimals(maand.kosten)}
                      </TableCell>
                      <TableCell className={`text-right font-bold ${maand.winst >= 0 ? 'text-trend-positive' : 'text-trend-negative'}`}>
                        {formatCurrencyNoDecimals(maand.winst)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant="secondary"
                          className={`${
                            maand.marge >= 25
                              ? 'bg-trend-positive/10 text-trend-positive'
                              : maand.marge >= 15
                              ? 'bg-trend-positive/10 text-trend-positive'
                              : maand.marge >= 10
                              ? 'bg-status-verzonden-dot/10 text-status-verzonden-dot'
                              : 'bg-trend-negative/10 text-trend-negative'
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
                    <TableCell className="text-right text-trend-positive">
                      {formatCurrencyNoDecimals(maandelijksOverzicht.reduce((sum, m) => sum + m.omzet, 0))}
                    </TableCell>
                    <TableCell className="text-right text-trend-negative">
                      {formatCurrencyNoDecimals(maandelijksOverzicht.reduce((sum, m) => sum + m.kosten, 0))}
                    </TableCell>
                    <TableCell className="text-right text-trend-positive">
                      {formatCurrencyNoDecimals(maandelijksOverzicht.reduce((sum, m) => sum + m.winst, 0))}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary" className="bg-chart-3/10 text-chart-3">
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
        </m.div>
      )}
    </div>
  );
});
