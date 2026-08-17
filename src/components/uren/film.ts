"use client";

/**
 * Dagritme van de Ploegenfilm en het voorman-gezicht.
 *
 * Waar de Controlekamer per wéék kijkt (`week.ts`, `?week=`), kijken de film en
 * de ploegdag per dág. De gekozen dag leeft in de URL (`?dag=YYYY-MM-DD`), en
 * de film heeft daarnaast `?weergave=film` — zo is "kijk even naar de dagfilm
 * van donderdag" één deelbare link (plan §3 WS-C, useTabState-patroon). Zonder
 * die parameters verandert er niets: de Controlekamer blijft de default.
 *
 * Hieronder staan ook de twee pure helpers die alle rolgezichten delen: de
 * gedeelde tijd-as (alle balken van één dag op hetzelfde venster) en de
 * dagzin ("42,5 uur, waarvan 6,2 indirect — 3 mensen nog niet ingediend").
 */

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { addDagen } from "../../../convex/planbordLogica";
import { vandaagIso } from "@/components/planbord/periode";
import { formatHours } from "@/lib/format";
import { minutenVanTijd, type DagSegment } from "./controle-types";

const DATUM_PATROON = /^\d{4}-\d{2}-\d{2}$/;

/** `?dag=` uit de URL, of vandaag als hij ontbreekt of onzin is. */
function dagUitParams(params: URLSearchParams): string {
  const ruw = params.get("dag");
  return ruw && DATUM_PATROON.test(ruw) ? ruw : vandaagIso();
}

/**
 * De dagkeuze van de Ploegenfilm (kantoor). `filmActief` volgt
 * `?weergave=film`; sluiten haalt beide parameters weg zodat de link weer de
 * kale Controlekamer is (een eventuele `?week=` blijft staan).
 */
export function useFilmKeuze() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filmActief = searchParams.get("weergave") === "film";
  const dag = dagUitParams(searchParams);

  const zetParams = useCallback(
    (muteer: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      muteer(params);
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const openFilm = useCallback(
    (datum: string) =>
      zetParams((params) => {
        params.set("weergave", "film");
        params.set("dag", datum);
      }),
    [zetParams]
  );

  const kiesDag = useCallback(
    (datum: string) => zetParams((params) => params.set("dag", datum)),
    [zetParams]
  );

  const sluitFilm = useCallback(
    () =>
      zetParams((params) => {
        params.delete("weergave");
        params.delete("dag");
      }),
    [zetParams]
  );

  return { filmActief, dag, openFilm, kiesDag, sluitFilm };
}

/**
 * De dagkeuze van het voorman-gezicht: alleen `?dag=`, met ← → en "Vandaag".
 * Vandaag is de default en houdt de URL schoon.
 */
export function useDagKeuze() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const dag = dagUitParams(searchParams);
  const isVandaag = dag === vandaagIso();

  const kiesDag = useCallback(
    (datum: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (datum === vandaagIso()) {
        params.delete("dag");
      } else {
        params.set("dag", datum);
      }
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const schuif = useCallback(
    (richting: -1 | 1) => kiesDag(addDagen(dag, richting)),
    [kiesDag, dag]
  );

  return { dag, isVandaag, kiesDag, schuif };
}

// ── Pure helpers van de rolgezichten ────────────────────────────────────────

/** Standaardvenster van de hoveniersdag — zelfde waarden als de dagbalk. */
const AS_VAN_STANDAARD = 6 * 60;
const AS_TOT_STANDAARD = 18 * 60;

/**
 * De gedeelde tijd-as van één dag: het standaardvenster 06:00–18:00, opgerekt
 * naar hele uren zodra íemand erbuiten werkte. Alle balken van de dag krijgen
 * dit venster, zodat 07:00 in elke rij op dezelfde plek ligt — daar leeft het
 * "synchroon lopen" van de ploeg van (onderzoek §3, concept C).
 */
export function gedeeldeAs(dagen: { segmenten: DagSegment[] }[]): {
  asVanMinuten: number;
  asTotMinuten: number;
} {
  let asVan = AS_VAN_STANDAARD;
  let asTot = AS_TOT_STANDAARD;
  for (const dag of dagen) {
    for (const segment of dag.segmenten) {
      const begin = minutenVanTijd(segment.beginTijd);
      const eind = minutenVanTijd(segment.eindTijd);
      if (begin === null || eind === null || eind <= begin) continue;
      if (begin < asVan) asVan = Math.floor(begin / 60) * 60;
      if (eind > asTot) asTot = Math.ceil(eind / 60) * 60;
    }
  }
  return { asVanMinuten: asVan, asTotMinuten: asTot };
}

/**
 * Het dagtotaal als zin (plan §2): "42,5 uur, waarvan 6,2 indirect — 3 mensen
 * nog niet ingediend." `nietIngediend` telt ménsen, geen uren (backend-
 * contract). Nul indirect verdwijnt uit de zin; nul open is goed nieuws.
 */
export function dagZin(totaal: {
  uren: number;
  indirect: number;
  nietIngediend: number;
}): string {
  const uren = `${formatHours(totaal.uren)} uur`;
  const indirect =
    totaal.indirect > 0
      ? `, waarvan ${formatHours(totaal.indirect)} indirect`
      : "";
  const staart =
    totaal.nietIngediend === 0
      ? "iedereen heeft ingediend"
      : totaal.nietIngediend === 1
        ? "1 persoon nog niet ingediend"
        : `${totaal.nietIngediend} mensen nog niet ingediend`;
  return `${uren}${indirect} — ${staart}.`;
}
