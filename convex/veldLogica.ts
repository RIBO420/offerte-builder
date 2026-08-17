/**
 * Veld-logica — pure, testbare functies voor de veld-rol (PRD §2.6 +
 * bijlage C, fase 1 stap 9a; acceptatietests §8.5/§8.8/§8.10).
 *
 * Kernprincipes:
 * - Voorgestelde urensegmenten zijn AFGELEID van de dagkaart-blokken
 *   (loggen wordt bevestigen, §8.10) — geen dubbele opslag van de planning.
 * - Achterstand = gepland bezoek zonder enige log die dag; afwijking = wel
 *   gelogd maar boven de instelbare drempel (>15 min of >20%, PRD-aanname,
 *   bevestiging Mickey §7.1).
 * - Afronding op taakniveau: alles ✓ → uitgevoerd; één of meer ◐/○ → die
 *   taken automatisch afsplitsen als rest-opdracht met resterende normtijd.
 * - Materiaaldelta = benodigd (bouwsteen-koppelingen) mínus standaard-
 *   inventaris van de bus (§8.5: alleen "grasmaaier" als de rest er al ligt).
 *
 * NB: net als dagkaartLogica.ts bewust GEEN runtime-imports, zodat de
 * client-UI en unit-tests dit zonder Convex-runtime kunnen gebruiken.
 */

import type { Id } from "./_generated/dataModel";
import { naarMinuten, type DagBlok } from "./dagkaartLogica";

// ============================================
// Urensegmenten (§8.10)
// ============================================

export type SegmentCategorie =
  | "werken"
  | "pauze"
  | "reistijd"
  | "teammeeting"
  | "onderhoud_materiaal"
  | "afvalverwerker_bes"
  | "anders";

export interface VoorstelSegment {
  categorie: SegmentCategorie;
  beginTijd: string; // HH:MM
  eindTijd: string; // HH:MM
  werkitemId: Id<"projecten"> | string | null;
}

export interface OpgeslagenSegmentTijd {
  beginTijd: string;
  eindTijd: string;
}

/**
 * Vertaalt dagkaart-blokken naar voorgestelde urensegmenten (§8.10):
 * reistijd → reistijd, klantblok → werken (mét werkitem), pauze → pauze.
 * Vertrek/einde-dag zijn markers zonder duur; loods-afronding is kantoor-
 * afsluittijd en wordt bewust niet voorgesteld (indirecte tijd, §2.2).
 * Blokken zonder duur (begin == eind) leveren geen voorstel op.
 */
export function blokkenNaarVoorstellen(blokken: DagBlok[]): VoorstelSegment[] {
  const voorstellen: VoorstelSegment[] = [];
  for (const blok of blokken) {
    if (naarMinuten(blok.eind) <= naarMinuten(blok.start)) continue;
    if (blok.soort === "reistijd") {
      voorstellen.push({
        categorie: "reistijd",
        beginTijd: blok.start,
        eindTijd: blok.eind,
        werkitemId: null,
      });
    } else if (blok.soort === "klant") {
      voorstellen.push({
        categorie: "werken",
        beginTijd: blok.start,
        eindTijd: blok.eind,
        werkitemId: blok.werkitemId ?? null,
      });
    } else if (blok.soort === "pauze") {
      voorstellen.push({
        categorie: "pauze",
        beginTijd: blok.start,
        eindTijd: blok.eind,
        werkitemId: null,
      });
    }
  }
  return voorstellen;
}

/** True als twee tijdvakken (HH:MM) overlappen (grenzen raken mag). */
export function overlapt(
  a: OpgeslagenSegmentTijd,
  b: OpgeslagenSegmentTijd
): boolean {
  return (
    naarMinuten(a.beginTijd) < naarMinuten(b.eindTijd) &&
    naarMinuten(b.beginTijd) < naarMinuten(a.eindTijd)
  );
}

/**
 * Voorstellen zijn afgeleid tot bevestigd: zodra een opgeslagen segment het
 * tijdvak (deels) dekt, vervalt het voorstel — geen dubbele opslag (§8.10).
 */
export function filterVoorstellen<T extends OpgeslagenSegmentTijd>(
  voorstellen: T[],
  opgeslagen: OpgeslagenSegmentTijd[]
): T[] {
  return voorstellen.filter(
    (voorstel) => !opgeslagen.some((seg) => overlapt(voorstel, seg))
  );
}

