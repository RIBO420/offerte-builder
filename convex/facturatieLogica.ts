/**
 * Facturatie-logica (PRD §2.8) — pure functies, bewust zonder Convex-ctx
 * zodat unit-tests (vitest) ze rechtstreeks kunnen draaien.
 *
 * Kern:
 * - Statussplitsing (HERO-pariteit, bijlage B): documentStatus (concept →
 *   definitief → verzonden) los van betaalStatus (open → gedeeltelijk_betaald
 *   → betaald / vervallen / geannuleerd). Het oude enkele status-veld blijft
 *   als legacy-spiegel (dual-write) bestaan; mapLegacyStatus/legacyStatusVan
 *   zijn de enige twee vertaalpunten.
 * - Btw-uitsplitsing per tarief (9/21) op regelniveau.
 * - Engine-beslissingen: welke actie hoort bij welke facturatiemodus, welke
 *   regels komen uit een (deels) afgeronde beurt, mag de engine direct
 *   versturen.
 */

// ── Types ────────────────────────────────────────────────────────────────

export type DocumentStatus = "concept" | "definitief" | "verzonden";
export type BetaalStatus =
  | "open"
  | "gedeeltelijk_betaald"
  | "betaald"
  | "vervallen"
  | "geannuleerd";
export type LegacyFactuurStatus =
  | "concept"
  | "definitief"
  | "verzonden"
  | "betaald"
  | "vervallen";

export interface FactuurRegelInput {
  totaal: number;
  btwCode?: 9 | 21;
}

