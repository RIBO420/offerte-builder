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
} from "recharts";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Users, Clock, Briefcase, TrendingUp, TrendingDown, Award, Zap, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface MedewerkerData {
  id: string;
  naam: string;
  uren: number;
  declarabeleUren: number;
  projecten: number;
  efficiëntieRatio: number;
  gemiddeldeUrenPerProject: number;
  previousEfficiëntie?: number;
}

interface MedewerkerProductiviteitProps {
  data: MedewerkerData[];
  totaalUren?: number;
  previousPeriodTotaalUren?: number;
}

function getEfficiencyColor(ratio: number): { color: string; bgColor: string; gradient: string } {
  if (ratio >= 90) return { color: "text-emerald-500", bgColor: "bg-emerald-500", gradient: "from-emerald-500 to-green-500" };
  if (ratio >= 75) return { color: "text-green-500", bgColor: "bg-green-500", gradient: "from-green-500 to-lime-500" };
  if (ratio >= 60) return { color: "text-amber-500", bgColor: "bg-amber-500", gradient: "from-amber-500 to-orange-500" };
  return { color: "text-red-500", bgColor: "bg-red-500", gradient: "from-red-500 to-rose-500" };
}

function getEfficiencyLabel(ratio: number): string {
  if (ratio >= 90) return "Uitstekend";
  if (ratio >= 75) return "Goed";
  if (ratio >= 60) return "Gemiddeld";
  return "Te verbeteren";
}