/** Geldigheid van een segment-tijdvak: begin vóór eind, beide HH:MM. */
export function isGeldigSegmentTijdvak(
  beginTijd: string,
  eindTijd: string
): boolean {
  const patroon = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!patroon.test(beginTijd) || !patroon.test(eindTijd)) return false;
  return naarMinuten(beginTijd) < naarMinuten(eindTijd);
}

/** Duur van een segment in minuten. */
export function segmentMinuten(seg: OpgeslagenSegmentTijd): number {
  return naarMinuten(seg.eindTijd) - naarMinuten(seg.beginTijd);
}

// ============================================
// Achterstanden & afwijkingen — "Wie is achter" (§2.6)
// ============================================

export interface AfwijkingDrempels {
  minuten: number; // default 15
  procent: number; // default 20
}

export const DEFAULT_AFWIJKING_DREMPELS: AfwijkingDrempels = {
  minuten: 15,
  procent: 20,
};

export interface GeplandBezoek {
  werkitemId: string;
  geplandeMinuten: number;
}

export type BezoekBeoordeling =
  | { soort: "ok"; werkitemId: string }
  | { soort: "achterstand"; werkitemId: string }
  | {
      soort: "afwijking";
      werkitemId: string;
      geplandeMinuten: number;
      gelogdeMinuten: number;
      verschilMinuten: number;
      verschilProcent: number;
    };

/**
 * Beoordeelt één gepland bezoek tegen de gelogde werken-minuten:
 * - niets gelogd → achterstand;
 * - wel gelogd maar |verschil| > drempel-minuten ÉN > drempel-procent →
 *   afwijking (PRD-voorstel "15 min of 20%" is een óf-drempel: boven één
 *   van beide is genoeg);
 * - anders ok.
 */
export function beoordeelBezoek(
  bezoek: GeplandBezoek,
  gelogdeMinuten: number | undefined,
  drempels: AfwijkingDrempels = DEFAULT_AFWIJKING_DREMPELS
): BezoekBeoordeling {
  if (gelogdeMinuten === undefined || gelogdeMinuten <= 0) {
    return { soort: "achterstand", werkitemId: bezoek.werkitemId };
  }
  const verschil = Math.abs(gelogdeMinuten - bezoek.geplandeMinuten);
  const procent =
    bezoek.geplandeMinuten > 0 ? (verschil / bezoek.geplandeMinuten) * 100 : 0;
  if (verschil > drempels.minuten || procent > drempels.procent) {
    return {
      soort: "afwijking",
      werkitemId: bezoek.werkitemId,
      geplandeMinuten: bezoek.geplandeMinuten,
      gelogdeMinuten,
      verschilMinuten: verschil,
      verschilProcent: Math.round(procent * 10) / 10,
    };
  }
  return { soort: "ok", werkitemId: bezoek.werkitemId };
}

// ============================================
// Afrondingsflow op taakniveau (§8.8)
// ============================================

export type TaakAfrondStatus = "afgerond" | "begonnen_niet_af" | "niet_gestart";

export interface AfrondTaakInvoer {
  omschrijving: string;
  bouwsteenId?: Id<"bouwstenen"> | string;
  /** Normtijd (uren) van de bouwsteen, indien bekend. */
  normUren?: number | null;
  status: TaakAfrondStatus;
  notitie?: string;
}

export interface AfrondResultaat {
  allesAfgerond: boolean;
  /** Taken die als rest-opdracht worden afgesplitst (◐ en ○). */
  restTaken: AfrondTaakInvoer[];
  /** Resterende normtijd (uren) van de rest-taken (som van bekende normuren). */
  resterendeNormUren: number | null;
}

/**
 * Verdeelt de taak-afronding: alles ✓ → allesAfgerond; anders gaan de taken
 * met ◐/○ als rest-opdracht mee, met resterende normtijd. Voor "begonnen-
 * niet-af" is de restfractie onbekend — de volledige normtijd telt (bewuste
 * fase 1-aanname; de notitie geeft de context).
 */
export function verdeelTaakAfronding(
  taken: AfrondTaakInvoer[]
): AfrondResultaat {
  const restTaken = taken.filter((t) => t.status !== "afgerond");
  const bekendeUren = restTaken
    .map((t) => t.normUren)
    .filter((u): u is number => typeof u === "number" && Number.isFinite(u));
  return {
    allesAfgerond: taken.length > 0 && restTaken.length === 0,
    restTaken,
    resterendeNormUren:
      bekendeUren.length > 0
        ? Math.round(bekendeUren.reduce((a, b) => a + b, 0) * 100) / 100
        : null,
  };
}