export interface BtwUitsplitsingRegel {
  percentage: number;
  grondslag: number;
  bedrag: number;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

// ── Statussplitsing ──────────────────────────────────────────────────────

/**
 * Migratie-mapping oud → nieuw (idempotent toepasbaar):
 * - concept    → concept / open
 * - definitief → definitief / open
 * - verzonden  → verzonden / open
 * - betaald    → verzonden / betaald
 * - vervallen  → verzonden / vervallen
 */
export function mapLegacyStatus(status: LegacyFactuurStatus): {
  documentStatus: DocumentStatus;
  betaalStatus: BetaalStatus;
} {
  switch (status) {
    case "concept":
      return { documentStatus: "concept", betaalStatus: "open" };
    case "definitief":
      return { documentStatus: "definitief", betaalStatus: "open" };
    case "verzonden":
      return { documentStatus: "verzonden", betaalStatus: "open" };
    case "betaald":
      return { documentStatus: "verzonden", betaalStatus: "betaald" };
    case "vervallen":
      return { documentStatus: "verzonden", betaalStatus: "vervallen" };
  }
}

/**
 * Dual-write terug naar het legacy-veld zodat bestaande lezers (portaal,
 * betalingsherinneringen, boekhouding) blijven werken. Betaalketen wint
 * zodra het document verzonden is; "geannuleerd" kent legacy niet en wordt
 * als "vervallen" gespiegeld.
 */
export function legacyStatusVan(
  documentStatus: DocumentStatus,
  betaalStatus: BetaalStatus
): LegacyFactuurStatus {
  if (documentStatus !== "verzonden") return documentStatus;
  switch (betaalStatus) {
    case "betaald":
      return "betaald";
    case "vervallen":
    case "geannuleerd":
      return "vervallen";
    default:
      return "verzonden";
  }
}

/**
 * Effectieve statussen van een factuurdocument: nieuwe velden met
 * legacy-fallback voor nog niet gemigreerde rijen. DIT is wat lijst,
 * detail en KPI's gebruiken — nooit meer het kale status-veld.
 */
export function effectieveStatussen(factuur: {
  status: LegacyFactuurStatus;
  documentStatus?: DocumentStatus;
  betaalStatus?: BetaalStatus;
}): { documentStatus: DocumentStatus; betaalStatus: BetaalStatus } {
  if (factuur.documentStatus && factuur.betaalStatus) {
    return {
      documentStatus: factuur.documentStatus,
      betaalStatus: factuur.betaalStatus,
    };
  }
  const mapped = mapLegacyStatus(factuur.status);
  return {
    documentStatus: factuur.documentStatus ?? mapped.documentStatus,
    betaalStatus: factuur.betaalStatus ?? mapped.betaalStatus,
  };
}

/** Toegestane documentstatus-overgangen (§2.8). */
export const DOCUMENT_OVERGANGEN: Record<DocumentStatus, DocumentStatus[]> = {
  concept: ["definitief", "verzonden"], // verzenden vanuit de wachtrij mag direct
  definitief: ["concept", "verzonden"],
  verzonden: [],
};

export function isGeldigeDocumentOvergang(
  van: DocumentStatus,
  naar: DocumentStatus
): boolean {
  return DOCUMENT_OVERGANGEN[van]?.includes(naar) ?? false;
}

/**
 * Betaalstatus op basis van geregistreerde (deel)betalingen.
 * Kleine afrondingsmarge (1 cent) zodat centverschillen niet "open" blijven.
 * Eindtoestanden vervallen/geannuleerd worden alleen door betaling omgebogen
 * (alsnog betalen van een vervallen factuur kan).
 */
export function bepaalBetaalStatus(
  totaalInclBtw: number,
  betaaldBedrag: number,
  huidige: BetaalStatus = "open"
): BetaalStatus {
  if (huidige === "geannuleerd") return "geannuleerd";
  if (betaaldBedrag >= totaalInclBtw - 0.01 && totaalInclBtw > 0) {
    return "betaald";
  }
  if (betaaldBedrag > 0) return "gedeeltelijk_betaald";
  return huidige === "vervallen" ? "vervallen" : "open";
}

// ── Btw-uitsplitsing (§2.8 punt 4) ───────────────────────────────────────

/**
 * Uitsplitsing per btw-tarief over de regels. Regels zonder btwCode vallen
 * terug op het meegegeven default-percentage (legacy factuur.btwPercentage).
 * Volgorde: oplopend tarief (9 vóór 21) — zo toont het totalenblok/PDF
 * deterministisch "btw 9%" boven "btw 21%".
 */
export function berekenBtwUitsplitsing(
  regels: ReadonlyArray<FactuurRegelInput>,
  defaultPercentage: number
): BtwUitsplitsingRegel[] {
  const perTarief = new Map<number, number>();
  for (const regel of regels) {
    const tarief = regel.btwCode ?? defaultPercentage;
    perTarief.set(tarief, (perTarief.get(tarief) ?? 0) + regel.totaal);
  }
  return [...perTarief.entries()]
    .sort(([a], [b]) => a - b)
    .map(([percentage, grondslag]) => ({
      percentage,
      grondslag: round2(grondslag),
      bedrag: round2(grondslag * (percentage / 100)),
    }));
}

/**
 * Totalen inclusief uitsplitsing. btwPercentage in het resultaat is het
 * EFFECTIEVE percentage (gewogen) — puur voor het legacy-veld dat consumers
 * nog tonen; de waarheid is de uitsplitsing.
 */
export function berekenFactuurTotalen(
  regels: ReadonlyArray<FactuurRegelInput>,
  defaultPercentage: number
): {
  subtotaal: number;
  btwBedrag: number;
  totaalInclBtw: number;
  btwPercentage: number;
  btwUitsplitsing: BtwUitsplitsingRegel[];
} {
  const btwUitsplitsing = berekenBtwUitsplitsing(regels, defaultPercentage);
  const subtotaal = round2(
    btwUitsplitsing.reduce((sum, u) => sum + u.grondslag, 0)
  );
  const btwBedrag = round2(
    btwUitsplitsing.reduce((sum, u) => sum + u.bedrag, 0)
  );
  return {
    subtotaal,
    btwBedrag,
    totaalInclBtw: round2(subtotaal + btwBedrag),
    btwPercentage:
      subtotaal > 0
        ? round2((btwBedrag / subtotaal) * 100)
        : defaultPercentage,
    btwUitsplitsing,
  };
}

// ── Engine-beslissingen (§2.8 punt 2) ────────────────────────────────────

export type Facturatiemodus =
  | "per_bezoek"
  | "maandelijks_verzameld"
  | "vast_maandbedrag";

export type EngineActie = "per_bezoek" | "maandverzameling" | "geen";

/**
 * Welke actie onderneemt de engine bij een klaarVoorFacturatie-beurt?
 * - vast_maandbedrag → "geen": het termijnschema (contractFacturen) is het
 *   enige spoor; de twee sporen sluiten elkaar per contract uit.
 * - losse beurt zonder contract → per_bezoek (default).
 */
export function bepaalEngineActie(
  modus: Facturatiemodus | undefined
): EngineActie {
  switch (modus ?? "per_bezoek") {
    case "per_bezoek":
      return "per_bezoek";
    case "maandelijks_verzameld":
      return "maandverzameling";
    case "vast_maandbedrag":
      return "geen";
  }
}

export interface AfgerondeTaak {
  omschrijving: string;
  status: "afgerond" | "begonnen_niet_af" | "niet_gestart";
}

export interface TaakPrijsbron {
  omschrijving: string;
  prijsPerBeurt?: number;
  btwCode?: 9 | 21;
}

export interface EngineFactuurRegel {
  omschrijving: string;
  hoeveelheid: number;
  eenheid: string;
  prijsPerEenheid: number;
  totaal: number;
  btwCode: 9 | 21;
}

/** Default-btw voor onderhoudsbeurten zonder bouwsteen-btwCode. */
export const DEFAULT_BTW_ONDERHOUD = 9 as const;

/**
 * Factuurregels uit de taak-afronding van een beurt: ALLEEN taken met status
 * "afgerond" (§8.8: bij deels-uitgevoerd wordt uitsluitend het uitgevoerde
 * deel gefactureerd; de rest-opdracht factureert later zijn eigen deel).
 * Prijs/btw per taak uit de prijsbron (bouwsteenRegels/contractwerkzaamheid,
 * match op omschrijving); zonder prijs → €0-regel zodat kantoor het concept
 * niet ongemerkt te laag verstuurt maar de regel wél ziet staan.
 */
export function bouwRegelsUitTaakAfronding(
  taken: ReadonlyArray<AfgerondeTaak>,
  prijsbronnen: ReadonlyArray<TaakPrijsbron>,
  datumVanDienst: string
): EngineFactuurRegel[] {
  const prijsPerOmschrijving = new Map<string, TaakPrijsbron>();
  for (const bron of prijsbronnen) {
    if (!prijsPerOmschrijving.has(bron.omschrijving)) {
      prijsPerOmschrijving.set(bron.omschrijving, bron);
    }
  }
  return taken
    .filter((taak) => taak.status === "afgerond")
    .map((taak) => {
      const bron = prijsPerOmschrijving.get(taak.omschrijving);
      const prijs = round2(bron?.prijsPerBeurt ?? 0);
      return {
        omschrijving: `${taak.omschrijving} (uitgevoerd ${datumVanDienst})`,
        hoeveelheid: 1,
        eenheid: "beurt",
        prijsPerEenheid: prijs,
        totaal: prijs,
        btwCode: bron?.btwCode ?? DEFAULT_BTW_ONDERHOUD,
      };
    });
}

/**
 * Mag de engine deze factuur zélf versturen (zonder Te-versturen-check)?
 * Alleen als kantoor de contract-toggle bewust heeft aangezet. De
 * daadwerkelijke mail blijft ALTIJD achter de mailGuard (sandbox-modus
 * verstuurt nooit). Zonder contract is er geen toggle → nooit direct.
 */
export function magEngineDirectVersturen(
  contract: { directVersturen?: boolean } | null | undefined
): boolean {
  return contract?.directVersturen === true;
}

// ── Datums ───────────────────────────────────────────────────────────────

/** YYYY-MM-DD in Europe/Amsterdam voor een epoch-timestamp. */
export function datumVanDienstVan(afgerondOp: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(afgerondOp));
}

/** Kalendermaand YYYY-MM van een YYYY-MM-DD datum. */
export function verzamelMaandVan(datumVanDienst: string): string {
  return datumVanDienst.slice(0, 7);
}

/** Is de verzamelmaand vóór de maand van "nu"? (maandwissel-cron) */
export function isVerzamelMaandVoorbij(
  verzamelMaand: string,
  nu: number
): boolean {
  const huidigeMaand = verzamelMaandVan(datumVanDienstVan(nu));
  return verzamelMaand < huidigeMaand;
}
