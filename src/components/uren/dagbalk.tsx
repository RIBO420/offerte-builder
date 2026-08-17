"use client";

/**
 * De dagbalk — dé representatie van een werkdag.
 *
 * Eén werkdag als gekleurde blokken op een tijd-as. Waar een tabelrij "8,5 uur"
 * zegt, laat de balk in een halve seconde zien wat er ontbreekt: geen pauze,
 * twee uur reistijd, een gat van half twee tot drie. Hij is bewust één
 * component in twee maten, zodat een dag er in de wachtrij, in een lijst en
 * later in de ploegenfilm exact hetzelfde uitziet:
 *
 * - `hero` (22px, met as-labels) — op de dagkaart, in de inspector;
 * - `mini` (10px, zonder labels) — in lijsten en per ploeglid.
 *
 * **Nooit breder dan de container.** Alle blokken staan absoluut op percentages
 * van de as; er is geen minimumbreedte in px en dus nooit zijwaartse scroll
 * (CLAUDE.md regel 1). Een balk van 180px toont dezelfde dag als een balk van
 * 900px, alleen kleiner.
 *
 * **De as.** Standaard 06:00–18:00, want zo ziet een hoveniersdag eruit. Ligt
 * er een segment buiten dat venster (nachtelijke strooironde, avondklus), dan
 * rékt de as op naar het hele uur eronder/erboven in plaats van het segment af
 * te knippen — de balk liegt nooit over de dag.
 *
 * **Toegankelijkheid.** Elk blok is een `role="img"` met een eigen naam
 * ("werken 07:15–12:00, Dohmen"), óók als tooltip. De balk zelf is een groep
 * met de dag in één zin. Kleur is nergens de enige drager: het gat is
 * gearceerd (`.dagbalk-gat`), en categorie staat als tekst in de legenda en in
 * de inspector.
 */

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  CATEGORIE_LABEL,
  FAMILIE_LABEL,
  familieVanCategorie,
  minutenVanTijd,
  tijdVanMinuten,
  type DagbalkFamilie,
  type DagSegment,
} from "./controle-types";

export type DagbalkFormaat = "hero" | "mini";

/** Kleur per familie. Eén plek, dus overal dezelfde dag in dezelfde kleuren. */
const FAMILIE_VLAK: Record<DagbalkFamilie, string> = {
  werken: "bg-seg-werken",
  reistijd: "bg-seg-reistijd",
  pauze: "bg-seg-pauze",
  indirect: "bg-seg-indirect",
  // Arcering i.p.v. een vol vlak: zie de utility in globals.css.
  gat: "dagbalk-gat",
};

const FORMAAT_BALK: Record<DagbalkFormaat, string> = {
  hero: "h-[22px] rounded-md",
  mini: "h-[10px] rounded",
};

/** Standaardvenster: de hoveniersdag. */
const AS_VAN_STANDAARD = 6 * 60;
const AS_TOT_STANDAARD = 18 * 60;

/** Kleiner dan dit is geen gat maar afronding tussen twee segmenten. */
const GAT_DREMPEL_MINUTEN = 15;

export interface DagbalkBlok {
  familie: DagbalkFamilie;
  beginTijd: string;
  eindTijd: string;
  /** Toegankelijke naam én tooltip. */
  naam: string;
  /** Percentages van de as — nooit buiten 0–100. */
  links: number;
  breedte: number;
}

/**
 * Segmenten → blokken op de as, inclusief de gaten ertussen.
 *
 * Pure functie, los van React: de schaal is de kern van dit component en moet
 * te testen zijn zonder DOM. Ongeldige of omgekeerde tijdvakken vallen weg —
 * beter een blok minder dan een balk die niet klopt.
 */
