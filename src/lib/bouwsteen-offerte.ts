/**
 * Catalogus-laag voor de onderhoud-offerte-wizard (PRD §2.5a + bijlage A).
 *
 * Pure functies en types: pakket-preselectie, live doorrekening
 * (frequentie × prijs per beurt → jaarprijs/maandbedrag, eenmalig apart),
 * zand-keuzeregel en de mapping naar offerte-regels + gestructureerde
 * bouwsteen-regels (contract-voorvulling §2.1).
 *
 * BEWUST GEEN wijziging aan de bestaande calculatie-engine
 * (offerte-calculator.ts / normuren / correctiefactoren): deze laag komt
 * ernaast, niet ervoor in de plaats.
 */

import type { Id } from "../../convex/_generated/dataModel";
import type { BouwsteenCategorie, BouwsteenSoort } from "./catalogus";

// ─── Types ───────────────────────────────────────────────────────────────────

/** Shape van api.onderhoudscontracten.getBouwsteenDefaults per bouwsteen. */
export interface BouwsteenDefault {
  _id: Id<"bouwstenen">;
  naam: string;
  code: string;
  categorie: BouwsteenCategorie;
  soort: BouwsteenSoort;
  defaultFrequentiePerJaar?: number;
  vensterVanMaand?: number;
  vensterTotMaand?: number;
  urenPerBeurt?: number;
  prijsmodel: "uren" | "vast";
  btwCode: 9 | 21;
  /** normuren × uurtarief-op-datum, of het vaste bedrag. Null = nog niet ingevuld. */
  defaultPrijsPerBeurt: number | null;
  /** Keuzeregel-optieprijzen (bijlage A #17, zand): default per optie. */
  optiePrijsVoegzand?: number;
  optiePrijsStraatzand?: number;
  uurtarief: number | null;
  receptuurstappen?: Array<{ volgorde: number; omschrijving: string }>;
}

export type ZandKeuze = "voegzand" | "straatzand";

export const ZAND_LABELS: Record<ZandKeuze, string> = {
  voegzand: "Onkruidvrij voegzand",
  straatzand: "Straatzand",
};

/** Per-bouwsteen wizardstate (aan/uit-regel). Keyed op bouwsteenId. */
export interface CatalogusRegelState {
  aan: boolean;
  frequentiePerJaar: number;
  /** Handmatige prijs per beurt; null = volg de catalogus-default. */
  prijsPerBeurt: number | null;
}

export type PakketId = "onderhoud" | "reiniging" | "compleet";

/** Wizardstate van de catalogus-stap (autosave-baar). */
export interface CatalogusSelectie {
  pakket: PakketId | null;
  regels: Record<string, CatalogusRegelState>;
  zandKeuze: ZandKeuze;
  /** Twee prijzen van de zand-keuzeregel (bijlage A #17), beide zichtbaar. */
  zandPrijzen: { voegzand: number | null; straatzand: number | null };
}

export const LEGE_CATALOGUS_SELECTIE: CatalogusSelectie = {
  pakket: null,
  regels: {},
  zandKeuze: "voegzand",
  zandPrijzen: { voegzand: null, straatzand: null },
};

/** Gestructureerde bouwsteen-regel zoals opgeslagen op de offerte (additief). */
export interface OfferteBouwsteenRegel {
  bouwsteenId: Id<"bouwstenen">;
  naam: string;
  soort: BouwsteenSoort;
  frequentiePerJaar: number;
  prijsPerBeurt: number;
  prijsPerBeurtHandmatig: boolean;
  btwCode: 9 | 21;
  eenmalig: boolean;
  zandKeuze?: {
    keuze: ZandKeuze;
    prijsVoegzand: number;
    prijsStraatzand: number;
  };
}

// ─── Pakketten (bijlage A: tegels bovenin de wizard) ─────────────────────────

export interface Pakket {
  id: PakketId;
  naam: string;
  beschrijving: string;
  categorieen: readonly BouwsteenCategorie[];
}

const GROENE_CATEGORIEEN: readonly BouwsteenCategorie[] = [
  "gras_gazon",
  "borders_beplanting",
  "heggen_bomen",
  "bestrating_terras",
  "seizoen",
];

export const PAKKETTEN: readonly Pakket[] = [
  {
    id: "onderhoud",
    naam: "Onderhoud Tuin",
    beschrijving: "Alle groene bouwstenen",
    categorieen: GROENE_CATEGORIEEN,
  },
  {
    id: "reiniging",
    naam: "Reiniging",
    beschrijving: "De reinigingsreceptuur",
    categorieen: ["reiniging"],
  },
  {
    id: "compleet",
    naam: "Compleet",
    beschrijving: "Onderhoud + reiniging in één contract",
    categorieen: [...GROENE_CATEGORIEEN, "reiniging"],
  },
];

/**
 * Eenmalige soorten tellen als eenmalig bedrag, niet in het maandbedrag
 * (PRD §2.5a). Kostenregels en bundels zijn per beurt/jaar terugkerend;
 * de keuzeregel volgt de reinigingsbeurt.
 */
