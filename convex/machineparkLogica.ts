/**
 * Machinepark — pure businesslogica (PRD §3.3, fase 2 stap 3).
 *
 * Alles hier is puur en unit-testbaar zonder ctx:
 * - één middel-model over voertuigen én machines heen (status/sleutel);
 * - de bus-keten voor de materiaaldelta (§2.6): dag-override →
 *   team-standaardbus → fallback eerste toegewezen voertuig;
 * - dubbel-claim-detectie voor schaars materieel (HERO "bronnen", bijlage B):
 *   WAARSCHUWING, geen blokkade — consistent met de seizoenswaarschuwing;
 * - kapot-waarschuwingen voor het weekbord;
 * - rolcheck: kantoor beheert, voorman/staf leest.
 */

import { isKantoorRol } from "./roles";

export type MiddelSoort = "voertuig" | "machine";

/** Uniforme status over voertuigen en machines heen. */
export type MiddelStatus = "beschikbaar" | "onderhoud" | "kapot" | "inactief";

export const MIDDEL_STATUS_LABEL: Record<MiddelStatus, string> = {
  beschikbaar: "Beschikbaar",
  onderhoud: "In onderhoud",
  kapot: "Kapot",
  inactief: "Inactief",
};

/** voertuigen.status (actief/inactief/onderhoud/kapot) → uniforme status. */
export function voertuigStatusNaarMiddelStatus(
  status: "actief" | "inactief" | "onderhoud" | "kapot"
): MiddelStatus {
  if (status === "actief") return "beschikbaar";
  return status;
}

/** Uniforme status → voertuigen.status (schrijfrichting). */
export function middelStatusNaarVoertuigStatus(
  status: Exclude<MiddelStatus, "inactief">
): "actief" | "onderhoud" | "kapot" {
  return status === "beschikbaar" ? "actief" : status;
}

/** machines.status (optioneel) + isActief → uniforme status. */
export function machineStatusNaarMiddelStatus(
  status: "beschikbaar" | "onderhoud" | "kapot" | undefined,
  isActief: boolean
): MiddelStatus {
  if (!isActief) return "inactief";
  return status ?? "beschikbaar";
}

/** Genormaliseerde sleutel voor dubbel-claim-detectie en reserveringen. */
export function maakMiddelSleutel(soort: MiddelSoort, id: string): string {
  return `${soort}:${id}`;
}

// ============================================
// Bus-keten (materiaaldelta §2.6)
// ============================================

export type BusBron = "dag_override" | "team_standaard" | "werkitem_fallback";

/**
 * Effectieve bus voor een werkitem-dag. VOLGORDE (PRD §3.3, lost de fase
 * 1-aanname "toegewezenVoertuigen[0]" op):
 * 1. dag-override van het team (teamBusOverrides, team + datum);
 * 2. vaste standaardbus van het team (teams.standaardVoertuigId);
 * 3. vangnet = fase 1-gedrag: eerste toegewezen voertuig van het werkitem.
 */
export function bepaalEffectieveBus<TId extends { toString(): string }>(bronnen: {
  dagOverrideVoertuigId?: TId | null;
  teamStandaardVoertuigId?: TId | null;
  toegewezenVoertuigen?: TId[] | null;
}): { voertuigId: TId | null; bron: BusBron | null } {
  if (bronnen.dagOverrideVoertuigId) {
    return { voertuigId: bronnen.dagOverrideVoertuigId, bron: "dag_override" };
  }
  if (bronnen.teamStandaardVoertuigId) {
    return {
      voertuigId: bronnen.teamStandaardVoertuigId,
      bron: "team_standaard",
    };
  }
  const fallback = bronnen.toegewezenVoertuigen?.[0] ?? null;
  return fallback
    ? { voertuigId: fallback, bron: "werkitem_fallback" }
    : { voertuigId: null, bron: null };
}

// ============================================
// Dubbel-claim-detectie (schaars materieel)
// ============================================

export interface ReserveringLite {
  middelSleutel: string;
  datum: string; // YYYY-MM-DD
  werkitemId: string;
}

/**
 * Groepeer reserveringen op middel+dag en geef de conflicten terug
 * (zelfde middel, zelfde dag, MEER dan één werkitem). Zelfde middel op
 * verschillende dagen — of twee middelen op dezelfde dag — is géén conflict.
 */
export function vindDubbelClaims(
  reserveringen: ReserveringLite[]
): Array<{ middelSleutel: string; datum: string; werkitemIds: string[] }> {
  const perSleutelDag = new Map<string, Set<string>>();
  for (const r of reserveringen) {
    const key = `${r.middelSleutel}|${r.datum}`;
    const set = perSleutelDag.get(key) ?? new Set<string>();
    set.add(r.werkitemId);
    perSleutelDag.set(key, set);
  }
  const conflicten: Array<{
    middelSleutel: string;
    datum: string;
    werkitemIds: string[];
  }> = [];
  for (const [key, werkitems] of perSleutelDag) {
    if (werkitems.size < 2) continue;
    const [middelSleutel, datum] = [
      key.slice(0, key.lastIndexOf("|")),
      key.slice(key.lastIndexOf("|") + 1),
    ];
    conflicten.push({ middelSleutel, datum, werkitemIds: [...werkitems] });
  }
  return conflicten;
}

