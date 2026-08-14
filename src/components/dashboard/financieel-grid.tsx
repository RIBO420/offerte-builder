"use client";

import { FolderKanban, Receipt, TrendingUp } from "lucide-react";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Sparkline } from "@/components/ui/sparkline";
import { formatMaandJaar, formatKwartaalJaar } from "@/lib/format";

// ── TrendChip ───────────────────────────────────────────────────────────────
//
// De kleur volgt de richting van het cijfer, niet de huisstijl van de kaart:
// een omzet van −21% mag nooit groen ogen. De status-tokenparen (bg + text)
// zijn de enige AA-geverifieerde tintcombinaties, dus die lenen we hier.

function TrendChip({ pct }: { pct: number }) {
  const chipClass =
    pct > 0
      ? "bg-status-geaccepteerd text-status-geaccepteerd-text"
      : pct < 0
        ? "bg-status-vervallen text-status-vervallen-text"
        : "bg-muted text-muted-foreground";

  return (
    <span
      className={`${chipClass} text-[11px] font-semibold px-2 py-0.5 rounded-md inline-flex items-center gap-1`}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        aria-hidden="true"
        // Dezelfde zigzag, maar bij een daling verticaal gespiegeld — de
        // richting van het lijntje en de kleur vertellen hetzelfde verhaal.
        style={pct < 0 ? { transform: "scaleY(-1)" } : undefined}
      >
        <path
          d="M1 8 L3 5 L5 6.5 L8 3 L11 4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {pct > 0 ? "+" : ""}
      {pct}%
    </span>
  );
}

// ── MetricCard ──────────────────────────────────────────────────────────────

interface MetricCardProps {
  title: string;
  value: number;
  format?: "currency" | "number";
  icon?: React.ReactNode;
  iconClass?: string;
  trendPercentage?: number;
  subtitle?: string;
  subtitleClass?: string;
  sparklineData?: number[];
  sparklineColor?: string;
}

function MetricCard({
  title,
  value,
  format = "number",
  icon,
  iconClass,
  trendPercentage,
  subtitle,
  subtitleClass,
  sparklineData,
  sparklineColor,
}: MetricCardProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 relative overflow-hidden hover:-translate-y-px hover:shadow-md transition-all duration-200">
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground font-medium">
          {title}
        </span>
        {trendPercentage != null ? (
          <TrendChip pct={trendPercentage} />
        ) : (
          <span className={iconClass ?? "text-muted-foreground"}>{icon}</span>
        )}
      </div>

      {/* Value */}
      <AnimatedNumber
        value={value}
        prefix={format === "currency" ? "€ " : ""}
        formatOptions={{
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }}
        locale="nl-NL"
        className="text-[28px] font-extrabold tracking-tight leading-none tabular-nums"
      />

      {/* Subtitle */}
      {subtitle && (
        <p className={`text-[11px] mt-1.5 ${subtitleClass ?? "text-muted-foreground"}`}>
          {subtitle}
        </p>
      )}

      {/* Sparkline */}
      {sparklineData && sparklineColor && (
        <div className="absolute bottom-0 left-0 right-0 opacity-[0.12]">
          <Sparkline
            data={sparklineData}
            width={300}
            height={36}
            color={sparklineColor}
            showArea
          />
        </div>
      )}
    </div>
  );
}

// ── Heldcijfer: Totale Omzet ────────────────────────────────────────────────
//
// Eén cijfer mag domineren ("Vakwerk in het groen": één heldcijfer per
// scherm). De omzet krijgt het displayfont (Fraunces) en een volle rij; de
// waarde zelf blijft neutraal — de trendchip draagt het oordeel.

