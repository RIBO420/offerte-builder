"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { formatCurrency, formatKwartaalJaar } from "@/lib/format";

/**
 * De cijferstrook: hoe staat de zaak ervoor?
 *
 * Eén balk in plaats van vier losse kaarten. Vier kaarten met dezelfde rand,
 * dezelfde padding en dezelfde tekstgrootte lezen als "alles is even
 * belangrijk"; één instrument met hairline-scheidingen leest als één antwoord
 * met vier wijzers — en scheelt ook nog een rij marges.
 *
 * De hairlines komen uit `gap-px` op een `bg-border`-vlak: dat tekent in élke
 * rasterstand een sluitende scheiding, ook als de balk van 4 naar 2 naar 1
 * kolom vouwt. Met `divide-x` zou de streep bij het vouwen op de verkeerde
 * cellen belanden.
 *
 * Omzet is het enige heldcijfer van de pagina (Fraunces); de rest is bewust
 * stiller. Sparklines zijn hier weg en komen niet terug: de vorige versie
 * tekende hardgecodeerde trenddata onder een echt getal.
 */

// ── Trendchip ───────────────────────────────────────────────────────────────
//
// De kleur volgt de richting van het cijfer, niet de huisstijl van de kaart:
// een omzet van −21% mag nooit groen ogen. De status-tokenparen (bg + text)
// zijn de enige AA-geverifieerde tintcombinaties, dus die lenen we hier.

export function TrendChip({ pct, label }: { pct: number; label: string }) {
  const chipClass =
    pct > 0
      ? "bg-status-geaccepteerd text-status-geaccepteerd-text"
      : pct < 0
        ? "bg-status-vervallen text-status-vervallen-text"
        : "bg-muted text-muted-foreground";

  return (
    <span
      className={`${chipClass} inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums`}
      title={label}
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
      {pct}%<span className="sr-only"> {label}</span>
    </span>
  );
}

/** Verschil in procenten tussen twee perioden; 0 → 0, van niets naar iets → 100. */
export function berekenVerschilPct(huidig?: number, vorig?: number): number {
  if (!huidig || !vorig || vorig === 0) return huidig && huidig > 0 ? 100 : 0;
  return Math.round(((huidig - vorig) / vorig) * 100);
}

// ── Cel ─────────────────────────────────────────────────────────────────────

function Cel({
  label,
  href,
  span,
  waarde,
  format = "currency",
  groot = false,
  voet,
  chip,
}: {
  label: string;
  /** De lijst die dit cijfer bewijst. Elk blok klikt door. */
  href: string;
  span: string;
  waarde: number;
  format?: "currency" | "number";
  groot?: boolean;
  voet: ReactNode;
  chip?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`group flex flex-col gap-1 bg-card px-3 py-2.5 transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${span}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </span>
        {groot && chip}
      </div>

      <AnimatedNumber
        value={waarde}
        prefix={format === "currency" ? "€ " : ""}
        formatOptions={{ minimumFractionDigits: 0, maximumFractionDigits: 0 }}
        locale="nl-NL"
        className={
          groot
            ? // Het enige heldcijfer van de pagina.
              "font-display text-[34px] leading-none font-semibold tracking-tight tabular-nums @[52rem]/cijfers:text-[40px]"
            : "text-[22px] leading-none font-bold tracking-tight tabular-nums"
        }
      />

      {/* mt-auto: de voetregels van alle vier de cellen liggen op één lijn,
          ongeacht hoe hoog het cijfer erboven is. */}
      <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-1 text-[11px] leading-4">
        {voet}
        {!groot && chip}
      </div>
    </Link>
  );
}

// ── Cijferbalk ──────────────────────────────────────────────────────────────

export interface CijferbalkProps {
  /** Getekende omzet incl. btw, alle tijd (gedeelde omzetdefinitie). */
  getekendeOmzet: number;
  omzetTrendPct: number;
  openstaandBedrag: number;
  vervaldeAantal: number;
  vervaldenBedrag: number;
  gefactureerdDitKwartaal: number;
  gefactureerdTrendPct: number;
  actieveProjecten: number;
  afgerondeProjecten: number;
  totaalProjecten: number;
}

export function Cijferbalk({
  getekendeOmzet,
  omzetTrendPct,
  openstaandBedrag,
  vervaldeAantal,
  vervaldenBedrag,
  gefactureerdDitKwartaal,
  gefactureerdTrendPct,
  actieveProjecten,
  afgerondeProjecten,
  totaalProjecten,
}: CijferbalkProps) {
  const kwartaalLabel = formatKwartaalJaar(new Date());

  return (
    <section
      aria-label="Kerncijfers"
      className="@container/cijfers overflow-hidden rounded-lg border bg-card"
    >
      <div className="grid grid-cols-1 gap-px bg-border @[26rem]/cijfers:grid-cols-2 @[52rem]/cijfers:grid-cols-12">
        <Cel
          label="Getekende omzet"
          href="/rapportages"
          span="@[52rem]/cijfers:col-span-5"
          waarde={getekendeOmzet}
          groot
          voet={<span className="text-muted-foreground">alle tijd, incl. btw</span>}
          chip={
            <TrendChip
              pct={omzetTrendPct}
              label={`getekend dit kwartaal t.o.v. vorig kwartaal`}
            />
          }
        />

        <Cel
          label="Openstaand"
          href="/facturen"
          span="@[52rem]/cijfers:col-span-3"
          waarde={openstaandBedrag}
          voet={
            vervaldeAantal === 0 ? (
              <span className="text-status-geaccepteerd-text">Alles op tijd</span>
            ) : (
              <span className="text-status-vervallen-text">
                {vervaldeAantal} vervallen ({formatCurrency(vervaldenBedrag, "nl-NL", false)})
              </span>
            )
          }
        />

        <Cel
          label="Gefactureerd"
          href="/facturen"
          span="@[52rem]/cijfers:col-span-2"
          waarde={gefactureerdDitKwartaal}
          voet={<span className="text-muted-foreground tabular-nums">{kwartaalLabel}</span>}
          chip={
            <TrendChip
              pct={gefactureerdTrendPct}
              label="t.o.v. vorig kwartaal"
            />
          }
        />

        <Cel
          label="Actieve projecten"
          href="/projecten"
          span="@[52rem]/cijfers:col-span-2"
          waarde={actieveProjecten}
          format="number"
          voet={
            <span className="text-muted-foreground tabular-nums">
              {afgerondeProjecten} afgerond / {totaalProjecten} totaal
            </span>
          }
        />
      </div>
    </section>
  );
}