export function isEenmaligeSoort(soort: BouwsteenSoort): boolean {
  return soort === "eenmalig" || soort === "op_afroep";
}

/**
 * Hoort een bouwsteen bij de preselectie van een pakket? Terugkerende
 * bouwstenen van de pakket-categorieën gaan aan; de reinigingsreceptuur
 * neemt ook de zand-keuzeregel mee (die bepaalt de prijs van de
 * invegen-regel). Bundels/kostenregels/eenmalig blijven uit — vrij
 * aan te zetten daarna.
 */
export function hoortBijPakket(
  bouwsteen: Pick<BouwsteenDefault, "categorie" | "soort">,
  pakket: Pakket
): boolean {
  if (!pakket.categorieen.includes(bouwsteen.categorie)) return false;
  if (bouwsteen.soort === "terugkerend") return true;
  return bouwsteen.categorie === "reiniging" && bouwsteen.soort === "keuzeregel";
}

/**
 * Pas een pakket-tegel toe: preselecteer de bijbehorende bouwstenen
 * (aan/uit blijft daarna vrij aanpasbaar). Bestaande handmatige prijzen
 * en frequenties blijven staan; alleen aan/uit wordt gezet.
 */
export function pasPakketToe(
  selectie: CatalogusSelectie,
  pakket: Pakket,
  bouwstenen: BouwsteenDefault[]
): CatalogusSelectie {
  const regels: Record<string, CatalogusRegelState> = { ...selectie.regels };
  for (const b of bouwstenen) {
    const bestaand = regels[b._id];
    regels[b._id] = {
      aan: hoortBijPakket(b, pakket),
      frequentiePerJaar:
        bestaand?.frequentiePerJaar ?? b.defaultFrequentiePerJaar ?? 1,
      prijsPerBeurt: bestaand?.prijsPerBeurt ?? null,
    };
  }
  return { ...selectie, pakket: pakket.id, regels };
}

// ─── Doorrekening ────────────────────────────────────────────────────────────

/**
 * Default-optieprijs van de zand-keuzeregel (bijlage A #17) uit de
 * catalogus, per optie. Null = niet ingevuld (val terug op het enkele
 * prijsveld).
 */
export function defaultOptiePrijs(
  bouwsteen: Pick<
    BouwsteenDefault,
    "optiePrijsVoegzand" | "optiePrijsStraatzand"
  >,
  optie: ZandKeuze
): number | null {
  const prijs =
    optie === "voegzand"
      ? bouwsteen.optiePrijsVoegzand
      : bouwsteen.optiePrijsStraatzand;
  return prijs ?? null;
}

/** Effectieve prijs per beurt van een regel: handmatig > catalogus-default. */
export function effectievePrijsPerBeurt(
  bouwsteen: BouwsteenDefault,
  state: CatalogusRegelState | undefined,
  selectie: CatalogusSelectie
): number | null {
  if (bouwsteen.soort === "keuzeregel") {
    // Zand-keuzeregel (#17): de keuze bepaalt de prijs van de invegen-regel.
    // Voorrang: handmatige invoer > optieprijs uit de catalogus (per optie,
    // bijlage A #17) > het enkele catalogus-prijsveld.
    const gekozen = selectie.zandPrijzen[selectie.zandKeuze];
    return (
      gekozen ??
      defaultOptiePrijs(bouwsteen, selectie.zandKeuze) ??
      bouwsteen.defaultPrijsPerBeurt
    );
  }
  if (state && state.prijsPerBeurt !== null) return state.prijsPerBeurt;
  return bouwsteen.defaultPrijsPerBeurt;
}

/** Jaarprijs van één regel: frequentie × prijs; eenmalig = het bedrag zelf. */
export function berekenRegelJaarprijs(regel: {
  soort: BouwsteenSoort;
  frequentiePerJaar: number;
  prijsPerBeurt: number;
}): number {
  if (isEenmaligeSoort(regel.soort)) return regel.prijsPerBeurt;
  return regel.frequentiePerJaar * regel.prijsPerBeurt;
}

export interface CatalogusTotalen {
  /** Σ frequentie × prijs van terugkerende regels (per jaar, ex btw). */
  jaarprijs: number;
  /** Jaarprijs ÷ 12, afgerond op centen. */
  maandbedrag: number;
  /** Eenmalige bouwstenen: eenmalig bedrag, telt niet in het maandbedrag. */
  eenmalig: number;
}

export function berekenCatalogusTotalen(
  regels: Array<{
    soort: BouwsteenSoort;
    frequentiePerJaar: number;
    prijsPerBeurt: number;
  }>
): CatalogusTotalen {
  let jaarprijs = 0;
  let eenmalig = 0;
  for (const regel of regels) {
    if (isEenmaligeSoort(regel.soort)) {
      eenmalig += regel.prijsPerBeurt;
    } else {
      jaarprijs += regel.frequentiePerJaar * regel.prijsPerBeurt;
    }
  }
  return {
    jaarprijs,
    maandbedrag: Math.round((jaarprijs / 12) * 100) / 100,
    eenmalig,
  };
}

