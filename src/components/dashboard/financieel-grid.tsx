"use client";

import { Euro, FolderKanban, FileText, Receipt, TrendingUp, Clock } from "lucide-react";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Sparkline } from "@/components/ui/sparkline";

// ── MetricCard ──────────────────────────────────────────────────────────────

interface MetricCardProps {
  title: string;
  value: number;
  format?: "currency" | "number";
  icon: React.ReactNode;
  iconColor: string;
  trendPercentage?: number;
  trendColor?: string;
  subtitle?: string;
  subtitleColor?: string;
  sparklineData?: number[];
  sparklineColor?: string;
}

function MetricCard({
  title,
  value,
  format = "number",
  icon,
  iconColor,
  trendPercentage,
  trendColor,
  subtitle,
  subtitleColor,
  sparklineData,
  sparklineColor,
}: MetricCardProps) {
  const isCurrency = format === "currency";

  // Trend badge color classes
  const trendBgClass =
    trendColor === "blue" ? "bg-blue-500/12" : "bg-green-500/12";
  const trendTextClass =
    trendColor === "blue" ? "text-blue-400" : "text-green-400";

  return (
    <div className="bg-[#141414] border border-white/[0.06] rounded-xl p-4 relative overflow-hidden hover:-translate-y-px hover:shadow-md transition-all duration-200">
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground font-medium">
          {title}
        </span>
        {trendPercentage != null ? (
          <span
            className={`${trendBgClass} ${trendTextClass} text-[11px] font-semibold px-2 py-0.5 rounded-md inline-flex items-center gap-1`}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M1 8 L3 5 L5 6.5 L8 3 L11 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {trendPercentage > 0 ? "+" : ""}
            {trendPercentage}%
          </span>
        ) : (
          <span className={iconColor}>{icon}</span>
        )}
      </div>

      {/* Value */}
      {isCurrency ? (
        <AnimatedNumber
          value={value}
          prefix="€ "
          formatOptions={{
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          }}
          locale="nl-NL"
          className={`text-[28px] font-extrabold tracking-tight leading-none ${
            iconColor === "text-green-500" ? "text-green-500" : ""
          }`}
        />
      ) : (
        <AnimatedNumber
          value={value}
          formatOptions={{
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          }}
          locale="nl-NL"
          className="text-[28px] font-extrabold tracking-tight leading-none"
        />
      )}

      {/* Subtitle */}
      {subtitle && (
        <p className={`text-[11px] mt-1.5 ${subtitleColor ?? "text-muted-foreground"}`}>
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

// ── FinancieelGrid ──────────────────────────────────────────────────────────

export interface FinancieelGridProps {
  totaleOmzet: number;
  actieveProjecten: number;
  totaalProjecten: number;
  afgerondeProjecten: number;
  openstaandeOffertes: number;
  openstaandBedrag: number;
  vervaldeAantal: number;
  vervaldenBedrag: number;
  gefactureerdThisQ: number;
  gefactureerdPrevQ: number;
  urenDezeMaand: number;
  omzetTrendPercentage?: number;
  gefactureerdTrendPercentage?: number;
}

export function FinancieelGrid({
  totaleOmzet,
  actieveProjecten,
  totaalProjecten,
  afgerondeProjecten,
  openstaandeOffertes,
  openstaandBedrag,
  vervaldeAantal,
  vervaldenBedrag,
  gefactureerdThisQ,
  urenDezeMaand,
  omzetTrendPercentage,
  gefactureerdTrendPercentage,
}: FinancieelGridProps) {
  // Date helpers
  const now = new Date();
  const monthNames = [
    "Jan", "Feb", "Mrt", "Apr", "Mei", "Jun",
    "Jul", "Aug", "Sep", "Okt", "Nov", "Dec",
  ];
  const currentMonth = monthNames[now.getMonth()];
  const currentYear = now.getFullYear();
  const currentQuarter = `Q${Math.ceil((now.getMonth() + 1) / 3)}`;

  // Openstaande offertes subtitle
  const offertesSubtitle =
    openstaandeOffertes === 0
      ? "Geen wachtend"
      : `${openstaandeOffertes} wachtend op reactie`;

  // Openstaand bedrag subtitle (overdue)
  const openstaandSubtitle =
    vervaldeAantal === 0
      ? "Alles op tijd"
      : `${vervaldeAantal} vervallen (€\u00A0${new Intl.NumberFormat("nl-NL", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(vervaldenBedrag)})`;
  const openstaandSubtitleColor =
    vervaldeAantal === 0 ? "text-green-400" : "text-red-400";

  return (
    <section>
      <h2 className="text-xs text-muted-foreground uppercase tracking-widest font-medium mb-2.5">
        Financieel &amp; Operationeel
      </h2>

      <div className="grid grid-cols-3 gap-2">
        {/* 1. Totale Omzet */}
        <MetricCard
          title="Totale Omzet"
          value={totaleOmzet}
          format="currency"
          icon={<Euro className="h-4 w-4" />}
          iconColor="text-green-500"
          trendPercentage={omzetTrendPercentage}
          trendColor="green"
          subtitle={`${currentMonth} ${currentYear}`}
          sparklineData={[10, 15, 12, 20, 18, 25, 30, 28, 35, 40, 38, 45]}
          sparklineColor="#22c55e"
        />

        {/* 2. Actieve Projecten */}
        <MetricCard
          title="Actieve Projecten"
          value={actieveProjecten}
          icon={<FolderKanban className="h-4 w-4" />}
          iconColor="text-orange-500"
          subtitle={`${afgerondeProjecten} afgerond / ${totaalProjecten} totaal`}
        />

        {/* 3. Openstaande Offertes */}
        <MetricCard
          title="Openstaande Offertes"
          value={openstaandeOffertes}
          icon={<FileText className="h-4 w-4" />}
          iconColor="text-blue-500"
          subtitle={offertesSubtitle}
        />

        {/* 4. Openstaand */}
        <MetricCard
          title="Openstaand"
          value={openstaandBedrag}
          format="currency"
          icon={<Receipt className="h-4 w-4" />}
          iconColor="text-amber-500"
          subtitle={openstaandSubtitle}
          subtitleColor={openstaandSubtitleColor}
        />

        {/* 5. Gefactureerd dit Q */}
        <MetricCard
          title="Gefactureerd dit Q"
          value={gefactureerdThisQ}
          format="currency"
          icon={<TrendingUp className="h-4 w-4" />}
          iconColor="text-blue-500"
          trendPercentage={gefactureerdTrendPercentage}
          trendColor="blue"
          subtitle={`${currentQuarter} ${currentYear}`}
          sparklineData={[5, 8, 10, 15, 20, 22, 25, 30]}
          sparklineColor="#3b82f6"
        />

        {/* 6. Uren deze Maand */}
        <MetricCard
          title="Uren deze Maand"
          value={urenDezeMaand}
          icon={<Clock className="h-4 w-4" />}
          iconColor="text-orange-500"
          subtitle="Geregistreerd"
        />
      </div>
    </section>
  );
}