/** Waarschuwingstekst bij dubbel claimen (geen blokkade). */
export function dubbelClaimWaarschuwing(
  middelNaam: string,
  datum: string,
  andereWerkitemNaam?: string | null
): string {
  const waar = andereWerkitemNaam
    ? ` (ook geclaimd door "${andereWerkitemNaam}")`
    : "";
  return `Let op: ${middelNaam} is op ${datum} al gereserveerd${waar}. Dubbel geclaimd — controleer de planning.`;
}

/** Waarschuwingstekst bij een kapot middel op een team-dag. */
export function kapotWaarschuwing(
  middelNaam: string,
  soort: MiddelSoort,
  context?: string | null
): string {
  const wat = soort === "voertuig" ? "Bus/voertuig" : "Machine";
  return `${wat} "${middelNaam}" staat op KAPOT${context ? ` — ${context}` : ""}.`;
}

// ============================================
// Weekbord-waarschuwingen (kapot + dubbel claimen)
// ============================================

export interface MaterieelWaarschuwing {
  teamId: string | null; // null = niet aan één team te koppelen
  datum: string; // YYYY-MM-DD
  tekst: string;
}

/**
 * Bereken de materieel-waarschuwingen voor een bordperiode (puur; de query
 * in convex/planbord.ts voedt dit met de al opgehaalde gegevens):
 * - KAPOTTE effectieve bus van een team → waarschuwing op elke dag van de
 *   periode voor dat team (dag-override meegerekend);
 * - reservering van een KAPOT middel op een werkitem-dag → waarschuwing op
 *   de team-dag van dat werkitem;
 * - DUBBELE claim van hetzelfde (schaarse) middel op dezelfde dag →
 *   waarschuwing op die dag.
 */
export function berekenMaterieelWaarschuwingen(invoer: {
  datums: string[]; // alle dagen van de bordperiode
  teams: Array<{
    teamId: string;
    naam: string;
    standaardVoertuigId: string | null;
  }>;
  busOverrides: Array<{ teamId: string; datum: string; voertuigId: string }>;
  // status + naam per middelSleutel (`voertuig:{id}` / `machine:{id}`)
  middelen: Map<string, { naam: string; status: MiddelStatus }>;
  reserveringen: Array<
    ReserveringLite & { teamId: string | null; werkitemNaam: string }
  >;
}): MaterieelWaarschuwing[] {
  const waarschuwingen: MaterieelWaarschuwing[] = [];
  const overridePerTeamDag = new Map<string, string>();
  for (const o of invoer.busOverrides) {
    overridePerTeamDag.set(`${o.teamId}|${o.datum}`, o.voertuigId);
  }

  // 1. Kapotte effectieve bus per team-dag
  for (const team of invoer.teams) {
    for (const datum of invoer.datums) {
      const { voertuigId } = bepaalEffectieveBus({
        dagOverrideVoertuigId:
          overridePerTeamDag.get(`${team.teamId}|${datum}`) ?? null,
        teamStandaardVoertuigId: team.standaardVoertuigId,
      });
      if (!voertuigId) continue;
      const middel = invoer.middelen.get(
        maakMiddelSleutel("voertuig", voertuigId.toString())
      );
      if (middel?.status === "kapot") {
        waarschuwingen.push({
          teamId: team.teamId,
          datum,
          tekst: kapotWaarschuwing(
            middel.naam,
            "voertuig",
            `bus van team ${team.naam}`
          ),
        });
      }
    }
  }

  // 2. Reservering van een kapot middel op een werkitem-dag
  for (const r of invoer.reserveringen) {
    if (!invoer.datums.includes(r.datum)) continue;
    const middel = invoer.middelen.get(r.middelSleutel);
    if (middel?.status === "kapot") {
      const soort: MiddelSoort = r.middelSleutel.startsWith("voertuig:")
        ? "voertuig"
        : "machine";
      waarschuwingen.push({
        teamId: r.teamId,
        datum: r.datum,
        tekst: kapotWaarschuwing(
          middel.naam,
          soort,
          `gereserveerd voor "${r.werkitemNaam}"`
        ),
      });
    }
  }

  // 3. Dubbele claims (zelfde middel, zelfde dag)
  for (const conflict of vindDubbelClaims(invoer.reserveringen)) {
    if (!invoer.datums.includes(conflict.datum)) continue;
    const middel = invoer.middelen.get(conflict.middelSleutel);
    const namen = invoer.reserveringen
      .filter(
        (r) =>
          r.middelSleutel === conflict.middelSleutel &&
          r.datum === conflict.datum
      )
      .map((r) => r.werkitemNaam);
    waarschuwingen.push({
      teamId: null,
      datum: conflict.datum,
      tekst: `Dubbel geclaimd op ${conflict.datum}: ${middel?.naam ?? conflict.middelSleutel} (${namen.join(" én ")}).`,
    });
  }

  return waarschuwingen;
}

// ============================================
// Rollen
// ============================================

/**
 * Kantoor (directie/projectleider) beheert het machinepark; voorman en
 * overige stafrollen lezen alleen (PRD §3.3).
 */
export function magMachineparkMuteren(
  role: string | undefined | null
): boolean {
  return isKantoorRol(role);
}
