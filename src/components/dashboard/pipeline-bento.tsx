"use client";

import Link from "next/link";
import { FolderKanban } from "lucide-react";
import { DonutChart } from "@/components/ui/donut-chart";

// ── Types ────────────────────────────────────────────────────────────

interface PipelineBentoProps {
  offerteStats: {
    concept: number;
    voorcalculatie: number;
    verzonden: number;
    geaccepteerd: number;
    afgewezen: number;
    totaal: number;
  };
  conversionRate: number;
  totalAcceptedCount: number;
  totalSentForConversion: number;
  averageOfferteValue: number;
  projectStats: {
    totaal: number;
    gepland: number;
    in_uitvoering: number;
    afgerond: number;
    nacalculatie_compleet: number;
    gefactureerd: number;
  };
  activeProjects: Array<{
    _id: string;
    naam: string;
    klantNaam: string;
    voortgang: number;
    totaalUren: number;
    begroteUren: number;
  }>;
  recentOffertes: Array<{
    _id: string;
    offerteNummer: string;
    klant: { naam: string };
    status: string;
    totalen: { totaalInclBtw: number };
    updatedAt: number;
  }>;
}

// ── Helpers ──────────────────────────────────────────────────────────

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return "Zojuist";
  if (minutes < 60) return `${minutes} min`;
  if (hours < 24) return `${hours} uur`;
  if (days === 1) return "Gisteren";
  if (days < 7) return `${days} dagen`;
  if (days < 30) return `${Math.floor(days / 7)} weken`;
  return `${Math.floor(days / 30)} maand`;
}

const statusConfig: Record<
  string,
  { label: string; color: string; valueColor: string }
> = {
  concept: {
    label: "Concept aangemaakt",
    color: "#64748b",
    valueColor: "text-foreground",
  },
  voorcalculatie: {
    label: "Voorcalculatie gemaakt",
    color: "#f59e0b",
    valueColor: "text-foreground",
  },
  verzonden: {
    label: "Offerte verzonden",
    color: "#3b82f6",
    valueColor: "text-foreground",
  },
  geaccepteerd: {
    label: "Offerte geaccepteerd",
    color: "#22c55e",
    valueColor: "text-green-500",
  },
  afgewezen: {
    label: "Offerte afgewezen",
    color: "#ef4444",
    valueColor: "text-red-500",
  },
};

const pipelineColors: Record<string, string> = {
  concept: "#64748b",
  voorcalculatie: "#f59e0b",
  verzonden: "#3b82f6",
  geaccepteerd: "#22c55e",
  afgewezen: "#ef4444",
};

const pipelineNumberColors: Record<string, string> = {
  concept: "#94a3b8",
  voorcalculatie: "#f59e0b",
  verzonden: "inherit",
  geaccepteerd: "#22c55e",
  afgewezen: "inherit",
};

// ── Segmented Bar ────────────────────────────────────────────────────

function SegmentedBar({
  stats,
}: {
  stats: PipelineBentoProps["offerteStats"];
}) {
  const keys = [
    "concept",
    "voorcalculatie",
    "verzonden",
    "geaccepteerd",
    "afgewezen",
  ] as const;
  const total = stats.totaal || 1;

  return (
    <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full">
      {keys.map((key) => {
        if (stats[key] === 0) return null;
        const widthPct = (stats[key] / total) * 100;
        return (
          <div
            key={key}
            className="rounded-full transition-all duration-500"
            style={{
              width: `${widthPct}%`,
              backgroundColor: pipelineColors[key],
              minWidth: stats[key] > 0 ? 4 : 0,
            }}
          />
        );
      })}
    </div>
  );
}

// ── Pipeline Card ────────────────────────────────────────────────────

