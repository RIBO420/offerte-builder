"use client";

import { Cel, Cijferstrip } from "@/components/ui/cijferstrip";
import { formatCurrency, formatKwartaalJaar } from "@/lib/format";

/**
 * De geldcijfers van de dagstaat: hoe staat de zaak ervoor?
 *
 * Eén instrument met hairline-scheidingen in plaats van losse kaarten. Het
 * frame zelf (`Cijferstrip` + `Cel`) staat in `@/components/ui/cijferstrip`,
 * zodat het klantdossier dezelfde strook gebruikt. Hier blijft staan wat over
 * het dashboard gaat: welke cijfers, en hoe ze verdelen.
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

// ── Cijferkolom (dashboard A) ───────────────────────────────────────────────

export interface CijferKolomProps {
  /** Getekende omzet incl. btw, alle tijd (gedeelde omzetdefinitie). */
  getekendeOmzet: number;
  omzetTrendPct: number;
  openstaandBedrag: number;
  vervaldeAantal: number;
  vervaldenBedrag: number;
  gefactureerdDitKwartaal: number;
  gefactureerdTrendPct: number;
}

/**
 * De geldcijfers als blok bovenaan de geldkolom: het heldcijfer over de volle
 * breedte, openstaand en gefactureerd eronder naast elkaar. Actieve projecten
 * staan hier niet meer: dat is werk, en hoort in de kop van "Lopend werk".
 *
 * Een trendchip van 0% zegt niets en kost wel aandacht; die valt weg.
 */
export function CijferKolom({
  getekendeOmzet,
  omzetTrendPct,
  openstaandBedrag,
  vervaldeAantal,
  vervaldenBedrag,
  gefactureerdDitKwartaal,
  gefactureerdTrendPct,
}: CijferKolomProps) {
  const kwartaalLabel = formatKwartaalJaar(new Date());

  return (
    <Cijferstrip label="Kerncijfers" className="@container/cijfers" kolommen="grid-cols-2">
      <Cel
        label="Getekende omzet"
        href="/rapportages"
        span="col-span-2 px-4 py-4"
        waarde={getekendeOmzet}
        waardeClassName="text-[42px]"
        groot
        voet={<span className="text-muted-foreground">alle tijd, incl. btw</span>}
        chip={
          omzetTrendPct !== 0 ? (
            <TrendChip
              pct={omzetTrendPct}
              label="getekend dit kwartaal t.o.v. vorig kwartaal"
            />
          ) : undefined
        }
      />

      <Cel
        label="Openstaand"
        href="/facturen"
        span="px-4"
        waarde={openstaandBedrag}
        voet={
          vervaldeAantal === 0 ? (
            <span className="text-status-geaccepteerd-text">Alles op tijd</span>
          ) : (
            <span className="text-status-vervallen-text tabular-nums">
              {vervaldeAantal} vervallen · {formatCurrency(vervaldenBedrag, "nl-NL", false)}
            </span>
          )
        }
      />

      <Cel
        label="Gefactureerd"
        href="/facturen"
        span="px-4"
        waarde={gefactureerdDitKwartaal}
        voet={<span className="text-muted-foreground tabular-nums">{kwartaalLabel}</span>}
        chip={
          gefactureerdTrendPct !== 0 ? (
            <TrendChip pct={gefactureerdTrendPct} label="t.o.v. vorig kwartaal" />
          ) : undefined
        }
      />
    </Cijferstrip>
  );
}