function OmzetHeroCard({
  value,
  trendPercentage,
  subtitle,
}: {
  value: number;
  trendPercentage?: number;
  subtitle: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 relative overflow-hidden">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground font-medium">
          Totale Omzet
        </span>
        {trendPercentage != null && <TrendChip pct={trendPercentage} />}
      </div>

      <AnimatedNumber
        value={value}
        prefix="€ "
        formatOptions={{
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }}
        locale="nl-NL"
        className="font-display text-[40px] md:text-[44px] font-semibold tracking-tight leading-none tabular-nums"
      />

      <p className="text-[11px] text-muted-foreground mt-2">{subtitle}</p>

      <div className="absolute bottom-0 left-0 right-0 opacity-[0.12]">
        <Sparkline
          data={[10, 15, 12, 20, 18, 25, 30, 28, 35, 40, 38, 45]}
          width={640}
          height={36}
          color="var(--chart-1)"
          showArea
        />
      </div>
    </div>
  );
}

// ── FinancieelGrid ──────────────────────────────────────────────────────────
//
// WS3a: 6 → 4 KPI's. "Openstaande Offertes" verviel (dubbel met de
// pipeline-kaart eronder) en "Uren deze Maand" verviel (leeft op /uren en
// /rapportages). Wat blijft: omzet als heldcijfer, plus drie compacte kaarten.

export interface FinancieelGridProps {
  totaleOmzet: number;
  actieveProjecten: number;
  totaalProjecten: number;
  afgerondeProjecten: number;
  openstaandBedrag: number;
  vervaldeAantal: number;
  vervaldenBedrag: number;
  gefactureerdThisQ: number;
  omzetTrendPercentage?: number;
  gefactureerdTrendPercentage?: number;
}

export function FinancieelGrid({
  totaleOmzet,
  actieveProjecten,
  totaalProjecten,
  afgerondeProjecten,
  openstaandBedrag,
  vervaldeAantal,
  vervaldenBedrag,
  gefactureerdThisQ,
  omzetTrendPercentage,
  gefactureerdTrendPercentage,
}: FinancieelGridProps) {
  // §5.5: periode-labels via de centrale formatteringshelper (consistent NL)
  const now = new Date();
  const maandLabel = formatMaandJaar(now);
  const kwartaalLabel = formatKwartaalJaar(now);

  // Openstaand bedrag subtitle (overdue)
  const openstaandSubtitle =
    vervaldeAantal === 0
      ? "Alles op tijd"
      : `${vervaldeAantal} vervallen (€ ${new Intl.NumberFormat("nl-NL", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(vervaldenBedrag)})`;
  const openstaandSubtitleClass =
    vervaldeAantal === 0
      ? "text-status-geaccepteerd-text"
      : "text-status-vervallen-text";

  return (
    <section>
      <h2 className="text-xs text-muted-foreground uppercase tracking-widest font-medium mb-2.5">
        Financieel &amp; Operationeel
      </h2>

      <div className="grid grid-cols-1 gap-2">
        {/* 1. Totale Omzet — het heldcijfer */}
        <OmzetHeroCard
          value={totaleOmzet}
          trendPercentage={omzetTrendPercentage}
          subtitle={`t/m ${maandLabel}`}
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {/* 2. Actieve Projecten */}
          <MetricCard
            title="Actieve Projecten"
            value={actieveProjecten}
            icon={<FolderKanban className="h-4 w-4" />}
            iconClass="text-accent-warm"
            subtitle={`${afgerondeProjecten} afgerond / ${totaalProjecten} totaal`}
          />

          {/* 3. Openstaand */}
          <MetricCard
            title="Openstaand"
            value={openstaandBedrag}
            format="currency"
            icon={<Receipt className="h-4 w-4" />}
            iconClass="text-accent-warm"
            subtitle={openstaandSubtitle}
            subtitleClass={openstaandSubtitleClass}
          />

          {/* 4. Gefactureerd dit Q */}
          <MetricCard
            title="Gefactureerd dit Q"
            value={gefactureerdThisQ}
            format="currency"
            icon={<TrendingUp className="h-4 w-4" />}
            trendPercentage={gefactureerdTrendPercentage}
            subtitle={kwartaalLabel}
            sparklineData={[5, 8, 10, 15, 20, 22, 25, 30]}
            sparklineColor="var(--chart-3)"
          />
        </div>
      </div>
    </section>
  );
}