// ─── Naar offerte-record ─────────────────────────────────────────────────────

/**
 * Bouw de gestructureerde bouwsteen-regels voor op de offerte uit de
 * wizardstate. Alleen actieve (aan) regels; prijs = handmatig of
 * catalogus-default (normuren × uurtarief-op-offertedatum / vast bedrag).
 * Regels zonder enige prijs vallen af (catalogus nog niet ingevuld).
 */
export function bouwOfferteBouwsteenRegels(
  bouwstenen: BouwsteenDefault[],
  selectie: CatalogusSelectie
): OfferteBouwsteenRegel[] {
  const regels: OfferteBouwsteenRegel[] = [];
  for (const b of bouwstenen) {
    const state = selectie.regels[b._id];
    if (!state?.aan) continue;
    const prijs = effectievePrijsPerBeurt(b, state, selectie);
    if (prijs === null) continue;
    const handmatig =
      b.soort === "keuzeregel"
        ? selectie.zandPrijzen[selectie.zandKeuze] !== null
        : state.prijsPerBeurt !== null;
    regels.push({
      bouwsteenId: b._id,
      naam: b.naam,
      soort: b.soort,
      frequentiePerJaar: state.frequentiePerJaar,
      prijsPerBeurt: prijs,
      prijsPerBeurtHandmatig: handmatig,
      btwCode: b.btwCode,
      eenmalig: isEenmaligeSoort(b.soort),
      ...(b.soort === "keuzeregel"
        ? {
            zandKeuze: {
              keuze: selectie.zandKeuze,
              prijsVoegzand:
                selectie.zandPrijzen.voegzand ??
                defaultOptiePrijs(b, "voegzand") ??
                b.defaultPrijsPerBeurt ??
                0,
              prijsStraatzand:
                selectie.zandPrijzen.straatzand ??
                defaultOptiePrijs(b, "straatzand") ??
                b.defaultPrijsPerBeurt ??
                0,
            },
          }
        : {}),
    });
  }
  return regels;
}

/** Offerte-regel (regels[]-vorm van het bestaande offerte-record). */
export interface OfferteRegelRij {
  id: string;
  scope: string;
  omschrijving: string;
  eenheid: string;
  hoeveelheid: number;
  prijsPerEenheid: number;
  totaal: number;
  type: "materiaal" | "arbeid" | "machine";
  margePercentage?: number;
}

/**
 * Map bouwsteen-regels naar offerte-regels (additief naast de regels van de
 * bestaande engine). Omschrijving = bouwsteennaam zodat de regel herleidbaar
 * blijft (matchBouwsteenOpOmschrijving als vangnet); marge 0 want de prijs
 * per beurt is al verkoopprijs.
 */
export function catalogusRegelsNaarOfferteRegels(
  regels: OfferteBouwsteenRegel[]
): OfferteRegelRij[] {
  return regels.map((regel) => {
    const hoeveelheid = regel.eenmalig ? 1 : regel.frequentiePerJaar;
    const omschrijving = regel.zandKeuze
      ? `${regel.naam} — ${ZAND_LABELS[regel.zandKeuze.keuze]}`
      : regel.naam;
    return {
      id: `bouwsteen-${regel.bouwsteenId}`,
      scope: "catalogus",
      omschrijving,
      eenheid: regel.eenmalig ? "eenmalig" : "beurt",
      hoeveelheid,
      prijsPerEenheid: regel.prijsPerBeurt,
      totaal: Math.round(hoeveelheid * regel.prijsPerBeurt * 100) / 100,
      type: "arbeid" as const,
      margePercentage: 0,
    };
  });
}

/**
 * Toelichting op de default-prijs (leermodus, principe 6): hoe komt de
 * catalogus-default tot stand?
 */
export function defaultPrijsToelichting(bouwsteen: BouwsteenDefault): string {
  if (bouwsteen.prijsmodel === "vast") {
    return bouwsteen.defaultPrijsPerBeurt !== null
      ? `Vast bedrag per beurt uit de catalogus: € ${bouwsteen.defaultPrijsPerBeurt.toFixed(2)}.`
      : "Vast bedrag per beurt — nog niet ingevuld in de catalogus.";
  }
  if (bouwsteen.urenPerBeurt !== undefined && bouwsteen.uurtarief !== null) {
    return `${bouwsteen.urenPerBeurt} uur × € ${bouwsteen.uurtarief.toFixed(2)} uurtarief (op offertedatum) = € ${(bouwsteen.urenPerBeurt * bouwsteen.uurtarief).toFixed(2)} per beurt.`;
  }
  return "Uurbasis: geschatte uren × uurtarief op offertedatum — uren nog niet ingevuld in de catalogus.";
}
