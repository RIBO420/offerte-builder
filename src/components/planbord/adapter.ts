/**
 * Planbord-adapter — databinding-abstractie voor het weekbord (PRD §2.2).
 *
 * ─── BESLISPUNT B3: weekbord-techniek ────────────────────────────────────────
 * Besluit: EIGEN resource-timeline-grid (rijen = teams, kolommen = dagen) met
 * dnd-kit (@dnd-kit/core, zat al ongebruikt in de repo) i.p.v. DayPilot Lite.
 *
 * Motivatie (getoetst op 2026-07-10, @daypilot/daypilot-lite-react 5.9.0):
 * 1. Compatibiliteit is niet de blokkade: peer deps zijn react >=16 en een
 *    minimale render onder React 19.2 werkt (Calendar rendert volledig; de
 *    Lite-Scheduler mount zonder React-fouten, maar vergt browser-layout en
 *    ontbrekende globals als ResizeObserver — dus wél extra frictie in de
 *    bestaande jsdom/vitest-testopzet).
 * 2. Het wringen zit in de PRD-eisen zelf: bemanning per team-DAG-cel,
 *    afwezigheidsblokken, ziekte/uitval-knop per cel, wachtrij-hints
 *    (voorkeursteam/beschikbaarheidsvenster) en shadcn/Tailwind-styling zijn
 *    allemaal custom celinhoud — precies wat de Lite-Scheduler (recent en
 *    beperkt t.o.v. DayPilot Pro) niet of alleen via workarounds toestaat.
 * 3. De PRD eist de functionaliteit en de ADAPTER, niet de library. Dit
 *    bestand is die adapter: alle databinding loopt via PlanbordResource/
 *    PlanbordEvent. Een latere wissel naar bv. DayPilot Pro of Bryntum is
 *    een mapping-wijziging hier — géén datamigratie (de waarheid blijft het
 *    werkitem in Convex).
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * De adapter is bewust dom: pure mapping van Convex-documenten naar de
 * bord-datamodellen. Alle schrijfacties lopen via werkitems.updatePlanning
 * en convex/planbord.ts (één record, twee weergaven — principe 1).
 */

import type { Doc, Id } from "../../../convex/_generated/dataModel";
import {
  bemanningVoorDag,
  isAfwezig,
  werkitemOpDag,
  type BeschikbaarheidsVenster,
} from "../../../convex/planbordLogica";

// ============================================
// Adapter-datamodel (events/resources-interface)
// ============================================

/** Rij op het bord: een team, met bemanning per dag. */
export interface PlanbordResource {
  id: Id<"teams">;
  naam: string;
  /** Vaste teamleden (default-bemanning). */
  ledenDefault: Id<"medewerkers">[];
}

/** Blok op het bord: één gepland werkitem. */
export interface PlanbordEvent {
  id: Id<"projecten">;
  resourceId: Id<"teams"> | null; // null = gepland zonder team
  start: string; // YYYY-MM-DD (inclusief)
  eind: string; // YYYY-MM-DD (inclusief)
  titel: string;
  type: "project" | "onderhoudsbeurt";
  status: string;
  volgordeBinnenDag?: number;
  startTijd?: string; // HH:MM
  eindTijd?: string; // HH:MM
  geschatteUren?: number;
}

/** Bemanning van één team-dag (default of aangepast) + afwezigen. */
export interface PlanbordBemanningCel {
  teamId: Id<"teams">;
  datum: string;
  medewerkerIds: Id<"medewerkers">[];
  bron: "default" | "aangepast";
  afwezigen: Id<"medewerkers">[];
  /** Team-brede afwezigheid (bv. feestdag of heel team ziek). */
  teamAfwezig: boolean;
}

/** Item in de opdrachtenbak (wachtrij), zoals geleverd door planbord.getWachtrij. */
export interface BakItem {
  _id: Id<"projecten">;
  naam: string;
  type: "project" | "onderhoudsbeurt";
  klantNaam: string | null;
  adres: string | null;
  geschatteUren: number | null;
  voorzieneDatum: string | null;
  voorkeursTeamId: Id<"teams"> | null;
  voorkeursTeamNaam: string | null;
  beschikbaarheidsVenster: BeschikbaarheidsVenster | null;
}

// ============================================
// Mapping Convex → adapter
// ============================================

type BordContext = {
  teams: { _id: Id<"teams">; naam: string; leden: Id<"medewerkers">[] }[];
  bemanning: {
    teamId: Id<"teams">;
    datum: string;
    medewerkerIds: Id<"medewerkers">[];
  }[];
  afwezigheid: Doc<"afwezigheidsblokken">[];
  medewerkerNamen: Record<string, string>;
};

export function naarResources(context: BordContext): PlanbordResource[] {
  return context.teams.map((t) => ({
    id: t._id,
    naam: t.naam,
    ledenDefault: t.leden,
  }));
}

export function naarEvents(werkitems: Doc<"projecten">[]): PlanbordEvent[] {
  return werkitems
    .filter((w) => w.geplandeStart !== undefined)
    .map((w) => ({
      id: w._id,
      resourceId: w.teamId ?? null,
      start: w.geplandeStart as string,
      eind: w.geplandeEind ?? (w.geplandeStart as string),
      titel: w.naam,
      type: w.type ?? "project",
      status: w.status,
      volgordeBinnenDag: w.volgordeBinnenDag,
      startTijd: w.geplandeStartTijd,
      eindTijd: w.geplandeEindTijd,
      geschatteUren: w.geschatteUren,
    }));
}

/** Bemanning + afwezigheid voor één team-dag-cel. */
export function naarBemanningCel(
  context: BordContext,
  teamId: Id<"teams">,
  datum: string
): PlanbordBemanningCel {
  const team = context.teams.find((t) => t._id === teamId);
  const rij =
    context.bemanning.find((b) => b.teamId === teamId && b.datum === datum) ??
    null;
  const basis = bemanningVoorDag({ leden: team?.leden ?? [] }, rij);
  const afwezigen = basis.medewerkerIds.filter((m) =>
    context.afwezigheid.some((blok) => isAfwezig(blok, datum, m, teamId))
  );
  const teamAfwezig = context.afwezigheid.some(
    (blok) =>
      blok.teamId === teamId &&
      !blok.medewerkerId &&
      blok.startDatum <= datum &&
      datum <= blok.eindDatum
  );
  return {
    teamId,
    datum,
    medewerkerIds: basis.medewerkerIds,
    bron: basis.bron,
    afwezigen,
    teamAfwezig,
  };
}

/** Events van één team op één dag, gesorteerd op volgorde (route-dagkaart 5b). */
export function eventsVoorTeamDag(
  events: PlanbordEvent[],
  teamId: Id<"teams"> | null,
  datum: string
): PlanbordEvent[] {
  return events
    .filter(
      (e) =>
        e.resourceId === teamId &&
        werkitemOpDag({ geplandeStart: e.start, geplandeEind: e.eind }, datum)
    )
    .sort(
      (a, b) => (a.volgordeBinnenDag ?? 999) - (b.volgordeBinnenDag ?? 999)
    );
}
