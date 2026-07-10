/**
 * Dagkaart-logica — pure, testbare functies voor de route-dagkaart
 * (PRD §2.2 weergave 2, stap 5b; cascade-test §8.9).
 *
 * Kernprincipe: blokken op een dag zijn AFGELEID, niet opgeslagen.
 * vertrek loods → reistijd → klantblok → pauze (vaste tijd) → klantblok → …
 * → terugreis → loods-afronding → einde-dag-check. Alleen afwijkingen worden
 * opgeslagen: handmatige tijd/duur-overrides op het werkitem
 * (geplandeStartTijd / duurOverrideMinuten) en dag-specifieke afwijkingen van
 * de standaardblokken (tabel dagkaartAfwijkingen).
 *
 * Cascade-regels (§8.9):
 * - Duur +15 min op klant A → alle vertrek- en aankomsttijden erna schuiven
 *   automatisch door (A's start blijft afgeleid, alleen het einde schuift).
 * - Handmatige waarden blijven ALTIJD leidend; herberekening overschrijft ze
 *   nooit — alles erná cascadeert vanaf de handmatige waarde.
 * - Klantblok = één geheel: omwisselen neemt taken mee (die zitten op het
 *   werkitem); reistijden worden per adrespaar opnieuw opgezocht.
 * - De pauze ligt op een vaste tijd; werk dat eroverheen loopt pauzeert
 *   (het einde schuift op met de pauzeduur).
 *
 * NB: net als planbordLogica.ts bewust GEEN runtime-imports, zodat de
 * client-UI en unit-tests dit zonder Convex-runtime kunnen gebruiken.
 * Naamconflict-waarschuwing: de tabel `routes` is GPS-tracking; dit heet
 * hier dan ook nooit "route" — UI-label is "Dagkaart".
 */

import type { Doc, Id } from "./_generated/dataModel";

// ============================================
// Tijd-helpers (HH:MM ↔ minuten sinds middernacht)
// ============================================

const TIJD_PATROON = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isGeldigeTijd(tijd: string): boolean {
  return TIJD_PATROON.test(tijd);
}

export function naarMinuten(tijd: string): number {
  const [uur, minuut] = tijd.split(":").map(Number);
  return uur * 60 + minuut;
}

