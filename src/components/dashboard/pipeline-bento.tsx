"use client";

import Link from "next/link";

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

// Eén statussemantiek voor het hele dashboard: de dot-tokens uit globals.css
// (Loof & Leem) zijn de enige kleurbron — geen eigen hexreeks meer naast de
// statusbadges elders in de app.
const statusDot: Record<string, string> = {
  concept: "var(--status-concept-dot)",
  voorcalculatie: "var(--status-voorcalculatie-dot)",
  verzonden: "var(--status-verzonden-dot)",
  geaccepteerd: "var(--status-geaccepteerd-dot)",
  afgewezen: "var(--status-afgewezen-dot)",
};

const statusLabel: Record<string, string> = {
  concept: "Concept aangemaakt",
  voorcalculatie: "Voorcalculatie gemaakt",
  verzonden: "Offerte verzonden",
  geaccepteerd: "Offerte geaccepteerd",
  afgewezen: "Offerte afgewezen",
};

// ── Segmented Bar ────────────────────────────────────────────────────

function SegmentedBar({
  stats,
}: {
  stats: PipelineBentoProps["offerteStats"];
}) {
  // §5.3b: concepten (wizard auto-save) tellen niet mee in de pipeline
  const keys = [
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
              backgroundColor: statusDot[key],
              minWidth: stats[key] > 0 ? 4 : 0,
            }}
          />
        );
      })}
    </div>
  );
}

// ── Pipeline Card ────────────────────────────────────────────────────
//
// WS3a: de vier stat-boxen onder de bar zijn weg — ze herhaalden exact de
// tellers van de segmenten. De bar krijgt nu een compacte legendaregel met
// dot + label + aantal, direct eronder.

function PipelineCard({
  stats,
}: {
  stats: PipelineBentoProps["offerteStats"];
}) {
  // §5.3b: concepten (wizard auto-save) tellen niet mee in de pipeline
  const keys = [
    "voorcalculatie",
    "verzonden",
    "geaccepteerd",
    "afgewezen",
  ] as const;

  const labels: Record<string, string> = {
    voorcalculatie: "Voorcalculatie",
    verzonden: "Verzonden",
    geaccepteerd: "Geaccepteerd",
    afgewezen: "Afgewezen",
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3.5">
        <h3 className="text-[15px] font-semibold">Offerte Pipeline</h3>
        <span className="text-xs text-muted-foreground">
          {stats.totaal} in pipeline
          {stats.concept > 0 && ` · ${stats.concept} concept${stats.concept === 1 ? "" : "en"}`}
        </span>
      </div>

      {/* Segmented bar */}
      <SegmentedBar stats={stats} />

      {/* Legenda: labels + tellers bij de segmenten */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
        {keys.map((key) => (
          <span
            key={key}
            className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: statusDot[key] }}
              aria-hidden="true"
            />
            {labels[key]}
            <span className="font-semibold tabular-nums text-foreground">
              {stats[key]}
            </span>
          </span>
        ))}
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
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col items-center justify-center">
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
          stroke="var(--border)"
          strokeWidth={6}
        />
        {/* Fill */}
        <circle
          cx={50}
          cy={50}
          r={40}
          fill="none"
          stroke="var(--chart-1)"
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
          fill="var(--primary)"
        >
          {Math.round(pct)}%
        </text>
      </svg>

      {/* Accepted count */}
      <span className="text-[11px] text-muted-foreground mt-1">
        {acceptedCount}/{sentForConversion} geaccepteerd
      </span>

      {/* Average value badge */}
      <span className="bg-primary/10 text-primary text-[11px] font-semibold px-2 py-0.5 rounded mt-1.5">
        Gem. {formatCurrency(averageValue)}
      </span>
    </div>
  );
}

// ── Actueel Card ─────────────────────────────────────────────────────
//
// WS3a-fusie: de losse project-voortgangscards en "Recente Activiteit"
// waren twee blikken op hetzelfde lopende werk. Eén kaart: eerst het werk
// dat loopt (voortgang), daaronder de laatste offerte-events.

function ActueelCard({
  projects,
  offertes,
}: {
  projects: PipelineBentoProps["activeProjects"];
  offertes: PipelineBentoProps["recentOffertes"];
}) {
  const heeftInhoud = projects.length > 0 || offertes.length > 0;

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[15px] font-semibold">Actueel</h3>
        <Link
          href="/offertes"
          className="inline-flex min-h-6 items-center text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Alle offertes &rarr;
        </Link>
      </div>

      {/* Lopend werk */}
      {projects.length > 0 && (
        <div className="mb-3">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-1.5">
            Lopend werk
          </p>
          <div className="space-y-1">
            {projects.map((project) => {
              const voortgangPct = Math.min(
                100,
                Math.max(0, project.voortgang)
              );
              return (
                <Link
                  key={project._id}
                  href={`/projecten/${project._id}`}
                  className="block rounded-lg px-2 py-2 -mx-2 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3 mb-1.5">
                    <p className="text-xs font-medium truncate">
                      {project.naam}
                      <span className="text-muted-foreground font-normal">
                        {" "}
                        &middot; {project.klantNaam}
                      </span>
                    </p>
                    <span className="text-xs font-semibold tabular-nums shrink-0">
                      {voortgangPct}%
                    </span>
                  </div>
                  {/* Voortgang in accent-warm (terracotta): voortgang is werk
                      onderweg, geen succes — groen blijft voor "afgerond". */}
                  <div className="bg-accent-warm/15 rounded h-1 overflow-hidden">
                    <div
                      className="bg-accent-warm h-full rounded transition-all duration-500"
                      style={{ width: `${voortgangPct}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground tabular-nums mt-1">
                    {project.totaalUren} / {project.begroteUren} uur
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Laatste offerte-events */}
      {offertes.length > 0 && (
        <div className={projects.length > 0 ? "border-t border-border pt-3" : ""}>
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-1.5">
            Laatste offertes
          </p>
          <div className="space-y-2.5">
            {offertes.map((offerte) => (
              <div key={offerte._id} className="flex items-start gap-2.5">
                {/* Status dot */}
                <div
                  className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                  style={{
                    backgroundColor:
                      statusDot[offerte.status] ?? "var(--status-concept-dot)",
                  }}
                />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">
                    {statusLabel[offerte.status] ?? offerte.status}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {offerte.offerteNummer} &middot;{" "}
                    {formatTimeAgo(offerte.updatedAt)}
                  </p>
                </div>

                {/* Amount — neutraal: de status zit al in dot + label */}
                <span className="text-[13px] font-semibold tabular-nums shrink-0">
                  {formatCurrency(offerte.totalen.totaalInclBtw)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!heeftInhoud && (
        <p className="text-xs text-muted-foreground text-center py-4">
          Geen recente activiteit
        </p>
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────
//
// WS3a: de Project Status-donut is weg — dezelfde aantallen staan al in de
// KPI "Actieve Projecten" en in de tabs op /projecten.

export function PipelineBento({
  offerteStats,
  conversionRate,
  totalAcceptedCount,
  totalSentForConversion,
  averageOfferteValue,
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
      <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-2 mb-2">
        <PipelineCard stats={offerteStats} />
        <ConversieRateCard
          rate={conversionRate}
          acceptedCount={totalAcceptedCount}
          sentForConversion={totalSentForConversion}
          averageValue={averageOfferteValue}
        />
      </div>

      {/* Row 2: Actueel — lopend werk + laatste offerte-events, gefuseerd */}
      <ActueelCard projects={activeProjects} offertes={recentOffertes} />
    </section>
  );
}

export type { PipelineBentoProps };
