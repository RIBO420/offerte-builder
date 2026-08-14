"use client";

import { memo, useMemo } from "react";
import { getStatusConfig as getCentralStatusConfig } from "@/lib/constants/statuses";
import { m } from "framer-motion";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  Clock,
  Target,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ExternalLink,
  FolderKanban,
  Timer,
} from "lucide-react";

interface ProjectData {
  id: string;
  naam: string;
  klantNaam: string;
  status: "gepland" | "in_uitvoering" | "afgerond" | "gefactureerd";
  startDatum: number;
  eindDatum?: number;
  geplandEindDatum: number;
  budget: number;
  werkelijkeKosten: number;
  winstmarge: number;
  isOpTijd: boolean;
  dagenOverschrijding?: number;
}

interface ProjectPrestatiesProps {
  data: ProjectData[];
  onTimePercentage?: number;
  previousOnTimePercentage?: number;
  budgetAccuracy?: number;
  previousBudgetAccuracy?: number;
  averageDuration?: number;
  previousAverageDuration?: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getStatusConfig(status: ProjectData["status"]): {
  label: string;
  color: string;
  bgColor: string;
  icon: typeof CheckCircle2;
} {
  // Statuskleuren uit de centrale bron (WS4): zelfde status = zelfde kleur.
  const config = getCentralStatusConfig(status, "project");
  return {
    label: config.label,
    color: config.color.text,
    bgColor: config.color.bg,
    icon: config.icon,
  };
}

function getMargeColor(marge: number): string {
  if (marge >= 30) return "text-trend-positive";
  if (marge >= 20) return "text-trend-positive";
  if (marge >= 10) return "text-status-verzonden-dot";
  return "text-trend-negative";
}

// KPI Card Component
function KpiCard({
  title,
  value,
  suffix,
  previousValue,
  icon: Icon,
  gradient,
  description,
  delay = 0,
}: {
  title: string;
  value: number;
  suffix?: string;
  previousValue?: number;
  icon: typeof Target;
  gradient: string;
  description: string;
  delay?: number;
}) {
  const change = previousValue !== undefined ? value - previousValue : undefined;

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
                <span className="text-3xl font-bold text-foreground">
                  <AnimatedNumber
                    value={value}
                    duration={1200}
                    formatOptions={{ minimumFractionDigits: 0, maximumFractionDigits: 0 }}
                  />
                </span>
                {suffix && <span className="text-xl font-bold text-foreground">{suffix}</span>}
              </div>
              <p className="text-xs text-muted-foreground">{description}</p>
              {change !== undefined && (
                <div className={`flex items-center gap-1 text-xs ${change >= 0 ? 'text-trend-positive' : 'text-trend-negative'}`}>
                  {change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {change >= 0 ? '+' : ''}{change.toFixed(1)}{suffix} vs vorige periode
                </div>
              )}
            </div>
            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${gradient.replace('/5', '')} shadow-lg`}>
              <Icon className="h-6 w-6 text-white" />
            </div>
          </div>
        </CardContent>
      </Card>
    </m.div>
  );
}

// Status Breakdown Component
function StatusBreakdown({ data }: { data: ProjectData[] }) {
  const statusCounts = useMemo(() => {
    const counts = {
      gepland: 0,
      in_uitvoering: 0,
      afgerond: 0,
      gefactureerd: 0,
    };
    data.forEach((project) => {
      counts[project.status]++;
    });
    return counts;
  }, [data]);

  const total = data.length;

  return (
    <m.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="group"
    >
      <Card className="relative overflow-hidden bg-card/80 backdrop-blur-sm border-white/10 dark:border-white/5">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-chart-3 to-chart-3 shadow-lg shadow-indigo-500/30">
              <FolderKanban className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle>Status Verdeling</CardTitle>
              <CardDescription>{total} projecten totaal</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {(Object.entries(statusCounts) as [ProjectData["status"], number][]).map(([status, count]) => {
            const config = getStatusConfig(status);
            const percentage = total > 0 ? (count / total) * 100 : 0;
            const Icon = config.icon;

            return (
              <div key={status} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${config.bgColor}`}>
                      <Icon className={`h-3.5 w-3.5 ${config.color}`} />
                    </div>
                    <span className="text-sm font-medium">{config.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{count}</span>
                    <span className={`text-sm font-semibold ${config.color}`}>
                      {percentage.toFixed(0)}%
                    </span>
                  </div>
                </div>
                <Progress value={percentage} className="h-2" />
              </div>
            );
          })}
        </CardContent>
      </Card>
    </m.div>
  );
}