// Custom tooltip for the bar chart
function CustomTooltip({ active, payload }: {
  active?: boolean;
  payload?: Array<{ payload: MedewerkerData; dataKey: string; value: number; fill: string }>;
}) {
  if (!active || !payload || !payload.length) return null;

  const item = payload[0].payload;
  const colors = getEfficiencyColor(item.efficiëntieRatio);

  return (
    <motion.div
      initial={{ opacity: 0, x: -10, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      className="relative overflow-hidden rounded-xl border border-white/10 bg-card/95 backdrop-blur-xl p-4 shadow-2xl shadow-black/20 min-w-[200px]"
    >
      <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${colors.gradient}`} />

      <div className="relative">
        <div className="flex items-center justify-between gap-4 mb-3">
          <p className="font-semibold text-foreground">{item.naam}</p>
          <Badge variant="secondary" className={`${colors.color} border-0`}>
            {item.efficiëntieRatio}%
          </Badge>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Totaal uren</span>
            <span className="font-medium text-foreground">{item.uren.toFixed(1)}u</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Declarabel</span>
            <span className="font-medium text-emerald-500">{item.declarabeleUren.toFixed(1)}u</span>
          </div>
          <div className="flex items-center justify-between gap-4 pt-2 border-t border-white/10">
            <span className="text-sm text-muted-foreground">Projecten</span>
            <span className="font-medium text-foreground">{item.projecten}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Gem. uren/project</span>
            <span className="font-medium text-foreground">{item.gemiddeldeUrenPerProject.toFixed(1)}u</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Employee rank badge
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ duration: 0.5, type: "spring", delay: 0.1 }}
        className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 shadow-lg shadow-amber-500/40"
      >
        <Award className="h-3.5 w-3.5 text-white" />
      </motion.div>
    );
  }
  if (rank === 2) {
    return (
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ duration: 0.5, type: "spring", delay: 0.15 }}
        className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-slate-300 to-slate-400 shadow-lg shadow-slate-500/30"
      >
        <Star className="h-3.5 w-3.5 text-white" />
      </motion.div>
    );
  }
  if (rank === 3) {
    return (
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ duration: 0.5, type: "spring", delay: 0.2 }}
        className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-amber-600 to-orange-700 shadow-lg shadow-orange-500/30"
      >
        <Zap className="h-3.5 w-3.5 text-white" />
      </motion.div>
    );
  }
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, delay: 0.1 + rank * 0.05 }}
      className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground text-sm font-medium"
    >
      {rank}
    </motion.div>
  );
}

export const MedewerkerProductiviteit = memo(function MedewerkerProductiviteit({
  data,
  totaalUren = 0,
  previousPeriodTotaalUren,
}: MedewerkerProductiviteitProps) {
  const gradientId = useId();

  // Sort by efficiency for ranking
  const sortedData = useMemo(() =>
    [...data].sort((a, b) => b.efficiëntieRatio - a.efficiëntieRatio),
    [data]
  );

  // Calculate summary statistics
  const gemiddeldeEfficiëntie = data.length > 0
    ? data.reduce((sum, item) => sum + item.efficiëntieRatio, 0) / data.length
    : 0;

  const totalDeclarabeleUren = data.reduce((sum, item) => sum + item.declarabeleUren, 0);
  const totalProjecten = data.reduce((sum, item) => sum + item.projecten, 0);

  const urenChange = previousPeriodTotaalUren !== undefined
    ? ((totaalUren - previousPeriodTotaalUren) / previousPeriodTotaalUren) * 100
    : undefined;

  if (data.length === 0) {
    return (
      <Card className="relative overflow-hidden bg-card/80 backdrop-blur-sm border-white/10 dark:border-white/5">
        <CardHeader>
          <CardTitle>Medewerker Productiviteit</CardTitle>
          <CardDescription>Uren en efficiëntie per medewerker</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[300px] items-center justify-center text-muted-foreground">
            Geen medewerker data beschikbaar
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Total Hours Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Card className="relative overflow-hidden bg-card/80 backdrop-blur-sm border-white/10 dark:border-white/5">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-cyan-500/5 pointer-events-none" />
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Totaal Uren</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-blue-500">
                      <AnimatedNumber value={totaalUren} duration={1000} formatOptions={{ maximumFractionDigits: 0 }} />
                    </span>
                    <span className="text-sm text-muted-foreground">uur</span>
                  </div>
                  {urenChange !== undefined && (
                    <div className={`flex items-center gap-1 text-xs ${urenChange >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {urenChange >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {urenChange >= 0 ? '+' : ''}{urenChange.toFixed(1)}% vs vorige periode
                    </div>
                  )}
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 shadow-lg shadow-blue-500/30">
                  <Clock className="h-5 w-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Average Efficiency Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          <Card className="relative overflow-hidden bg-card/80 backdrop-blur-sm border-white/10 dark:border-white/5">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-green-500/5 pointer-events-none" />
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Gem. Efficiëntie</p>
                  <div className="flex items-baseline gap-2">
                    <span className={`text-2xl font-bold ${getEfficiencyColor(gemiddeldeEfficiëntie).color}`}>
                      <AnimatedNumber value={gemiddeldeEfficiëntie} duration={1000} formatOptions={{ maximumFractionDigits: 0 }} />%
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {getEfficiencyLabel(gemiddeldeEfficiëntie)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Declarabele uren ratio</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 shadow-lg shadow-emerald-500/30">
                  <Zap className="h-5 w-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Active Projects Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className="relative overflow-hidden bg-card/80 backdrop-blur-sm border-white/10 dark:border-white/5">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-violet-500/5 pointer-events-none" />
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Actieve Projecten</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-purple-500">
                      <AnimatedNumber value={totalProjecten} duration={1000} formatOptions={{ maximumFractionDigits: 0 }} />
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{data.length} medewerkers</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 shadow-lg shadow-purple-500/30">
                  <Briefcase className="h-5 w-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Bar Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="group"
      >
        <Card className="relative overflow-hidden bg-card/80 backdrop-blur-sm border-white/10 dark:border-white/5 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/10 hover:border-blue-500/20">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-blue-500/10 via-purple-500/5 to-transparent rounded-full blur-3xl opacity-50 group-hover:opacity-70 transition-opacity duration-500 pointer-events-none" />

          <CardHeader className="relative">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/30">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle>Uren per Medewerker</CardTitle>
                <CardDescription>Vergelijking van declarabele en niet-declarabele uren</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={data}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <defs>
                  <linearGradient id={`declarabel-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgb(34, 197, 94)" stopOpacity={1} />
                    <stop offset="100%" stopColor="rgb(22, 163, 74)" stopOpacity={0.8} />
                  </linearGradient>
                  <linearGradient id={`nietDeclarabel-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgb(148, 163, 184)" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="rgb(100, 116, 139)" stopOpacity={0.4} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--muted-foreground))"
                  strokeOpacity={0.1}
                  vertical={false}
                />
                <XAxis
                  dataKey="naam"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={{ stroke: "hsl(var(--border))", strokeOpacity: 0.5 }}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(value) => `${value}u`}
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
                  dataKey="declarabeleUren"
                  name="Declarabel"
                  fill={`url(#declarabel-${gradientId})`}
                  radius={[4, 4, 0, 0]}
                  stackId="a"
                  animationDuration={1000}
                />
                <Bar
                  dataKey={(d: MedewerkerData) => d.uren - d.declarabeleUren}
                  name="Niet-declarabel"
                  fill={`url(#nietDeclarabel-${gradientId})`}
                  radius={[4, 4, 0, 0]}
                  stackId="a"
                  animationDuration={1000}
                  animationBegin={200}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>

      {/* Employee Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="group"
      >
        <Card className="relative overflow-hidden bg-card/80 backdrop-blur-sm border-white/10 dark:border-white/5 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/10 hover:border-purple-500/20">
          <CardHeader>
            <CardTitle>Productiviteit Ranglijst</CardTitle>
            <CardDescription>Medewerkers gesorteerd op efficiëntie ratio</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-white/10">
                  <TableHead className="w-[50px]">#</TableHead>
                  <TableHead>Medewerker</TableHead>
                  <TableHead className="text-right">Uren</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Projecten</TableHead>
                  <TableHead className="text-right">Efficiëntie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedData.map((medewerker, index) => {
                  const colors = getEfficiencyColor(medewerker.efficiëntieRatio);
                  const change = medewerker.previousEfficiëntie !== undefined
                    ? medewerker.efficiëntieRatio - medewerker.previousEfficiëntie
                    : undefined;

                  return (
                    <TableRow
                      key={medewerker.id}
                      className="border-white/5 transition-colors hover:bg-white/5 animate-in fade-in slide-in-from-left-2"
                      style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}
                    >
                      <TableCell className="py-3">
                        <RankBadge rank={index + 1} />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{medewerker.naam}</span>
                          <span className="text-xs text-muted-foreground">
                            {medewerker.gemiddeldeUrenPerProject.toFixed(1)}u per project
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                          <span className="font-medium">{medewerker.uren.toFixed(0)}u</span>
                          <span className="text-xs text-emerald-500">
                            {medewerker.declarabeleUren.toFixed(0)}u declarabel
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right hidden sm:table-cell">
                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-muted text-xs font-medium">
                          {medewerker.projecten}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex items-center gap-2">
                            <Progress
                              value={medewerker.efficiëntieRatio}
                              className="w-16 h-2"
                            />
                            <span className={`font-bold min-w-[45px] text-right ${colors.color}`}>
                              {medewerker.efficiëntieRatio}%
                            </span>
                          </div>
                          {change !== undefined && (
                            <div className={`flex items-center gap-1 text-xs ${change >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                              {change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                              {change >= 0 ? '+' : ''}{change.toFixed(1)}%
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
});
