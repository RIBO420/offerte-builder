"use client";

import type { ReactNode } from "react";
import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Hoeveel gewicht deze sectie in de pagina mag innemen.
 *
 * Eén frame zeven keer herhalen leest als "alles is even belangrijk" — precies
 * de klacht over het klantdossier. Daarom drie klassen in plaats van één:
 *
 * - `primair`   werkstroom (taken, tijdlijn): een écht oppervlak dat van de
 *               pagina afstapt (`--surface-primair`, ≥1,25:1) en een kopje dat
 *               niet gedempt is.
 * - `secundair` naslag (onderhoud, offertes, facturen, dossiergegevens). Dit is
 *               de **default**: bestaande aanroepers houden hun paneel.
 * - `voetnoot`  een sectie zonder inhoud. Geen doos: één regel binnen het frame
 *               eromheen. Een lege sectie mag nooit groter zijn dan een gevulde.
 */
export type SectieGewicht = "primair" | "secundair" | "voetnoot";

/** Lege staat als één regel áchter het kopje — zie `legeRegel`. */
export interface SectieLegeRegel {
  tekst: string;
  /** WS7-hint: wat hier komt te staan en wat de volgende stap is. */
  hint?: string;
}

const FRAME: Record<SectieGewicht, string> = {
  // `shadow-sm` i.p.v. `shadow-xs`: het vlak is een werkblad dat op de pagina
  // ligt, niet een vlek erin. Een aanroeper die een ánder werkvlak wil (de
  // dagstaat zet "Aandacht nodig" op `bg-surface-aandacht`) overschrijft
  // alleen de bg-class via `className` — tailwind-merge laat die winnen.
  primair: "overflow-hidden rounded-lg border bg-surface-primair shadow-sm",
  secundair: "overflow-hidden rounded-lg border bg-card",
  // Geen doos en geen eigen vlak: de voetnoot leunt op het frame waar hij in
  // staat (het dossierpaneel) en is daarbinnen één rij.
  voetnoot: "bg-transparent",
};

const KOP: Record<SectieGewicht, string> = {
  primair: "flex items-center gap-2 border-b px-3 py-2",
  // Gevulde naslag verdient een zichtbare kop: zonder tint is het verschil met
  // een voetnoot toeval in plaats van een keuze.
  secundair: "flex items-center gap-2 border-b bg-muted/40 px-3 py-2",
  voetnoot: "flex items-center gap-2 px-3 py-2",
};

const TITEL: Record<SectieGewicht, string> = {
  primair:
    "shrink-0 text-[13px] leading-4 font-semibold tracking-tight text-foreground",
  secundair:
    "shrink-0 text-xs leading-4 font-medium uppercase tracking-wide text-muted-foreground",
  voetnoot:
    "shrink-0 text-xs leading-4 font-medium uppercase tracking-wide text-muted-foreground",
};

/**
 * Kopbalkvariant (klantdossier v7): de titelregel als lichte balk boven de
 * inhoud — 1px onderrand, iets lichter vlak, en de titel als échte kop in
 * plaats van een gedempt labeltje. Bedoeld voor de dossiertabs, waar per tab
 * één tot drie panelen staan en de kop het onderwerp van het scherm aankondigt
 * in plaats van een sectie in een stapel te markeren.
 *
 * Los van `gewicht` gehouden: die as gaat over hoeveel gewicht een sectie in
 * een stapel heeft, deze over de vórm van de kop. Zonder de prop verandert er
 * niets — bestaande aanroepers houden hun paneel exact zoals het was.
 */
const KOP_BALK = "flex items-center gap-2 border-b bg-muted/40 px-3 py-2.5";
const TITEL_BALK =
  "shrink-0 font-display text-[15px] leading-5 font-semibold tracking-tight text-foreground";

/**
 * Sectiepaneel voor werkschermen. Bewust géén <Card>: die brengt een eigen
 * kop-, padding- en schaduwlaag mee, en meerdere Cards onder elkaar lezen als
 * losse eilanden. Eén rand met een klein kopje houdt een dossier rustig.
 *
 * `gewicht` en `legeRegel` zijn additief: wie ze weglaat krijgt het paneel
 * zoals het altijd was.
 */
