"use client";

/**
 * De kop van de Controlekamer is de samenvatting, geen etiket.
 *
 * De oude pagina heette "Uren Overzicht — Bekijk alle geregistreerde uren…" met
 * daaronder "Deze Week 0,0" als heldcijfer. Dat is een naam plus een nul: het
 * zegt niet of er iets aan de hand is. Hier staat in één zin wat kantoor moet
 * doen — hetzelfde recept als `DagstaatKop` op het dashboard en de vraagkoppen
 * bij rapportages.
 */

import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface WeekStand {
  /** Dagen die op een blik van kantoor wachten. */
  afwijkend: number;
  /** Mensen met een ontbrekende dag. */
  achter: number;
  /** Ingediende dagen zonder bijzonderheden. */
  stil: number;
}

export interface WeekClausule {
  getal: string;
  staart: string;
}

/**
 * Bouwt de samenvattingszin. Pure functie, dus de formulering is te testen
 * zonder de pagina te renderen.
 *
 * Regels: nul is nooit een clausule, behalve als álles nul is — dan is de lege
 * zin juist het bericht dat je wilt lezen ("niets wacht op je blik"). Enkelvoud
 * en meervoud kloppen, en de zin heeft nooit meer dan drie clausules.
 */
export function weekClausules(stand: WeekStand): WeekClausule[] {
  const clausules: WeekClausule[] = [];

  if (stand.afwijkend > 0) {
    clausules.push({
      getal: String(stand.afwijkend),
      staart:
        stand.afwijkend === 1
          ? "dag wacht op je blik"
          : "dagen wachten op je blik",
    });
  }
  if (stand.achter > 0) {
    clausules.push({
      getal: String(stand.achter),
      staart: stand.achter === 1 ? "iemand is achter" : "mensen zijn achter",
    });
  }
  if (stand.stil > 0) {
    clausules.push({
      getal: String(stand.stil),
      staart: stand.stil === 1 ? "dag kan door" : "dagen kunnen door",
    });
  }
  if (clausules.length === 0) {
    clausules.push({ getal: "niets", staart: "wacht op je blik" });
  }
  return clausules;
}

/** Platte tekst — voor `aria-label`, tests en tooltips. */
export function weekZin(weekLabel: string, stand: WeekStand): string {
  const staart = weekClausules(stand)
    .map((c) => `${c.getal} ${c.staart}`)
    .join(", ");
  return `${weekLabel} — ${staart}.`;
}

/**
 * De ondertitel zegt wat de volgende stap is, niet wat de pagina heet. Zolang er
 * nog werk ligt is de export een belofte; daarna een uitnodiging.
 */
export function exportRegel(stand: WeekStand): string {
  if (stand.afwijkend === 0 && stand.achter === 0) {
    return "De week is compleet — de export naar loon kan door.";
  }
  return "De export naar loon kan zodra beide lijsten leeg zijn.";
}

export function ControlekamerKop({
  weekLabel,
  periodeLabel,
  stand,
  isDezeWeek,
  onVorige,
  onVolgende,
  onDezeWeek,
  acties,
}: {
  /** "Week 33" — de korte naam vóór het gedachtestreepje. */
  weekLabel: string;
  /** "10 t/m 16 augustus" — in de regel onder de zin. */
  periodeLabel: string;
  stand: WeekStand;
  isDezeWeek: boolean;
  onVorige: () => void;
  onVolgende: () => void;
  onDezeWeek: () => void;
  /** Rechts in de kop: de ExportDropdown. */
  acties?: ReactNode;
}) {
  const clausules = weekClausules(stand);

  return (
    <div className="@container/urenkop">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          {/* De getallen in foreground, de rest gedempt: je kunt de zin scannen
              zonder hem te lezen. */}
          <h1
            className="font-display min-w-0 text-pretty text-[19px] leading-7 font-semibold tracking-tight @[40rem]/urenkop:text-[24px] @[40rem]/urenkop:leading-8"
            title={weekZin(weekLabel, stand)}
          >
            {weekLabel}
            {clausules.map((clausule, i) => (
              <span
                key={clausule.staart}
                className="font-normal text-muted-foreground"
              >
                {i === 0 ? " — " : ", "}
                <span className="font-semibold text-foreground tabular-nums">
                  {clausule.getal}
                </span>{" "}
                {clausule.staart}
              </span>
            ))}
            <span className="font-normal text-muted-foreground">.</span>
          </h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            {periodeLabel} · {exportRegel(stand)}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={onVorige}
              aria-label="Vorige week"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 font-normal"
              onClick={onDezeWeek}
              disabled={isDezeWeek}
            >
              Deze week
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={onVolgende}
              aria-label="Volgende week"
            >
              <ChevronRight className="size-4" aria-hidden />
            </Button>
          </div>
          {acties}
        </div>
      </div>
    </div>
  );
}