export function dagbalkBlokken(
  segmenten: DagSegment[],
  opties: {
    asVanMinuten?: number;
    asTotMinuten?: number;
    gatDrempelMinuten?: number;
  } = {}
): { blokken: DagbalkBlok[]; asVan: number; asTot: number } {
  const gatDrempel = opties.gatDrempelMinuten ?? GAT_DREMPEL_MINUTEN;

  const geldig = segmenten
    .map((segment) => {
      const begin = minutenVanTijd(segment.beginTijd);
      const eind = minutenVanTijd(segment.eindTijd);
      if (begin === null || eind === null || eind <= begin) return null;
      return { begin, eind, segment };
    })
    .filter((s): s is { begin: number; eind: number; segment: DagSegment } =>
      Boolean(s)
    )
    .sort((a, b) => a.begin - b.begin);

  // De as rekt op naar hele uren zodra er iets buiten het venster ligt.
  let asVan = opties.asVanMinuten ?? AS_VAN_STANDAARD;
  let asTot = opties.asTotMinuten ?? AS_TOT_STANDAARD;
  for (const { begin, eind } of geldig) {
    if (begin < asVan) asVan = Math.floor(begin / 60) * 60;
    if (eind > asTot) asTot = Math.ceil(eind / 60) * 60;
  }
  const span = Math.max(60, asTot - asVan);

  const plaats = (begin: number, eind: number) => {
    const links = ((begin - asVan) / span) * 100;
    const breedte = ((eind - begin) / span) * 100;
    const geklemdLinks = Math.max(0, Math.min(100, links));
    return {
      links: geklemdLinks,
      // Een segment van vijf minuten op een as van twaalf uur is 0,7% — te
      // dun om te zien. Ondergrens 0,8%, en nooit voorbij de rechterrand.
      breedte: Math.max(
        0.8,
        Math.min(100 - geklemdLinks, breedte)
      ),
    };
  };

  const blokken: DagbalkBlok[] = [];
  let vorigEind: number | null = null;

  for (const { begin, eind, segment } of geldig) {
    if (vorigEind !== null && begin - vorigEind >= gatDrempel) {
      blokken.push({
        familie: "gat",
        beginTijd: tijdVanMinuten(vorigEind),
        eindTijd: tijdVanMinuten(begin),
        naam: `gat in de dag ${tijdVanMinuten(vorigEind)}–${tijdVanMinuten(begin)}`,
        ...plaats(vorigEind, begin),
      });
    }
    const categorieNaam = CATEGORIE_LABEL[segment.categorie];
    const staart = segment.label ? `, ${segment.label}` : "";
    blokken.push({
      familie: familieVanCategorie(segment.categorie),
      beginTijd: segment.beginTijd,
      eindTijd: segment.eindTijd,
      naam: `${categorieNaam} ${segment.beginTijd}–${segment.eindTijd}${staart}`,
      ...plaats(begin, eind),
    });
    vorigEind = Math.max(vorigEind ?? eind, eind);
  }

  return { blokken, asVan, asTot };
}

/**
 * De dag in één zin, voor de groepsnaam van de balk. Wie de balk niet ziet,
 * hoort dus nog steeds wat er die dag gebeurde.
 */
export function dagbalkBeschrijving(
  blokken: DagbalkBlok[],
  voorvoegsel?: string
): string {
  if (blokken.length === 0) {
    return voorvoegsel ? `${voorvoegsel}: geen segmenten` : "Geen segmenten";
  }
  const kop = voorvoegsel ? `${voorvoegsel}: ` : "";
  return `${kop}${blokken.map((blok) => blok.naam).join("; ")}`;
}

export function Dagbalk({
  segmenten,
  formaat = "hero",
  label,
  legenda = false,
  className,
}: {
  segmenten: DagSegment[];
  formaat?: DagbalkFormaat;
  /** Waar deze dag bij hoort ("Lars Hendriks, woensdag 12 augustus"). */
  label?: string;
  /** Categorienamen als tekst onder de balk. Alleen zinvol bij `hero`. */
  legenda?: boolean;
  className?: string;
}) {
  const { blokken, asVan, asTot } = useMemo(
    () => dagbalkBlokken(segmenten),
    [segmenten]
  );

  const beschrijving = dagbalkBeschrijving(blokken, label);
  const midden = tijdVanMinuten(Math.round((asVan + asTot) / 2 / 30) * 30);

  // Welke families staan er écht in deze dag? Een legenda met vijf regels
  // waarvan er twee voorkomen is ruis.
  const families = useMemo(() => {
    const gezien: DagbalkFamilie[] = [];
    for (const blok of blokken) {
      if (!gezien.includes(blok.familie)) gezien.push(blok.familie);
    }
    return gezien;
  }, [blokken]);

  return (
    <div className={cn("min-w-0", className)}>
      <div
        role="group"
        aria-label={beschrijving}
        data-formaat={formaat}
        className={cn(
          // `relative` + percentages = schaal in plaats van scroll.
          "relative w-full overflow-hidden border border-border/70 bg-muted/50",
          FORMAAT_BALK[formaat]
        )}
      >
        {blokken.map((blok, i) => (
          <span
            key={`${blok.familie}-${blok.beginTijd}-${i}`}
            role="img"
            aria-label={blok.naam}
            title={blok.naam}
            data-familie={blok.familie}
            className={cn(
              "absolute inset-y-0 block",
              FAMILIE_VLAK[blok.familie]
            )}
            style={{ left: `${blok.links}%`, width: `${blok.breedte}%` }}
          />
        ))}
      </div>

      {formaat === "hero" && (
        <div
          aria-hidden="true"
          className="mt-1 flex justify-between text-[10px] leading-3 tabular-nums text-muted-foreground/80"
        >
          <span>{tijdVanMinuten(asVan)}</span>
          <span>{midden}</span>
          <span>{tijdVanMinuten(asTot)}</span>
        </div>
      )}

      {legenda && families.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] leading-4 text-muted-foreground">
          {families.map((familie) => (
            <li key={familie} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={cn(
                  "size-2.5 shrink-0 rounded-[3px] border border-border/70",
                  FAMILIE_VLAK[familie]
                )}
              />
              {FAMILIE_LABEL[familie]}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