export function SectiePaneel({
  id,
  titel,
  icoon,
  telling,
  uitleg,
  acties,
  gewicht = "secundair",
  kopbalk = false,
  legeRegel,
  children,
  className,
}: {
  /** Anker om deze sectie aan te kunnen wijzen (focus, scrollIntoView, `#id`). */
  id?: string;
  titel: string;
  icoon?: ReactNode;
  /** Klein getal rechts van de titel (open taken, aantal entries). */
  telling?: number;
  /**
   * Waar deze sectie voor is. Hangt achter een info-icoon in de kop in plaats
   * van als alinea in beeld te staan: uitleg lees je één keer, daarna is het
   * ruimte die je elke dag kwijt bent.
   */
  uitleg?: ReactNode;
  /** Compacte knoppen/filters rechts in de kop. */
  acties?: ReactNode;
  /** Zie {@link SectieGewicht}. Default = de oude weergave. */
  gewicht?: SectieGewicht;
  /** Titelregel als lichte kopbalk — zie {@link KOP_BALK}. Default uit. */
  kopbalk?: boolean;
  /**
   * Is de sectie leeg, dan hoort dat één regel te zijn — op dezelfde basislijn
   * als het kopje, niet als blok eronder. Zelfde lettergrootte en `leading` als
   * de titel, dus de twee liggen exact op één lijn. Loopt de regel niet uit,
   * dan kort hij in; de volle tekst blijft in `title` staan (nooit zijwaarts
   * scrollen).
   */
  legeRegel?: SectieLegeRegel;
  children?: ReactNode;
  className?: string;
}) {
  return (
    // @container: de sectie staat in een smalle kolom, niet in de viewport —
    // breakpoints moeten dus op de containerbreedte reageren, niet op het scherm.
    <section id={id} className={cn("@container/sectie", FRAME[gewicht], className)}>
      <header className={kopbalk ? KOP_BALK : KOP[gewicht]}>
        {icoon && (
          <span className="shrink-0 text-muted-foreground [&>svg]:size-3.5">
            {icoon}
          </span>
        )}
        <h2
          className={cn(
            kopbalk ? TITEL_BALK : TITEL[gewicht],
            // Vaste minimumbreedte zodra er een lege regel naast staat: dan
            // beginnen die regels in álle secties op dezelfde x en leest de
            // stapel als één uitgelijnde kolom.
            legeRegel && "min-w-[4.5rem]"
          )}
        >
          {titel}
        </h2>
        {typeof telling === "number" && telling > 0 && (
          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
            {telling}
          </span>
        )}
        {uitleg && (
          <Tooltip>
            {/* asChild: de trigger moet de knop zijn, niet een extra span —
                anders is de uitleg niet met Tab te bereiken. */}
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={`Wat is ${titel.toLowerCase()}?`}
                // p-1.5 om het 14px-icoon: klikvlak 26px (≥24px, WCAG 2.5.8).
                // De negatieve marge houdt de koplayout exact gelijk.
                className="shrink-0 -m-1.5 rounded p-1.5 text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <Info className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-[36ch] text-pretty">
              {uitleg}
            </TooltipContent>
          </Tooltip>
        )}
        {legeRegel && (
          <p
            title={
              legeRegel.hint
                ? `${legeRegel.tekst} ${legeRegel.hint}`
                : legeRegel.tekst
            }
            className="min-w-0 flex-1 truncate text-xs leading-4 text-muted-foreground"
          >
            <span className="font-medium text-foreground">
              {legeRegel.tekst}
            </span>
            {legeRegel.hint && (
              <span className="ml-1.5">{legeRegel.hint}</span>
            )}
          </p>
        )}
        {acties && (
          <div className="ml-auto flex min-w-0 items-center gap-1">{acties}</div>
        )}
      </header>
      {children}
    </section>
  );
}

/**
 * Lege staat als blok: één regel, meer niet. Voor secties die géén kop hebben
 * om achter te schuiven — de tijdlijn in de Chat-module bijvoorbeeld. Staat er
 * wél een kop, gebruik dan `legeRegel` op `SectiePaneel`: dan blijft de lege
 * sectie één regel hoog in plaats van een blok van 90px.
 *
 * De uitleg over waar de sectie voor dient hoort in de `uitleg`-tooltip — die
 * lees je één keer, terwijl een alinea in beeld elke dag ruimte kost.
 *
 * `hint` is de uitzondering voor secties die zichzelf vullen of hun actie
 * elders hebben: één gedempte vervolgregel die zegt wat hier verschijnt en
 * wat de eerstvolgende actie is. Mét hint krijgt de eerste regel de
 * titel-toon van `EmptyState compact` (foreground, medium), zodat de hint
 * gedempt kán zijn zonder onder 4,5:1 contrast te zakken.
 */
export function SectieLegeStaat({
  tekst,
  hint,
}: {
  tekst: string;
  hint?: string;
}) {
  return (
    <p className="px-3 py-3 text-xs text-muted-foreground">
      {hint ? (
        <span className="font-medium text-foreground">{tekst}</span>
      ) : (
        tekst
      )}
      {hint && <span className="mt-0.5 block">{hint}</span>}
    </p>
  );
}