/** Minuten → "HH:MM". Loopt bewust niet over middernacht heen (geen wrap). */
export function naarTijd(minuten: number): string {
  const m = Math.max(0, Math.round(minuten));
  const uur = Math.floor(m / 60);
  const rest = m % 60;
  return `${String(uur).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

// ============================================
// Standaardblokken (instelling; Mickey levert echte tijden, §7.1)
// ============================================

export interface DagkaartStandaarden {
  vertrekTijd: string; // HH:MM
  pauzeStart: string; // HH:MM
  pauzeEind: string; // HH:MM
  loodsAfrondingMinuten: number;
  standaardReistijdMinuten: number;
}

export const DAGKAART_DEFAULTS: DagkaartStandaarden = {
  vertrekTijd: "07:00",
  pauzeStart: "12:00",
  pauzeEind: "12:30",
  loodsAfrondingMinuten: 30,
  standaardReistijdMinuten: 20,
};

/**
 * Effectieve standaardblokken: defaults ← bedrijfsinstelling ← dag-afwijking.
 * Alleen ingevulde velden overschrijven; `undefined` valt door naar de laag
 * eronder (afgeleide blokken, alleen afwijkingen opgeslagen).
 */
export function effectieveStandaarden(
  instelling?: Partial<DagkaartStandaarden> | null,
  dagAfwijking?: Partial<DagkaartStandaarden> | null
): DagkaartStandaarden {
  const lagen = [instelling, dagAfwijking];
  const resultaat = { ...DAGKAART_DEFAULTS };
  for (const laag of lagen) {
    if (!laag) continue;
    if (laag.vertrekTijd !== undefined) resultaat.vertrekTijd = laag.vertrekTijd;
    if (laag.pauzeStart !== undefined) resultaat.pauzeStart = laag.pauzeStart;
    if (laag.pauzeEind !== undefined) resultaat.pauzeEind = laag.pauzeEind;
    if (laag.loodsAfrondingMinuten !== undefined)
      resultaat.loodsAfrondingMinuten = laag.loodsAfrondingMinuten;
    if (laag.standaardReistijdMinuten !== undefined)
      resultaat.standaardReistijdMinuten = laag.standaardReistijdMinuten;
  }
  return resultaat;
}

// ============================================
// Duur van een klantblok (override > tijden > geschatteUren > default)
// ============================================

export const DEFAULT_STOP_DUUR_MINUTEN = 60;

export function stopDuurMinuten(
  item: Pick<
    Doc<"projecten">,
    | "duurOverrideMinuten"
    | "geplandeStartTijd"
    | "geplandeEindTijd"
    | "geschatteUren"
  >
): number {
  if (item.duurOverrideMinuten !== undefined && item.duurOverrideMinuten > 0) {
    return Math.round(item.duurOverrideMinuten);
  }
  if (
    item.geplandeStartTijd &&
    item.geplandeEindTijd &&
    isGeldigeTijd(item.geplandeStartTijd) &&
    isGeldigeTijd(item.geplandeEindTijd)
  ) {
    const verschil =
      naarMinuten(item.geplandeEindTijd) - naarMinuten(item.geplandeStartTijd);
    if (verschil > 0) return verschil;
  }
  if (item.geschatteUren !== undefined && item.geschatteUren > 0) {
    return Math.round(item.geschatteUren * 60);
  }
  return DEFAULT_STOP_DUUR_MINUTEN;
}

// ============================================
// Tijdcascade (§8.9)
// ============================================

/** Eén stop (klantblok) als invoer voor de cascade. */
export interface KlantStop {
  werkitemId: Id<"projecten"> | string;
  adres: string | null;
  duurMinuten: number;
  /** geplandeStartTijd — handmatig, blijft ALTIJD leidend. */
  handmatigeStartTijd?: string | null;
}

export type DagBlokSoort =
  | "vertrek"
  | "reistijd"
  | "klant"
  | "pauze"
  | "loods_afronding"
  | "einde_dag";

export interface DagBlok {
  soort: DagBlokSoort;
  start: string; // HH:MM
  eind: string; // HH:MM
  werkitemId?: Id<"projecten"> | string;
  reistijdMinuten?: number;
  /** True als de start een handmatige override is (nooit overschreven). */
  handmatigeStart?: boolean;
}

/**
 * Berekent alle blokken van één team-dag uit vertrektijd, geordende stops en
 * reistijden. `reistijden[i]` is de reistijd (minuten) naar stop i;
 * `reistijden[stops.length]` is de terugreis naar de loods. Ontbrekende
 * waarden vallen terug op de standaard-reistijd (fail-closed).
 */
export function berekenDagkaart(
  standaarden: DagkaartStandaarden,
  stops: KlantStop[],
  reistijden: number[]
): DagBlok[] {
  const pauzeStartMin = naarMinuten(standaarden.pauzeStart);
  const pauzeEindMin = naarMinuten(standaarden.pauzeEind);
  const pauzeDuur = Math.max(0, pauzeEindMin - pauzeStartMin);

  let cursor = naarMinuten(standaarden.vertrekTijd);
  let pauzeGeplaatst = false;
  const blokken: DagBlok[] = [
    { soort: "vertrek", start: naarTijd(cursor), eind: naarTijd(cursor) },
  ];

  // Lege dag: geen stops → geen reistijd-/afrondingsblokken, alleen de markers
  if (stops.length === 0) {
    blokken.push({
      soort: "einde_dag",
      start: naarTijd(cursor),
      eind: naarTijd(cursor),
    });
    return blokken;
  }

  /**
   * Plaatst een aaneengesloten segment. De vaste pauze onderbreekt werk dat
   * eroverheen loopt (eind schuift op met de pauzeduur); een segment dat pas
   * ná de pauzestart zou beginnen, start na de pauze — tenzij de start
   * handmatig is, want handmatige waarden blijven leidend.
   */
  const plaatsSegment = (
    gewensteStart: number,
    duur: number,
    startIsHandmatig: boolean
  ): { start: number; eind: number } => {
    let start = gewensteStart;
    if (pauzeDuur > 0 && !pauzeGeplaatst && start >= pauzeStartMin) {
      pauzeGeplaatst = true;
      if (!startIsHandmatig) start = Math.max(start, pauzeEindMin);
    }
    let eind = start + duur;
    if (pauzeDuur > 0 && !pauzeGeplaatst && duur > 0 && eind > pauzeStartMin) {
      pauzeGeplaatst = true;
      eind += pauzeDuur;
    }
    return { start, eind };
  };

  stops.forEach((stop, i) => {
    const reisMinuten = reistijden[i] ?? standaarden.standaardReistijdMinuten;
    const reis = plaatsSegment(cursor, reisMinuten, false);
    blokken.push({
      soort: "reistijd",
      start: naarTijd(reis.start),
      eind: naarTijd(reis.eind),
      reistijdMinuten: reisMinuten,
    });
    cursor = reis.eind;

    const handmatig =
      stop.handmatigeStartTijd && isGeldigeTijd(stop.handmatigeStartTijd)
        ? naarMinuten(stop.handmatigeStartTijd)
        : null;
    const blok = plaatsSegment(
      handmatig ?? cursor,
      stop.duurMinuten,
      handmatig !== null
    );
    blokken.push({
      soort: "klant",
      start: naarTijd(blok.start),
      eind: naarTijd(blok.eind),
      werkitemId: stop.werkitemId,
      handmatigeStart: handmatig !== null,
    });
    cursor = blok.eind;
  });

  // Terugreis naar de loods + loods-afsluitblok + einde-dag-check
  const terugMinuten =
    reistijden[stops.length] ?? standaarden.standaardReistijdMinuten;
  const terug = plaatsSegment(cursor, terugMinuten, false);
  blokken.push({
    soort: "reistijd",
    start: naarTijd(terug.start),
    eind: naarTijd(terug.eind),
    reistijdMinuten: terugMinuten,
  });
  cursor = terug.eind;

  const afronding = plaatsSegment(
    cursor,
    standaarden.loodsAfrondingMinuten,
    false
  );
  blokken.push({
    soort: "loods_afronding",
    start: naarTijd(afronding.start),
    eind: naarTijd(afronding.eind),
  });
  cursor = afronding.eind;

  // Pauze op de vaste tijd — zichtbaar als standaardblok zodra de dag
  // eroverheen loopt (een dag die vóór de pauze eindigt heeft er geen)
  if (pauzeDuur > 0 && pauzeGeplaatst) {
    blokken.push({
      soort: "pauze",
      start: standaarden.pauzeStart,
      eind: standaarden.pauzeEind,
    });
  }

  blokken.push({
    soort: "einde_dag",
    start: naarTijd(cursor),
    eind: naarTijd(cursor),
  });

  // Chronologisch (de pauze op zijn vaste plek tussen de blokken)
  return blokken.sort(
    (a, b) =>
      naarMinuten(a.start) - naarMinuten(b.start) ||
      naarMinuten(a.eind) - naarMinuten(b.eind)
  );
}

/**
 * Omwisselen van twee stops: het klantblok reist als ÉÉN geheel (taken zitten
 * op het werkitem en gaan vanzelf mee; reistijden worden door de aanroeper
 * per adrespaar opnieuw opgezocht). Ongeldige indices → ongewijzigde kopie.
 */
export function wisselStops<T>(lijst: T[], i: number, j: number): T[] {
  const kopie = [...lijst];
  if (i < 0 || j < 0 || i >= kopie.length || j >= kopie.length || i === j) {
    return kopie;
  }
  [kopie[i], kopie[j]] = [kopie[j], kopie[i]];
  return kopie;
}

// ============================================
// Adresparen voor reistijden (loods → stops → loods)
// ============================================

export function normaliseerAdres(adres: string): string {
  return adres.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Cache-sleutel per adrespaar (richting is relevant voor verkeer). */
export function reistijdSleutel(vanAdres: string, naarAdres: string): string {
  return `${normaliseerAdres(vanAdres)}|${normaliseerAdres(naarAdres)}`;
}

export interface AdresPaar {
  vanAdres: string;
  naarAdres: string;
  sleutel: string;
}

/**
 * Adresparen van een dag: loods → stop 1 → … → stop n → loods.
 * Stops zonder adres leveren `null` op die positie (→ standaard-reistijd).
 * Lengte is altijd `adressen.length + 1`.
 */
export function adresParenVoorDag(
  loodsAdres: string | null,
  adressen: (string | null)[]
): (AdresPaar | null)[] {
  const punten = [loodsAdres, ...adressen, loodsAdres];
  const paren: (AdresPaar | null)[] = [];
  for (let i = 0; i < punten.length - 1; i++) {
    const van = punten[i];
    const naar = punten[i + 1];
    paren.push(
      van && naar
        ? { vanAdres: van, naarAdres: naar, sleutel: reistijdSleutel(van, naar) }
        : null
    );
  }
  return paren;
}

// ============================================
// "Stel volgorde voor" (bijlage B, fase 2 — route-intelligentie stap 2)
// ============================================

/** Stop-invoer voor het volgordevoorstel. */
export interface VolgordeStop {
  werkitemId: string;
  adres: string | null;
  /** Handmatige starttijd — deze stop wordt NIET verplaatst (§8.9). */
  handmatigeStartTijd?: string | null;
}

export interface VolgordeVoorstel {
  /** Werkitem-ids in de voorgestelde volgorde. */
  volgorde: string[];
  oudeReistijdMinuten: number;
  nieuweReistijdMinuten: number;
  /** Positief = winst; kan 0 zijn (dan is het voorstel gelijk aan nu). */
  tijdwinstMinuten: number;
  gewijzigd: boolean;
}

/** Reistijd tussen twee punten via de cache-map; onbekend → standaard. */
function reistijdTussen(
  van: string | null,
  naar: string | null,
  reistijden: ReadonlyMap<string, number>,
  standaardMinuten: number
): number {
  if (!van || !naar) return standaardMinuten;
  return reistijden.get(reistijdSleutel(van, naar)) ?? standaardMinuten;
}

/** Totale reistijd van een route loods → stops → loods. */
function routeMinuten(
  loodsAdres: string | null,
  adressen: (string | null)[],
  reistijden: ReadonlyMap<string, number>,
  standaardMinuten: number
): number {
  const punten = [loodsAdres, ...adressen, loodsAdres];
  let totaal = 0;
  for (let i = 0; i < punten.length - 1; i++) {
    totaal += reistijdTussen(
      punten[i],
      punten[i + 1],
      reistijden,
      standaardMinuten
    );
  }
  return totaal;
}

/**
 * Eenvoudige nearest-neighbour-heuristiek op de bekende reistijden
 * (reistijdCache; onbekende paren → standaard-reistijd), startend vanaf de
 * loods. Het voorstel is een PREVIEW — de planner beslist (overnemen loopt
 * via de bestaande herordenDag; fase 4 pas automatische herplanning, §4.4).
 *
 * Regels:
 * - Een stop met handmatige starttijd blijft op zijn huidige positie staan
 *   (handmatige waarden blijven ALTIJD leidend, §8.9);
 * - Bij gelijke reistijd wint de laagste huidige positie (stabiel);
 * - Leeg, één stop of alles vastgezet → null (no-op, geen voorstel).
 */
export function stelVolgordeVoor(
  loodsAdres: string | null,
  stops: VolgordeStop[],
  reistijden: ReadonlyMap<string, number>,
  standaardMinuten: number
): VolgordeVoorstel | null {
  if (stops.length < 2) return null;

  const vastePositie = stops.map(
    (stop) =>
      Boolean(
        stop.handmatigeStartTijd && isGeldigeTijd(stop.handmatigeStartTijd)
      )
  );
  if (vastePositie.every(Boolean)) return null;

  const vrijeIndices = new Set(
    stops.map((_, i) => i).filter((i) => !vastePositie[i])
  );

  // Posities één voor één vullen: vaste stops blijven staan; voor elke
  // vrije positie de dichtstbijzijnde nog vrije stop vanaf het vorige adres.
  const nieuweIndices: number[] = [];
  let huidigAdres: string | null = loodsAdres;
  for (let positie = 0; positie < stops.length; positie++) {
    if (vastePositie[positie]) {
      nieuweIndices.push(positie);
      huidigAdres = stops[positie].adres ?? huidigAdres;
      continue;
    }
    let beste: number | null = null;
    let besteMinuten = Number.POSITIVE_INFINITY;
    for (const kandidaat of vrijeIndices) {
      const minuten = reistijdTussen(
        huidigAdres,
        stops[kandidaat].adres,
        reistijden,
        standaardMinuten
      );
      if (
        minuten < besteMinuten ||
        (minuten === besteMinuten && (beste === null || kandidaat < beste))
      ) {
        beste = kandidaat;
        besteMinuten = minuten;
      }
    }
    // vrijeIndices is nooit leeg op een vrije positie (aantallen kloppen)
    const gekozen = beste as number;
    vrijeIndices.delete(gekozen);
    nieuweIndices.push(gekozen);
    huidigAdres = stops[gekozen].adres ?? huidigAdres;
  }

  const oudeMinuten = routeMinuten(
    loodsAdres,
    stops.map((s) => s.adres),
    reistijden,
    standaardMinuten
  );
  const nieuweMinuten = routeMinuten(
    loodsAdres,
    nieuweIndices.map((i) => stops[i].adres),
    reistijden,
    standaardMinuten
  );
  const gewijzigd = nieuweIndices.some((oud, positie) => oud !== positie);

  return {
    volgorde: nieuweIndices.map((i) => stops[i].werkitemId),
    oudeReistijdMinuten: oudeMinuten,
    nieuweReistijdMinuten: nieuweMinuten,
    tijdwinstMinuten: oudeMinuten - nieuweMinuten,
    gewijzigd,
  };
}

// ============================================
// Taak losmaken uit een klantblok (§2.2: rest-opdracht terug in de bak)
// ============================================

/**
 * Splitst één taak (bouwsteenregel) uit een klantblok. De laatste taak kan
 * niet worden losgemaakt (dan hoort het hele werkitem terug in de bak, via
 * het weekbord/koppelTeamLos). `null` = ongeldige splitsing.
 */
export function splitsTaakUit<T>(
  regels: T[] | undefined,
  index: number
): { losgemaakt: T; overgebleven: T[] } | null {
  if (!regels || regels.length < 2) return null;
  if (index < 0 || index >= regels.length) return null;
  return {
    losgemaakt: regels[index],
    overgebleven: regels.filter((_, i) => i !== index),
  };
}