// ============================================
// Materiaaldelta (§8.5)
// ============================================

/** Genormaliseerde vergelijkingssleutel voor materiaal-/machinenamen. */
export function normaliseerItemNaam(naam: string): string {
  return naam.trim().toLowerCase().replace(/\s+/g, " ");
}

export interface DeltaItem {
  naam: string;
  soort: "machine" | "materiaal";
}

/**
 * Delta = benodigd (materiaal/machines uit de bouwsteen-koppelingen van de
 * geplande taken) mínus standaardinventaris van de bus. Voorbeeld §8.5:
 * standaardbus heeft alles behalve grasmaaier → delta = ["grasmaaier"].
 * Vergelijking op genormaliseerde naam; dubbele benodigdheden ontdubbeld.
 */
export function berekenMateriaalDelta(
  benodigd: DeltaItem[],
  inventarisNamen: string[]
): DeltaItem[] {
  const aanwezig = new Set(inventarisNamen.map(normaliseerItemNaam));
  const gezien = new Set<string>();
  const delta: DeltaItem[] = [];
  for (const item of benodigd) {
    const sleutel = normaliseerItemNaam(item.naam);
    if (!sleutel || aanwezig.has(sleutel) || gezien.has(sleutel)) continue;
    gezien.add(sleutel);
    delta.push(item);
  }
  return delta;
}

// ============================================
// Rolchecks (pure; §8.5/§8.8 rolgedeelte)
// ============================================

export type VeldRol = "kantoor" | "voorman" | "medewerker" | "klant";

/** Segmenten loggen/bevestigen en de dag indienen: alle veldrollen + kantoor. */
export function magUrenLoggen(rol: VeldRol): boolean {
  return rol === "kantoor" || rol === "voorman" || rol === "medewerker";
}

/** Alleen kantoor heropent een ingediende dag en corrigeert (§2.6). */
export function magDagHeropenen(rol: VeldRol): boolean {
  return rol === "kantoor";
}

/** Afrondingsflow en meerwerk-verzoek: veld (voorman/medewerker) + kantoor. */
export function magAfronden(rol: VeldRol): boolean {
  return rol === "kantoor" || rol === "voorman" || rol === "medewerker";
}

/**
 * De ploegdag van vandaag zien (voorman-gezicht op `/uren`): de voorman kijkt
 * naar zijn hele ploeg, kantoor naar elke ploeg. Een medewerker ziet alleen
 * zijn eigen week — die kijkt dus nooit in de ploegdag van collega's.
 */
export function magPloegDagZien(rol: VeldRol): boolean {
  return rol === "kantoor" || rol === "voorman";
}

/** Meerwerk goedkeuren/als nieuwe opdracht in de bak: alleen kantoor/planning. */
export function magMeerwerkBeoordelen(rol: VeldRol): boolean {
  return rol === "kantoor";
}

/**
 * "Ploegdag bevestigen voor N man" (voorman-gezicht op `/uren`, controlekamer-
 * plan §3 WS-C): de voorman mag de dagkaart-VOORSTELLEN van een lid bevestigen
 * dat die dag in zíjn ploeg zit — de group-punch uit het onderzoek (§2). Meer
 * niet: corrigeren, verwijderen en indienen blijven bij het lid zelf of bij
 * kantoor (`magDagVanMedewerker` verandert dus niet). Of het doel écht in de
 * eigen ploeg van die dag zit, bepaalt de mutation met de teamdata; deze
 * functie houdt alleen de rolregel vast.
 */
export function magPloegVoorstellenBevestigen(
  rol: VeldRol,
  isLidVanEigenPloeg: boolean
): boolean {
  return rol === "voorman" && isLidVanEigenPloeg;
}

/**
 * Een medewerker mag alleen zijn eigen dag zien/bewerken; kantoor mag elke
 * dag (correcties). `eigenMedewerkerId` = gekoppelde medewerker van de user.
 */
export function magDagVanMedewerker(
  rol: VeldRol,
  eigenMedewerkerId: string | null,
  doelMedewerkerId: string
): boolean {
  if (rol === "kantoor") return true;
  if (!magUrenLoggen(rol)) return false;
  return eigenMedewerkerId !== null && eigenMedewerkerId === doelMedewerkerId;
}