function PipelineCard({
  stats,
}: {
  stats: PipelineBentoProps["offerteStats"];
}) {
  const keys = [
    "concept",
    "voorcalculatie",
    "verzonden",
    "geaccepteerd",
    "afgewezen",
  ] as const;

  const labels: Record<string, string> = {
    concept: "Concept",
    voorcalculatie: "Voorcalc.",
    verzonden: "Verzonden",
    geaccepteerd: "Geaccept.",
    afgewezen: "Afgewezen",
  };

  return (
    <div className="bg-[#141414] border border-white/[0.06] rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3.5">
        <h3 className="text-[15px] font-semibold">Offerte Pipeline</h3>
        <span className="text-xs text-muted-foreground">
          {stats.totaal} totaal
        </span>
      </div>

      {/* Segmented bar */}
      <SegmentedBar stats={stats} />

      {/* Status counts grid */}
      <div className="grid grid-cols-5 gap-1.5 mt-3.5">
        {keys.map((key) => {
          const isAccepted = key === "geaccepteerd";
          const isRejectedZero = key === "afgewezen" && stats[key] === 0;

          return (
            <div
              key={key}
              className={`text-center py-2 rounded-lg ${
                isAccepted
                  ? "bg-green-500/[0.05]"
                  : "bg-white/[0.02]"
              }`}
            >
              <div
                className="text-xl font-bold tabular-nums"
                style={{
                  color: isRejectedZero
                    ? "hsl(var(--muted-foreground))"
                    : pipelineNumberColors[key],
                }}
              >
                {stats[key]}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {labels[key]}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Conversie Rate Card ──────────────────────────────────────────────

function ConversieRateCard({
  rate,
  acceptedCount,
  sentForConversion,
  averageValue,
}: {
  rate: number;
  acceptedCount: number;
  sentForConversion: number;
  averageValue: number;
}) {
  const pct = Math.min(100, Math.max(0, rate));
  // r=40, circumference = 2 * PI * 40 ≈ 251.33
  const circumference = 2 * Math.PI * 40;
  const dashLength = (pct / 100) * circumference;

  return (
    <div className="bg-[#141414] border border-white/[0.06] rounded-xl p-4 flex flex-col items-center justify-center">
      <span className="text-xs text-muted-foreground font-medium mb-3">
        Conversie Rate
      </span>

      {/* SVG radial chart */}
      <svg width={120} height={120} viewBox="0 0 100 100">
        {/* Track */}
        <circle
          cx={50}
          cy={50}
          r={40}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={6}
        />
        {/* Fill */}
        <circle
          cx={50}
          cy={50}
          r={40}
          fill="none"
          stroke="#22c55e"
          strokeWidth={6}
          strokeDasharray={`${dashLength} ${circumference - dashLength}`}
          strokeDashoffset={circumference * 0.25}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
        {/* Percentage text */}
        <text
          x={50}
          y={50}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={18}
          fontWeight={800}
          fill="#22c55e"
        >
          {Math.round(pct)}%
        </text>
      </svg>

      {/* Accepted count */}
      <span className="text-[10px] text-muted-foreground/60 mt-1">
        {acceptedCount}/{sentForConversion} geaccepteerd
      </span>

      {/* Average value badge */}
      <span className="bg-green-500/10 text-green-400 text-[10px] font-semibold px-2 py-0.5 rounded mt-1.5">
        Gem. {formatCurrency(averageValue)}
      </span>
    </div>
  );
}

// ── Project Status Card ──────────────────────────────────────────────

function ProjectStatusCard({
  stats,
}: {
  stats: PipelineBentoProps["projectStats"];
}) {
  const statusEntries = [
    { label: "Gepland", value: stats.gepland, color: "#3b82f6" },
    { label: "In uitvoering", value: stats.in_uitvoering, color: "#f97316" },
    { label: "Afgerond", value: stats.afgerond, color: "#22c55e" },
    {
      label: "Nacalculatie",
      value: stats.nacalculatie_compleet,
      color: "#a855f7",
    },
    { label: "Gefactureerd", value: stats.gefactureerd, color: "#06b6d4" },
  ];

  const segments = statusEntries
    .filter((s) => s.value > 0)
    .map((s) => ({ label: s.label, value: s.value, color: s.color }));

  const visibleEntries = statusEntries.filter((s) => s.value > 0);

  return (
    <div className="bg-[#141414] border border-white/[0.06] rounded-xl p-4">
      <h3 className="text-[15px] font-semibold mb-3.5">Project Status</h3>

      <div className="flex items-center gap-5">
        {/* Donut chart */}
        <div className="shrink-0">
          <DonutChart
            segments={segments}
            size={110}
            strokeWidth={16}
            showTotal={true}
            totalLabel="Projecten"
            showLegend={false}
            formatValue={(v) => String(v)}
          />
        </div>

        {/* Custom legend */}
        <div className="space-y-2.5 flex-1 min-w-0">
          {visibleEntries.map((entry) => (
            <div
              key={entry.label}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-xs text-muted-foreground truncate">
                  {entry.label}
                </span>
              </div>
              <span className="text-sm font-bold tabular-nums ml-2">
                {entry.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Recente Activiteit Card ──────────────────────────────────────────

function RecenteActiviteitCard({
  offertes,
}: {
  offertes: PipelineBentoProps["recentOffertes"];
}) {
  return (
    <div className="bg-[#141414] border border-white/[0.06] rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3.5">
        <h3 className="text-[15px] font-semibold">Recente Activiteit</h3>
        <Link
          href="/offertes"
          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          Bekijk alle &rarr;
        </Link>
      </div>

      {/* Timeline */}
      <div className="space-y-3">
        {offertes.map((offerte) => {
          const config = statusConfig[offerte.status] ?? {
            label: offerte.status,
            color: "#64748b",
            valueColor: "text-foreground",
          };

          return (
            <div key={offerte._id} className="flex items-start gap-2.5">
              {/* Status dot */}
              <div
                className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                style={{ backgroundColor: config.color }}
              />

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{config.label}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {offerte.offerteNummer} &middot;{" "}
                  {formatTimeAgo(offerte.updatedAt)}
                </p>
              </div>

              {/* Amount */}
              <span
                className={`text-[13px] font-semibold tabular-nums shrink-0 ${config.valueColor}`}
              >
                {formatCurrency(offerte.totalen.totaalInclBtw)}
              </span>
            </div>
          );
        })}

        {offertes.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            Geen recente activiteit
          </p>
        )}
      </div>
    </div>
  );
}

// ── Lopend Project Card ──────────────────────────────────────────────

function LopendProjectCard({
  project,
}: {
  project: PipelineBentoProps["activeProjects"][number];
}) {
  const voortgangPct = Math.min(100, Math.max(0, project.voortgang));

  return (
    <Link
      href={`/projecten/${project._id}`}
      className="bg-[#141414] border border-white/[0.06] rounded-xl p-3.5 cursor-pointer block hover:border-white/[0.12] transition-colors"
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-2.5">
        <div className="bg-orange-500/[0.08] w-[34px] h-[34px] rounded-[9px] flex items-center justify-center shrink-0">
          <FolderKanban className="w-4 h-4 text-orange-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate">{project.naam}</p>
          <p className="text-[11px] text-muted-foreground truncate">
            {project.klantNaam}
          </p>
        </div>
        <span className="text-[15px] font-bold text-orange-500 tabular-nums shrink-0">
          {voortgangPct}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="bg-orange-500/[0.08] rounded h-1 overflow-hidden mb-2">
        <div
          className="bg-orange-500 h-full rounded transition-all duration-500"
          style={{ width: `${voortgangPct}%` }}
        />
      </div>

      {/* Footer */}
      <p className="text-[10px] text-muted-foreground tabular-nums">
        {project.totaalUren} / {project.begroteUren} uur
      </p>
    </Link>
  );
}

// ── Main Component ───────────────────────────────────────────────────

export function PipelineBento({
  offerteStats,
  conversionRate,
  totalAcceptedCount,
  totalSentForConversion,
  averageOfferteValue,
  projectStats,
  activeProjects,
  recentOffertes,
}: PipelineBentoProps) {
  return (
    <section>
      {/* Section header */}
      <h2 className="text-xs text-muted-foreground uppercase tracking-widest font-medium mb-2.5">
        Projecten &amp; Pipeline
      </h2>

      {/* Row 1: Pipeline (2fr) + Conversie Rate (1fr) */}
      <div className="grid grid-cols-[2fr_1fr] gap-2 mb-2">
        <PipelineCard stats={offerteStats} />
        <ConversieRateCard
          rate={conversionRate}
          acceptedCount={totalAcceptedCount}
          sentForConversion={totalSentForConversion}
          averageValue={averageOfferteValue}
        />
      </div>

      {/* Row 2: Project Status (1fr) + Recente Activiteit (1fr) */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        <ProjectStatusCard stats={projectStats} />
        <RecenteActiviteitCard offertes={recentOffertes} />
      </div>

      {/* Row 3: Lopende Projecten (conditional) */}
      {activeProjects.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {activeProjects.map((project) => (
            <LopendProjectCard key={project._id} project={project} />
          ))}
        </div>
      )}
    </section>
  );
}

export type { PipelineBentoProps };
