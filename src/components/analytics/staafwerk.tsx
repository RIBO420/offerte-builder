"use client";

/**
 * Vorm 1 van het grafiekdieet (R3): de horizontale staaf als ranglijst.
 *
 * Bewust géén recharts. Een ranglijst van hooguit tien regels met Nederlandse
 * labels ("Water & elektra", "Familie Van der Meulen") heeft geen assenstelsel
 * nodig, en juist recharts maakte hier de grootste puinhoop: de oude
 * `ScopeMarginChart` tekende negen balken van exact 232 px omdat elke scope
 * hetzelfde percentage kreeg, en de labels stonden er rauw en gekanteld naast.
 *
 * Een regel = label, waarde en staaf onder elkaar. Dat kan niet zijwaarts
 * scrollen (harde regel 1), houdt de tekst horizontaal leesbaar, kost geen
 * 200 KB aan bundel en drukt af zoals het op het scherm staat.
 *
 * Kleur (R4): Loof-groen is de hoofdreeks, terracotta uitsluitend voor regels
 * die aandacht vragen. Beide via `var(--chart-N)`; `hsl(var(--chart-N))` is
 * ongeldige CSS op onze oklch-tokens en gaf zwarte grafieken.
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface StaafRegel {
  sleutel: string;
  label: string;
  /** Bepaalt de lengte van de staaf; altijd ≥ 0. */
  waarde: number;
  /** Rechts van het label, klaar geformatteerd. */
  waardeTekst: string;
  /** Eén gedempte regel eronder: context, geen tweede getal-competitie. */
  bijschrift?: ReactNode;
  /** Terracotta in plaats van groen — verlies, achterstand, risico. */
  vraagtAandacht?: boolean;
  /** Maakt van de hele regel een link naar de brondata. */
  href?: string;
}

export function RangStaven({
  regels,
  /** Zelf een noemer meegeven als de staaflengte een aandeel moet tonen. */
  maximum,
  className,
}: {
  regels: StaafRegel[];
  maximum?: number;
  className?: string;
}) {
  const noemer =
    maximum ?? Math.max(1, ...regels.map((r) => Math.abs(r.waarde)));

  return (
    <ul className={cn("space-y-3.5", className)}>
      {regels.map((regel) => {
        const breedte = Math.max(
          // Minimaal 2%: een staaf van 0 px leest als "ontbreekt" in plaats van
          // "bijna niets".
          regel.waarde > 0 ? 2 : 0,
          Math.round((Math.abs(regel.waarde) / noemer) * 100)
        );
        const inhoud = (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-sm" title={regel.label}>
                {regel.label}
              </span>
              <span
                className={cn(
                  "shrink-0 text-sm font-medium tabular-nums",
                  regel.vraagtAandacht && "text-[var(--chart-2)]"
                )}
              >
                {regel.waardeTekst}
              </span>
            </div>
            <div
              className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted"
              aria-hidden="true"
            >
              <div
                className="h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none"
                style={{
                  width: `${breedte}%`,
                  backgroundColor: regel.vraagtAandacht
                    ? "var(--chart-2)"
                    : "var(--chart-1)",
                }}
              />
            </div>
            {regel.bijschrift && (
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {regel.bijschrift}
              </p>
            )}
          </>
        );

        return (
          <li key={regel.sleutel}>
            {regel.href ? (
              <a
                href={regel.href}
                className="-mx-2 block rounded-md px-2 py-1 transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {inhoud}
              </a>
            ) : (
              inhoud
            )}
          </li>
        );
      })}
    </ul>
  );
}

export interface StapelDeel {
  sleutel: string;
  label: string;
  waarde: number;
  waardeTekst: string;
  vraagtAandacht?: boolean;
}

/**
 * Eén balk die in stukken uiteenvalt — voor een verdeling waarvan het totaal
 * de eigenlijke boodschap is (openstaand geld per ouderdom). Vervangt de donut
 * uit de oude Projecten-tab: dezelfde informatie, zonder dat je hoeken moet
 * schatten, en met de legenda als leesbare lijst eronder.
 */
export function StapelBalk({
  delen,
  className,
}: {
  delen: StapelDeel[];
  className?: string;
}) {
  const totaal = delen.reduce((som, deel) => som + Math.max(0, deel.waarde), 0);
  const zichtbaar = delen.filter((deel) => deel.waarde > 0);
  if (totaal <= 0 || zichtbaar.length === 0) return null;

  return (
    <div className={className}>
      <div
        className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full"
        aria-hidden="true"
      >
        {zichtbaar.map((deel, index) => (
          <div
            key={deel.sleutel}
            style={{
              width: `${(deel.waarde / totaal) * 100}%`,
              backgroundColor: deel.vraagtAandacht
                ? "var(--chart-2)"
                : "var(--chart-1)",
              // Gedempter naarmate het deel verder van "aandacht" af staat, zodat
              // één balk toch vier onderscheidbare stukken heeft zonder een
              // tweede kleurenfamilie te introduceren.
              opacity: deel.vraagtAandacht ? 1 - index * 0.12 : 0.45,
            }}
          />
        ))}
      </div>
      <dl className="mt-3 grid gap-x-6 gap-y-1.5 @min-[26rem]/blok:grid-cols-2">
        {delen.map((deel) => (
          <div
            key={deel.sleutel}
            className="flex items-baseline justify-between gap-3 text-sm"
          >
            <dt className="min-w-0 truncate text-muted-foreground">
              {deel.label}
            </dt>
            <dd
              className={cn(
                "shrink-0 font-medium tabular-nums",
                deel.vraagtAandacht && deel.waarde > 0 && "text-[var(--chart-2)]"
              )}
            >
              {deel.waardeTekst}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
