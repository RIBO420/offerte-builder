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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
  ReferenceLine,
} from "recharts";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Calculator, TrendingUp, TrendingDown, Target, CheckCircle2, AlertTriangle, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface ScopeCalculatieData {
  scope: string;
  voorcalculatie: number;
  nacalculatie: number;
  variance: number;
  variancePercentage: number;
  projectCount: number;
}

interface CalculatieVergelijkingProps {
  data: ScopeCalculatieData[];
  accuracyScore?: number;
  previousAccuracyScore?: number;
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
  arbeid: "Arbeid",
  materiaal: "Materiaal",
  transport: "Transport",
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getVarianceColor(percentage: number): string {
  const absPercentage = Math.abs(percentage);
  if (absPercentage <= 5) return "text-emerald-500";
  if (absPercentage <= 10) return "text-green-500";
  if (absPercentage <= 20) return "text-amber-500";
  return "text-red-500";
}

function getVarianceIcon(percentage: number) {
  const absPercentage = Math.abs(percentage);
  if (absPercentage <= 10) return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (absPercentage <= 20) return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  return <AlertTriangle className="h-4 w-4 text-red-500" />;
}

function getAccuracyLevel(score: number): { label: string; color: string; bgColor: string } {
  if (score >= 90) return { label: "Uitstekend", color: "text-emerald-500", bgColor: "bg-emerald-500/10" };
  if (score >= 75) return { label: "Goed", color: "text-green-500", bgColor: "bg-green-500/10" };
  if (score >= 60) return { label: "Redelijk", color: "text-amber-500", bgColor: "bg-amber-500/10" };
  return { label: "Verbetering nodig", color: "text-red-500", bgColor: "bg-red-500/10" };
}

// Custom tooltip for the chart
function CustomTooltip({ active, payload }: {
  active?: boolean;
  payload?: Array<{ payload: ScopeCalculatieData & { displayName: string }; dataKey: string; value: number; fill: string }>;
}) {
  if (!active || !payload || !payload.length) return null;

  const item = payload[0].payload;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      className="relative overflow-hidden rounded-xl border border-white/10 bg-card/95 backdrop-blur-xl p-4 shadow-2xl shadow-black/20 min-w-[220px]"
    >
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-cyan-500" />

      <div className="relative">
        <p className="font-semibold text-foreground mb-3">{item.displayName}</p>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Voorcalculatie</span>
            <span className="font-medium text-blue-500">{formatCurrency(item.voorcalculatie)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Nacalculatie</span>
            <span className="font-medium text-emerald-500">{formatCurrency(item.nacalculatie)}</span>
          </div>
          <div className="flex items-center justify-between gap-4 pt-2 border-t border-white/10">
            <span className="text-sm text-muted-foreground">Verschil</span>
            <span className={`font-bold ${getVarianceColor(item.variancePercentage)}`}>
              {item.variancePercentage > 0 ? "+" : ""}{item.variancePercentage.toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Projecten</span>
            <span className="font-medium text-foreground">{item.projectCount}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Accuracy Score Display Component
function AccuracyScoreDisplay({
  score,
  previousScore,
}: {
  score: number;
  previousScore?: number;
}) {
  const level = getAccuracyLevel(score);
  const change = previousScore !== undefined ? score - previousScore : undefined;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="relative overflow-hidden"
    >
      <Card className="relative overflow-hidden bg-card/80 backdrop-blur-sm border-white/10 dark:border-white/5">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-cyan-500/5 pointer-events-none" />

        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Calculatie Nauwkeurigheid</p>
              <div className="flex items-center gap-3">
                <span className="text-4xl font-bold bg-gradient-to-r from-blue-500 to-cyan-500 bg-clip-text text-transparent">
                  <AnimatedNumber
                    value={score}
                    duration={1200}
                    formatOptions={{ minimumFractionDigits: 0, maximumFractionDigits: 0 }}
                  />%
                </span>
                <Badge className={`${level.bgColor} ${level.color} border-0`}>
                  {level.label}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                % projecten binnen 10% van voorcalculatie
              </p>
            </div>

            <div className="flex flex-col items-end gap-2">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 shadow-lg shadow-blue-500/30">
                <Target className="h-7 w-7 text-white" />
              </div>

              {change !== undefined && (
                <div className={`flex items-center gap-1 text-sm ${change >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {change >= 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  <span>{change >= 0 ? '+' : ''}{change.toFixed(1)}%</span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4">
            <Progress value={score} className="h-2" />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export const CalculatieVergelijking = memo(function CalculatieVergelijking({
  data,
  accuracyScore = 78,
  previousAccuracyScore,
}: CalculatieVergelijkingProps) {
  const gradientId = useId();

  const chartData = useMemo(() =>
    data.map((item) => ({
      ...item,
      displayName: scopeLabels[item.scope] ?? item.scope,
    })),
    [data]
  );

  // Calculate summary statistics
  const totalVoorcalculatie = data.reduce((sum, item) => sum + item.voorcalculatie, 0);
  const totalNacalculatie = data.reduce((sum, item) => sum + item.nacalculatie, 0);
  const totalVariance = totalNacalculatie - totalVoorcalculatie;
  const totalVariancePercentage = totalVoorcalculatie > 0
    ? ((totalNacalculatie - totalVoorcalculatie) / totalVoorcalculatie) * 100
    : 0;

  if (data.length === 0) {
    return (
      <div className="space-y-4">
        <AccuracyScoreDisplay score={accuracyScore} previousScore={previousAccuracyScore} />
        <Card className="relative overflow-hidden bg-card/80 backdrop-blur-sm border-white/10 dark:border-white/5">
          <CardHeader>
            <CardTitle>Calculatie Vergelijking</CardTitle>
            <CardDescription>Voorcalculatie vs Nacalculatie per scope</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-[300px] items-center justify-center text-muted-foreground">
              Geen calculatie data beschikbaar
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Accuracy Score Card */}
      <AccuracyScoreDisplay score={accuracyScore} previousScore={previousAccuracyScore} />

      {/* Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="group"
      >
        <Card className="relative overflow-hidden bg-card/80 backdrop-blur-sm border-white/10 dark:border-white/5 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/10 hover:border-blue-500/20">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-blue-500/10 via-cyan-500/5 to-transparent rounded-full blur-3xl opacity-50 group-hover:opacity-70 transition-opacity duration-500 pointer-events-none" />

          <CardHeader className="relative">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 shadow-lg shadow-blue-500/30">
                <Calculator className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <CardTitle>Voorcalculatie vs Nacalculatie</CardTitle>
                <CardDescription>
                  Totaal verschil:{" "}
                  <span className={`font-semibold ${getVarianceColor(totalVariancePercentage)}`}>
                    {totalVariancePercentage > 0 ? "+" : ""}{totalVariancePercentage.toFixed(1)}%
                  </span>
                  {" "}({formatCurrency(totalVariance)})
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <defs>
                  <linearGradient id={`voorcalc-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgb(59, 130, 246)" stopOpacity={1} />
                    <stop offset="100%" stopColor="rgb(37, 99, 235)" stopOpacity={0.8} />
                  </linearGradient>
                  <linearGradient id={`nacalc-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgb(34, 197, 94)" stopOpacity={1} />
                    <stop offset="100%" stopColor="rgb(22, 163, 74)" stopOpacity={0.8} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--muted-foreground))"
                  strokeOpacity={0.1}
                  vertical={false}
                />
                <XAxis
                  dataKey="displayName"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={{ stroke: "hsl(var(--border))", strokeOpacity: 0.5 }}
                  tickLine={false}
                  angle={-45}
                  textAnchor="end"
                  height={70}
                />
                <YAxis
                  tickFormatter={(value) => `€${(value / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ paddingTop: 20 }}
                  formatter={(value) => (
                    <span className="text-sm text-foreground">{value}</span>
                  )}
                />
                <Bar
                  dataKey="voorcalculatie"
                  name="Voorcalculatie"
                  fill={`url(#voorcalc-${gradientId})`}
                  radius={[4, 4, 0, 0]}
                  animationDuration={1000}
                />
                <Bar
                  dataKey="nacalculatie"
                  name="Nacalculatie"
                  fill={`url(#nacalc-${gradientId})`}
                  radius={[4, 4, 0, 0]}
                  animationDuration={1000}
                  animationBegin={200}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>

      {/* Breakdown Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="group"
      >
        <Card className="relative overflow-hidden bg-card/80 backdrop-blur-sm border-white/10 dark:border-white/5 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/10 hover:border-cyan-500/20">
          <CardHeader className="relative">
            <CardTitle>Scope Breakdown</CardTitle>
            <CardDescription>Gedetailleerde variantie per werksoort</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-white/10">
                  <TableHead>Scope</TableHead>
                  <TableHead className="text-right">Voorcalculatie</TableHead>
                  <TableHead className="text-right">Nacalculatie</TableHead>
                  <TableHead className="text-right">Variantie</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {chartData.map((item, index) => (
                  <TableRow
                    key={item.scope}
                    className="border-white/5 transition-colors hover:bg-white/5 animate-in fade-in slide-in-from-left-2"
                    style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}
                  >
                    <TableCell className="font-medium">{item.displayName}</TableCell>
                    <TableCell className="text-right text-blue-500">
                      {formatCurrency(item.voorcalculatie)}
                    </TableCell>
                    <TableCell className="text-right text-emerald-500">
                      {formatCurrency(item.nacalculatie)}
                    </TableCell>
                    <TableCell className={`text-right font-semibold ${getVarianceColor(item.variancePercentage)}`}>
                      {item.variancePercentage > 0 ? "+" : ""}{item.variancePercentage.toFixed(1)}%
                      <span className="block text-xs text-muted-foreground font-normal">
                        {formatCurrency(item.variance)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {getVarianceIcon(item.variancePercentage)}
                    </TableCell>
                  </TableRow>
                ))}
                {/* Total Row */}
                <TableRow className="border-white/10 bg-muted/30 font-semibold">
                  <TableCell>Totaal</TableCell>
                  <TableCell className="text-right text-blue-500">
                    {formatCurrency(totalVoorcalculatie)}
                  </TableCell>
                  <TableCell className="text-right text-emerald-500">
                    {formatCurrency(totalNacalculatie)}
                  </TableCell>
                  <TableCell className={`text-right ${getVarianceColor(totalVariancePercentage)}`}>
                    {totalVariancePercentage > 0 ? "+" : ""}{totalVariancePercentage.toFixed(1)}%
                    <span className="block text-xs text-muted-foreground font-normal">
                      {formatCurrency(totalVariance)}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    {getVarianceIcon(totalVariancePercentage)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
});
