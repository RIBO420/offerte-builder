"use client";

/**
 * Weekritme van de Controlekamer.
 *
 * De week is de hartslag (plan §1, keuzepunt 3): de kop, de export en "alles
 * akkoord" werken per week, de dag is de eenheid van beoordeling. De gekozen
 * week leeft in de URL (`?week=YYYY-MM-DD`, altijd een maandag), zodat een
 * loonronde te delen en te bookmarken is — hetzelfde principe als `?tab=` en
 * de periodekeuze bij rapportages.
 *
 * De datumfuncties komen uit het planbord (`maandagVan`, `addDagen`): één
 * waarheid over waar een week begint. Weeknummers rekenen we ISO-8601 (maandag
 * als eerste dag), zoals de rest van het bedrijf ze noemt.
 */

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { addDagen } from "../../../convex/planbordLogica";
import { maandagVan, vandaagIso } from "@/components/planbord/periode";

const MAANDEN = [
  "januari",
  "februari",
  "maart",
  "april",
  "mei",
  "juni",
  "juli",
  "augustus",
  "september",
  "oktober",
  "november",
  "december",
];

const DAGEN_KORT = ["ma", "di", "wo", "do", "vr", "za", "zo"];

/** ISO-weeknummer (1–53) van een YYYY-MM-DD. */
export function isoWeekNummer(datum: string): number {
  const d = new Date(`${datum}T00:00:00Z`);
  const dag = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  // Naar de donderdag van dezelfde week: die bepaalt in ISO-8601 het jaar.
  d.setUTCDate(d.getUTCDate() + 4 - dag);
  const jaarStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - jaarStart) / 86400000 + 1) / 7);
}

/**
 * "Week 33 · 10 t/m 16 augustus" — de terugval als de backend nog geen
 * `weekLabel` meestuurt. Loopt de week over een maandgrens, dan staan beide
 * maanden erin ("28 juli t/m 3 augustus").
 */
export function weekLabelVan(weekStart: string): string {
  const eind = addDagen(weekStart, 6);
  const startDag = Number(weekStart.slice(8, 10));
  const eindDag = Number(eind.slice(8, 10));
  const startMaand = MAANDEN[Number(weekStart.slice(5, 7)) - 1];
  const eindMaand = MAANDEN[Number(eind.slice(5, 7)) - 1];
  const bereik =
    startMaand === eindMaand
      ? `${startDag} t/m ${eindDag} ${eindMaand}`
      : `${startDag} ${startMaand} t/m ${eindDag} ${eindMaand}`;
  return `Week ${isoWeekNummer(weekStart)} · ${bereik}`;
}

/** "do 13" — het chipje van een ontbrekende dag. */
export function dagChipLabel(datum: string): string {
  const d = new Date(`${datum}T00:00:00Z`);
  const index = (d.getUTCDay() === 0 ? 7 : d.getUTCDay()) - 1;
  return `${DAGEN_KORT[index]} ${d.getUTCDate()}`;
}

/** "woensdag 12 augustus" — op de dagkaart, zonder jaartal (dat zegt de week). */
export function dagLabelLang(datum: string): string {
  const d = new Date(`${datum}T00:00:00Z`);
  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(d);
}

export function maandagVanVandaag(): string {
  return maandagVan(vandaagIso());
}

/** Is `weekStart` de week waarin we nu zitten? */
export function isDezeWeek(weekStart: string): boolean {
  return weekStart === maandagVanVandaag();
}

/**
 * De weekkeuze uit de URL. Een ongeldige of niet-maandag-waarde wordt stil naar
 * de maandag van die week getrokken; onzin valt terug op deze week. Zo kan een
 * gedeelde link nooit een half scherm opleveren.
 */
export function useWeekKeuze() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const ruw = searchParams.get("week");
  const weekStart =
    ruw && /^\d{4}-\d{2}-\d{2}$/.test(ruw)
      ? maandagVan(ruw)
      : maandagVanVandaag();

  const kiesWeek = useCallback(
    (nieuweWeek: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (nieuweWeek === maandagVanVandaag()) {
        // Deze week is de default: de parameter mag dan uit de URL.
        params.delete("week");
      } else {
        params.set("week", nieuweWeek);
      }
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const schuif = useCallback(
    (richting: -1 | 1) => kiesWeek(addDagen(weekStart, 7 * richting)),
    [kiesWeek, weekStart]
  );

  return { weekStart, kiesWeek, schuif, isDezeWeek: isDezeWeek(weekStart) };
}
