"use client";

/**
 * De trechter: gecentreerde, versmallende stappen met verbindingsvlakken —
 * een échte funnelvorm, als opvolger van de linkse staafjes van `trap-staven`
 * (die lazen als progressbars; melding Ricardo 17 aug).
 *
 * Bewust geen recharts: dit is een vorm van vier gecentreerde vlakken en drie
 * verbindingsstukken, geen assenstelsel. Puur HTML + één klein SVG-vlak per
 * verbinding, dus statisch importeerbaar (geen 200 KB chunk) en hij drukt af
 * zoals hij op het scherm staat.
 *
 * Dataviz-regels die hier gelden:
 * - Geordende stappen → één kleur (`--chart-1`) in aflopende dekking, geen
 *   vier identiteitskleuren.
 * - Vergelijk op *breedte* vanaf een gedeeld midden; de conversie tussen twee
 *   stappen staat in taal in het verbindingsstuk — dát is het cijfer waar het
 *   om gaat, en zo is kleur nooit de enige drager.
 * - Elke stap draagt zijn aantal als tekst in of naast het vlak.
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface TrechterStap {
  sleutel: string;
  /** Mensentaal; de ruwe statussleutel hoort hier nooit in beeld. */
  label: string;
  waarde: number;
  waardeTekst: string;
  /** De conversie-zin die in het verbindingsstuk bóven deze stap staat. */
  conversie?: ReactNode;
  href?: string;
}

/** Minimale vlakbreedte: een stap van 0 leest anders als "ontbreekt". */
const MIN_BREEDTE = 14;
const STAP_HOOGTE = 44;
const VERBINDING_HOOGTE = 26;

function breedtePct(waarde: number, noemer: number): number {
  if (waarde <= 0) return MIN_BREEDTE;
  return Math.max(MIN_BREEDTE, Math.round((waarde / noemer) * 100));
}

export function TrechterDiagram({
  stappen,
  className,
}: {
  stappen: TrechterStap[];
  className?: string;
}) {
  const noemer = Math.max(1, ...stappen.map((stap) => Math.max(0, stap.waarde)));

  return (
    <ol className={cn("mx-auto max-w-[34rem]", className)}>
      {stappen.map((stap, index) => {
        const breedte = breedtePct(stap.waarde, noemer);
        const vorige = index > 0 ? breedtePct(stappen[index - 1].waarde, noemer) : breedte;
        const dekking = Math.max(0.4, 1 - index * 0.16);
        // Wit op het vlak alleen zolang het vlak vol genoeg is; daaronder
        // donkere tekst naast het vlak. Contrast eerst, esthetiek tweede.
        const tekstInVlak = dekking >= 0.65 && breedte >= 34;

        return (
          <li key={stap.sleutel}>
            {index > 0 && (
              <div
                className="relative"
                style={{ height: VERBINDING_HOOGTE }}
                aria-hidden="true"
              >
                <svg
                  className="absolute inset-0 h-full w-full"
                  viewBox="0 0 100 10"
                  preserveAspectRatio="none"
                >
                  <polygon
                    points={`${50 - vorige / 2},0 ${50 + vorige / 2},0 ${50 + breedte / 2},10 ${50 - breedte / 2},10`}
                    fill="var(--chart-1)"
                    opacity={0.12}
                  />
                </svg>
                {stap.conversie && (
                  <p className="absolute inset-0 flex items-center justify-center text-[11px] text-muted-foreground">
                    {stap.conversie}
                  </p>
                )}
              </div>
            )}

            <div className="relative" style={{ height: STAP_HOOGTE }}>
              <div
                className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 rounded-md"
                style={{
                  width: `${breedte}%`,
                  backgroundColor: "var(--chart-1)",
                  opacity: dekking,
                }}
                aria-hidden="true"
              />
              <div
                className={cn(
                  "absolute inset-0 flex items-center justify-center gap-2 px-2 text-sm",
                  tekstInVlak ? "text-white" : "text-foreground"
                )}
              >
                <span className="min-w-0 truncate font-medium" title={stap.label}>
                  {stap.href ? (
                    <a
                      href={stap.href}
                      className="underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      {stap.label}
                    </a>
                  ) : (
                    stap.label
                  )}
                </span>
                <span
                  className={cn(
                    "shrink-0 tabular-nums",
                    tekstInVlak ? "text-white/85" : "text-muted-foreground"
                  )}
                >
                  {stap.waardeTekst}
                </span>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