export const ProjectPrestaties = memo(function ProjectPrestaties({
  data,
  onTimePercentage = 85,
  previousOnTimePercentage,
  budgetAccuracy = 92,
  previousBudgetAccuracy,
  averageDuration = 14,
  previousAverageDuration,
}: ProjectPrestatiesProps) {

  // Calculate summary statistics
  const gemiddeldeWinstmarge = data.length > 0
    ? data.reduce((sum, p) => sum + p.winstmarge, 0) / data.length
    : 0;

  // Sort by most recent start date
  const recentProjects = useMemo(() =>
    [...data].sort((a, b) => b.startDatum - a.startDatum).slice(0, 10),
    [data]
  );

  if (data.length === 0) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <KpiCard
            title="Op Tijd Afgerond"
            value={onTimePercentage}
            suffix="%"
            icon={Clock}
            gradient="from-chart-1/5 via-transparent to-primary/5"
            description="Projecten binnen deadline"
          />
          <KpiCard
            title="Budget Nauwkeurigheid"
            value={budgetAccuracy}
            suffix="%"
            icon={Target}
            gradient="from-chart-3/5 via-transparent to-chart-5/5"
            description="Binnen 10% van budget"
            delay={0.1}
          />
          <KpiCard
            title="Gem. Doorlooptijd"
            value={averageDuration}
            suffix=" dagen"
            icon={Timer}
            gradient="from-chart-5/5 via-transparent to-chart-3/5"
            description="Van start tot oplevering"
            delay={0.2}
          />
        </div>
        <Card className="relative overflow-hidden bg-card/80 backdrop-blur-sm border-white/10 dark:border-white/5">
          <CardHeader>
            <CardTitle>Project Prestaties</CardTitle>
            <CardDescription>Overzicht van recente projecten</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-[200px] items-center justify-center text-muted-foreground">
              Geen project data beschikbaar
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard
          title="Op Tijd Afgerond"
          value={onTimePercentage}
          suffix="%"
          previousValue={previousOnTimePercentage}
          icon={Clock}
          gradient="from-chart-1/5 via-transparent to-primary/5"
          description="Projecten binnen deadline"
        />
        <KpiCard
          title="Budget Nauwkeurigheid"
          value={budgetAccuracy}
          suffix="%"
          previousValue={previousBudgetAccuracy}
          icon={Target}
          gradient="from-chart-3/5 via-transparent to-chart-5/5"
          description="Binnen 10% van budget"
          delay={0.1}
        />
        <KpiCard
          title="Gem. Doorlooptijd"
          value={averageDuration}
          suffix=" dagen"
          previousValue={previousAverageDuration}
          icon={Timer}
          gradient="from-chart-5/5 via-transparent to-chart-3/5"
          description="Van start tot oplevering"
          delay={0.2}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Status Breakdown */}
        <StatusBreakdown data={data} />

        {/* Recent Projects Table */}
        <m.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="lg:col-span-2 group"
        >
          <Card className="relative overflow-hidden bg-card/80 backdrop-blur-sm border-white/10 dark:border-white/5 transition-all duration-300 hover:shadow-lg">
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-chart-1/10 via-chart-1/5 to-transparent rounded-full blur-3xl opacity-50 group-hover:opacity-70 transition-opacity duration-500 pointer-events-none" />

            <CardHeader className="relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-chart-1 to-primary shadow-lg shadow-emerald-500/30">
                    <FolderKanban className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle>Recente Projecten</CardTitle>
                    <CardDescription>
                      Gem. winstmarge:{" "}
                      <span className={`font-semibold ${getMargeColor(gemiddeldeWinstmarge)}`}>
                        {gemiddeldeWinstmarge.toFixed(1)}%
                      </span>
                    </CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10">
                    <TableHead>Project</TableHead>
                    <TableHead className="hidden sm:table-cell">Status</TableHead>
                    <TableHead className="text-right hidden md:table-cell">Budget</TableHead>
                    <TableHead className="text-right">Marge</TableHead>
                    <TableHead className="text-center">Op tijd</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentProjects.map((project, index) => {
                    const statusConfig = getStatusConfig(project.status);
                    const StatusIcon = statusConfig.icon;

                    return (
                      <TableRow
                        key={project.id}
                        className="border-white/5 transition-colors hover:bg-white/5 animate-in fade-in slide-in-from-left-2"
                        style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}
                      >
                        <TableCell>
                          <div className="flex flex-col">
                            <Link
                              href={`/projecten/${project.id}`}
                              className="font-medium hover:text-trend-positive transition-colors flex items-center gap-1 group/link"
                            >
                              {project.naam}
                              <ExternalLink className="h-3 w-3 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                            </Link>
                            <span className="text-xs text-muted-foreground">{project.klantNaam}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge variant="secondary" className={`${statusConfig.bgColor} ${statusConfig.color} border-0 gap-1`}>
                            <StatusIcon className="h-3 w-3" />
                            {statusConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right hidden md:table-cell">
                          <div className="flex flex-col items-end">
                            <span className="font-medium">{formatCurrency(project.budget)}</span>
                            <span className="text-xs text-muted-foreground">
                              Werkelijk: {formatCurrency(project.werkelijkeKosten)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`font-bold ${getMargeColor(project.winstmarge)}`}>
                            {project.winstmarge.toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {project.isOpTijd ? (
                            <div className="flex items-center justify-center">
                              <CheckCircle2 className="h-5 w-5 text-trend-positive" />
                            </div>
                          ) : (
                            <div className="flex flex-col items-center">
                              <AlertTriangle className="h-5 w-5 text-status-verzonden-dot" />
                              {project.dagenOverschrijding && (
                                <span className="text-xs text-status-verzonden-dot">
                                  +{project.dagenOverschrijding}d
                                </span>
                              )}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </m.div>
      </div>
    </div>
  );
});
