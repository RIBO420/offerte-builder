"use client";

import { Cel, Cijferstrip } from "@/components/ui/cijferstrip";
import { formatCurrency, formatKwartaalJaar } from "@/lib/format";

/**
 * De cijferstrook: hoe staat de zaak ervoor?
 *
 * Eén balk in plaats van vier losse kaarten. Vier kaarten met dezelfde rand,
 * dezelfde padding en dezelfde tekstgrootte lezen als "alles is even
 * belangrijk"; één instrument met hairline-scheidingen leest als één antwoord
 * met vier wijzers — en scheelt ook nog een rij marges.
 *
 * Het frame zelf (`Cijferstrip` + `Cel`, inclusief de gap-px-hairlines) is
 * losgetrokken naar `@/components/ui/cijferstrip` zodat het klantdossier
 * dezelfde strook gebruikt in plaats van hem na te bouwen. Hier blijft staan
 * wat over het dashboard gaat: welke vier cijfers, en hoe ze verdelen.
 *
 * Omzet is het enige heldcijfer van de pagina (Outfit); de rest is bewust
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
    <Cijferstrip
      label="Kerncijfers"
      className="@container/cijfers"
      kolommen="grid-cols-1 @[26rem]/cijfers:grid-cols-2 @[52rem]/cijfers:grid-cols-12"
    >
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
    </Cijferstrip>
  );
}
