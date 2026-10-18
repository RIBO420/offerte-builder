"use client";

/**
 * Gedeelde bouwstenen voor de periodeweergaven van het planningsoverzicht
 * (maand, kwartaal, jaar): de kopregel, de werkbalk met vorige/vandaag/volgende,
 * de bezettingslegenda en -balk, en de getalnotatie.
 */

import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCapaciteitKleur } from "./capaciteit-indicator";

export const MAAND_NAMEN = [
  "Januari",
  "Februari",
  "Maart",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Augustus",
  "September",
  "Oktober",
  "November",
  "December",
];

export const MAAND_KORT = [
  "jan",
  "feb",
  "mrt",
  "apr",
  "mei",
  "jun",
  "jul",
  "aug",
  "sep",
  "okt",
  "nov",
  "dec",
];

/** Uren per werkdag waar de queries de capaciteit op baseren. */
export const UREN_PER_DAG = 8;

const getalFormat = new Intl.NumberFormat("nl-NL", {
  maximumFractionDigits: 1,
});

/** Nederlandse notatie, hooguit één decimaal: `1.936`, `17,6`. */
export function formatGetal(waarde: number): string {
  return getalFormat.format(Math.round(waarde * 10) / 10);
}

/** Bezetting in hele procenten, of `null` als er geen capaciteit is. */
export function bezettingPct(gepland: number, beschikbaar: number): number | null {
  return beschikbaar > 0 ? Math.round((gepland / beschikbaar) * 100) : null;
}

/** Werkdagen (ma–vr) in een maand; `maand` is 1–12. */
export function werkdagenInMaand(jaar: number, maand: number): number {
  const laatste = new Date(jaar, maand, 0).getDate();
  let aantal = 0;
  for (let d = 1; d <= laatste; d++) {
    const dag = new Date(jaar, maand - 1, d).getDay();
    if (dag !== 0 && dag !== 6) aantal++;
  }
  return aantal;
}

/** `YYYY-MM-DD` in lokale tijd. */
export function isoDatum(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Enkelvoud of meervoud bij een telling: `1 taak`, `3 taken`. */
export function telwoord(aantal: number, enkel: string, meer: string): string {
  return `${formatGetal(aantal)} ${aantal === 1 ? enkel : meer}`;
}

/**
 * Weekend: schuine arcering naast de tint, zodat "geen gewone werkdag" ook
 * zonder kleur leesbaar is (DESIGN.md, Shapes). Zelfde patroon als het weekbord.
 */
export const WEEKEND_ARCERING =
  "bg-[repeating-linear-gradient(135deg,color-mix(in_oklch,var(--foreground)_4%,transparent)_0_5px,transparent_5px_10px)]";

/** Markering van "nu" (huidige week of maand) in een rij kolommen. */
export const NU_MARKERING = "bg-primary/[0.07] ring-1 ring-inset ring-primary/45";

/**
 * Kopregel boven een periode: `Oktober: 312 van 1.936 uur gepland · 16% bezet`.
 * Elk deel heeft een vet getal en een gedempte staart.
 */
export function SamenvattingRegel({
  label,
  delen,
}: {
  label: string;
  delen: Array<{ sterk: string; staart: string; voor?: string }>;
}) {
  return (
    <p className="text-[15px] text-muted-foreground tabular-nums">
      {label}:{" "}
      {delen.map((deel, i) => (
        <span key={i}>
          {i > 0 && " · "}
          {deel.voor}
          <span className="font-semibold text-foreground">{deel.sterk}</span>
          {deel.staart}
        </span>
      ))}
    </p>
  );
}

/** Werkbalk: vorige / vandaag / volgende, de periodenaam, en rechts iets extra's. */
export function PeriodeWerkbalk({
  titel,
  subtitel,
  vorigeLabel,
  volgendeLabel,
  vandaagLabel,
  onVorige,
  onVolgende,
  onVandaag,
  children,
}: {
  titel: string;
  subtitel?: string;
  vorigeLabel: string;
  volgendeLabel: string;
  vandaagLabel: string;
  onVorige: () => void;
  onVolgende: () => void;
  onVandaag: () => void;
  children?: ReactNode;
}) {
  const knop =
    "grid h-11 place-items-center bg-transparent text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:h-9";
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex shrink-0 overflow-hidden rounded-md border">
          <button
            type="button"
            onClick={onVorige}
            aria-label={vorigeLabel}
            className={cn(knop, "w-11 sm:w-9")}
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onVandaag}
            className={cn(knop, "border-x px-3 text-[13px] font-medium text-foreground")}
          >
            {vandaagLabel}
          </button>
          <button
            type="button"
            onClick={onVolgende}
            aria-label={volgendeLabel}
            className={cn(knop, "w-11 sm:w-9")}
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
        <h2 className="min-w-0 truncate font-display text-lg font-semibold tracking-tight" aria-live="polite">
          {titel}
          {subtitel && (
            <span className="ml-1.5 font-sans text-[15px] font-normal text-muted-foreground">
              {subtitel}
            </span>
          )}
        </h2>
      </div>
      {children}
    </div>
  );
}

const LEGENDA = [
  { label: "tot 70%", pct: 0 },
  { label: "70–90%", pct: 80 },
  { label: "boven 90%", pct: 100 },
];

/** Legenda van de drie bezettingsstappen; de tekst draagt de betekenis, niet alleen de kleur. */
export function BezettingLegenda({ className }: { className?: string }) {
  return (
    <ul
      aria-label="Legenda bezetting"
      className={cn("flex flex-wrap gap-x-3.5 gap-y-1 text-xs text-muted-foreground", className)}
    >
      {LEGENDA.map((stap) => (
        <li key={stap.label} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className={cn("h-1 w-3.5 rounded-full", getCapaciteitKleur(stap.pct).fill)}
          />
          {stap.label}
        </li>
      ))}
    </ul>
  );
}

/** Horizontale bezettingsbalk; decoratief, het percentage staat er altijd als tekst bij. */
export function BezettingBalk({
  pct,
  className,
}: {
  pct: number;
  className?: string;
}) {
  return (
    <span aria-hidden className={cn("block h-1 overflow-hidden rounded-full bg-muted", className)}>
      {pct > 0 && (
        <span
          className={cn("block h-full rounded-full", getCapaciteitKleur(pct).fill)}
          style={{ width: `${Math.min(Math.max(pct, 2), 100)}%` }}
        />
      )}
    </span>
  );
}
