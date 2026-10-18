/**
 * Lijstweergave van afspraken — pure filter-/sorteerlogica (PRD bijlage B,
 * fase 2 §2.5): derde, goedkope weergave op DEZELFDE planbord-data als het
 * weekbord (planbord.getBordContext + werkitems.listVoorPlanbord via de
 * adapter). Geen nieuwe opslag; alles hier is client-side mapping.
 *
 * - Mijn / Alle: "Mijn" toont de afspraken van de eigen teams (voorman:
 *   teams waar zijn gekoppelde medewerker in de bemanning/leden zit).
 * - Filters: team, status, periode (overlap met [van..tot]) en een zoekterm
 *   op afspraak- of klantnaam.
 * - Sortering: per kolom, oplopend/aflopend; de tabel groepeert daarna per
 *   ISO-week (de sortering geldt binnen elke week).
 */

import { addDagen } from "../../../convex/planbordLogica";
import type { PlanbordEvent } from "./adapter";
import { isoWeek } from "./datum-nl";
import { maandagVan } from "./periode";

export type LijstWeergave = "mijn" | "alle";

export type LijstKolom = "datum" | "naam" | "team" | "status" | "tijd" | "uren";

export type SorteerRichting = "asc" | "desc";

export interface LijstFilters {
  weergave: LijstWeergave;
  /** null = alle teams. */
  teamId: string | null;
  /** null = alle statussen. */
  status: string | null;
  /** Periode (inclusief); null = geen grens. */
  van: string | null;
  tot: string | null;
}

/**
 * Teams van de eigen medewerker: default-leden van het team. Bemanning per
 * dag kan afwijken, maar voor de lijst is het vaste team de leidraad
 * (zelfde default als de bordrijen).
 */
export function eigenTeamIds(
  teams: { _id: string; leden: string[] }[],
  medewerkerId: string | null
): Set<string> {
  if (!medewerkerId) return new Set();
  return new Set(
    teams
      .filter((team) => team.leden.some((lid) => lid === medewerkerId))
      .map((team) => team._id)
  );
}

/** Overlap van een (meerdaagse) afspraak met de periode [van..tot]. */
function inPeriode(
  event: Pick<PlanbordEvent, "start" | "eind">,
  van: string | null,
  tot: string | null
): boolean {
  if (van && event.eind < van) return false;
  if (tot && event.start > tot) return false;
  return true;
}

export function filterAfspraken(
  events: PlanbordEvent[],
  filters: LijstFilters,
  eigenTeams: Set<string>
): PlanbordEvent[] {
  return events.filter((event) => {
    if (filters.weergave === "mijn") {
      if (!event.resourceId || !eigenTeams.has(event.resourceId)) return false;
    }
    if (filters.teamId && event.resourceId !== filters.teamId) return false;
    if (filters.status && event.status !== filters.status) return false;
    return inPeriode(event, filters.van, filters.tot);
  });
}

/** Sorteersleutel per kolom (lege waarden achteraan bij oplopend). */
function sleutel(
  event: PlanbordEvent,
  kolom: LijstKolom,
  teamNamen: Record<string, string>
): string | number {
  switch (kolom) {
    case "datum":
      return `${event.start} ${event.startTijd ?? "99:99"}`;
    case "naam":
      return event.titel.toLowerCase();
    case "team":
      return event.resourceId
        ? (teamNamen[event.resourceId] ?? "").toLowerCase() || "￿"
        : "￿";
    case "status":
      return event.status;
    case "tijd":
      return event.startTijd ?? "99:99";
    case "uren":
      return event.geschatteUren ?? Number.POSITIVE_INFINITY;
  }
}

export function sorteerAfspraken(
  events: PlanbordEvent[],
  kolom: LijstKolom,
  richting: SorteerRichting,
  teamNamen: Record<string, string>
): PlanbordEvent[] {
  const factor = richting === "asc" ? 1 : -1;
  return [...events].sort((a, b) => {
    const ka = sleutel(a, kolom, teamNamen);
    const kb = sleutel(b, kolom, teamNamen);
    let diff: number;
    if (typeof ka === "number" && typeof kb === "number") {
      diff = ka === kb ? 0 : ka < kb ? -1 : 1;
    } else {
      diff = String(ka).localeCompare(String(kb), "nl");
    }
    if (diff !== 0) return diff * factor;
    // Stabiele secundaire sortering: datum, dan naam
    return (
      a.start.localeCompare(b.start) ||
      a.titel.localeCompare(b.titel, "nl")
    );
  });
}

/**
 * Zoeken (client-side) op afspraaknaam en klantnaam. Hoofdletterongevoelig;
 * een lege zoekterm laat alles door. `klantNaamVoor` levert de klantnaam van
 * een afspraak als die bekend is.
 */
export function zoekAfspraken(
  events: PlanbordEvent[],
  zoekterm: string,
  klantNaamVoor: (event: PlanbordEvent) => string | null | undefined
): PlanbordEvent[] {
  const term = zoekterm.trim().toLocaleLowerCase("nl");
  if (!term) return events;
  return events.filter(
    (event) =>
      event.titel.toLocaleLowerCase("nl").includes(term) ||
      (klantNaamVoor(event) ?? "").toLocaleLowerCase("nl").includes(term)
  );
}

/** Aantal kalenderdagen van een (meerdaagse) afspraak, inclusief. */
export function aantalDagen(event: Pick<PlanbordEvent, "start" | "eind">): number {
  const ms =
    Date.parse(`${event.eind}T00:00:00Z`) - Date.parse(`${event.start}T00:00:00Z`);
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}

export interface WeekGroep {
  /** Sorteersleutel, bv. "2026-W42" of "2026-W42|2026-W43". */
  sleutel: string;
  /** ISO-week van de start en van het eind (gelijk bij een gewone week). */
  vanWeek: { jaar: number; week: number };
  totWeek: { jaar: number; week: number };
  /** Maandag van de startweek en zondag van de eindweek (YYYY-MM-DD). */
  maandag: string;
  zondag: string;
  afspraken: PlanbordEvent[];
}

/**
 * Groepeert afspraken per ISO-week van de startdatum. Een afspraak die over
 * het weekend doorloopt naar een volgende week krijgt een eigen groep
 * ("Week 42–43"), direct na de week waarin hij begint. De volgorde binnen een
 * groep is de volgorde van de invoer (dus de gekozen sortering); de groepen
 * zelf staan chronologisch, of omgekeerd met `aflopend`.
 */
export function groepeerPerWeek(
  events: PlanbordEvent[],
  aflopend = false
): WeekGroep[] {
  const weekSleutel = (w: { jaar: number; week: number }) =>
    `${w.jaar}-W${String(w.week).padStart(2, "0")}`;
  const groepen = new Map<string, WeekGroep>();
  for (const event of events) {
    const vanWeek = isoWeek(event.start);
    const totWeek = isoWeek(event.eind);
    const van = weekSleutel(vanWeek);
    const tot = weekSleutel(totWeek);
    const sleutel = van === tot ? van : `${van}|${tot}`;
    let groep = groepen.get(sleutel);
    if (!groep) {
      groep = {
        sleutel,
        vanWeek,
        totWeek,
        maandag: maandagVan(event.start),
        zondag: addDagen(maandagVan(event.eind), 6),
        afspraken: [],
      };
      groepen.set(sleutel, groep);
    }
    groep.afspraken.push(event);
  }
  const factor = aflopend ? -1 : 1;
  return [...groepen.values()].sort(
    (a, b) => (a.sleutel < b.sleutel ? -1 : a.sleutel > b.sleutel ? 1 : 0) * factor
  );
}
