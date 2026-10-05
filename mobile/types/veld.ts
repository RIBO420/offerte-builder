/**
 * Typen voor de veld-rol (PRD §2.6, stap 9b — pariteit met web-stap 9a).
 *
 * De mobile-app gebruikt een los `convex/_generated`-stub (anyApi), dus de
 * server-returntypes zijn hier gespiegeld op de backend-functies:
 * convex/urenSegmenten.ts (getVeldDag), convex/materiaalDelta.ts
 * (getDeltaChecklist), convex/meerwerk.ts en convex/instellingen.ts
 * (getVeldInstellingen). Wijzigt de backend, werk dan dit bestand mee bij.
 */

import type { Id } from '../convex/_generated/dataModel';

/** Segmentcategorieën (§2.6): BES = afvalverwerker, rit + lossen groenafval. */
export type SegmentCategorie =
  | 'werken'
  | 'pauze'
  | 'reistijd'
  | 'teammeeting'
  | 'loods'
  | 'laden'
  | 'onderhoud_materiaal'
  | 'afvalverwerker_bes'
  | 'anders';

export const CATEGORIE_LABELS: Record<SegmentCategorie, string> = {
  werken: 'Werken',
  pauze: 'Pauze',
  reistijd: 'Reistijd',
  teammeeting: 'Teammeeting',
  loods: 'Loods',
  laden: 'Laden',
  onderhoud_materiaal: 'Onderhoud materiaal',
  afvalverwerker_bes: 'Afvalverwerker (BES)',
  anders: 'Anders',
};

/** Eén taak op een klantblok: bouwsteencode + normtijd (§8.8). */
export interface VeldTaak {
  omschrijving: string;
  bouwsteenId: string | null;
  code: string | null;
  normUren: number | null;
}

/** Eén geplande klus (klantblok) op de team-dag. */
export interface VeldStop {
  werkitemId: Id<'projecten'>;
  naam: string;
  status: string;
  type: 'project' | 'onderhoudsbeurt';
  klantId: string | null;
  klantNaam: string | null;
  adres: string | null;
  /** Vast klantkenmerk voor de hovenier ("hond los in de tuin"). */
  bijzonderheden: string | null;
  uitvoeringsInstructie?: string;
  geplandeMinuten: number;
  taken: VeldTaak[];
  taakAfronding: unknown;
  klaarVoorFacturatie: boolean;
}

/** Voorgesteld segment uit de dagkaart (§8.10: loggen wordt bevestigen). */
export interface VoorstelSegment {
  categorie: SegmentCategorie;
  werksoort?: import('../lib/werksoorten').Werksoort;
  beginTijd: string; // HH:MM
  eindTijd: string; // HH:MM
  werkitemId: Id<'projecten'> | null;
}

/** Opgeslagen urensegment. */
export interface VeldSegment {
  _id: Id<'urenSegmenten'>;
  categorie: SegmentCategorie;
  werksoort?: import('../lib/werksoorten').Werksoort;
  beginTijd: string;
  eindTijd: string;
  werkitemId?: Id<'projecten'> | null;
  klantId?: string | null;
  status: 'concept' | 'bevestigd' | 'ingediend';
  bron?: string;
  notitie?: string | null;
}

/** Returnwaarde van api.urenSegmenten.getVeldDag. */
export interface VeldDagData {
  medewerker: { _id: Id<'medewerkers'>; naam: string };
  datum: string;
  dagStatus: 'open' | 'ingediend';
  revisie: number;
  ingediendOp: number | null;
  team: { _id: string; naam: string } | null;
  stops: VeldStop[];
  segmenten: VeldSegment[];
  voorstellen: VoorstelSegment[];
  isEigenDag: boolean;
  rol: string;
}

/** Returnwaarde van api.materiaalDelta.getDeltaChecklist (§8.5). */
export interface DeltaChecklistData {
  suggesties?: { naam: string; soort: 'machine' | 'materiaal'; trefwoorden: string[] }[];
  handmatigBenodigd?: { id: import('../convex/_generated/dataModel').Id<'werkitemBenodigdheden'>; naam: string; soort: 'machine' | 'materiaal'; bron: 'handmatig' | 'suggestie' }[];
  kanVerwijderen?: boolean;
  voertuig: { merk: string; kenteken: string } | null;
  delta: {
    naam: string;
    soort: string;
    afgevinkt: boolean;
    afgevinktDoor: string | null;
  }[];
  allesAfgevinkt: boolean;
  mapsUrl: string | null;
}

/** Meerwerk-verzoek (api.meerwerk.listVoorWerkitem). */
export interface MeerwerkRij {
  _id: string;
  omschrijving: string;
  status: 'aangevraagd' | 'goedgekeurd' | 'afgewezen' | 'gefactureerd';
  createdAt: number;
}

/** Returnwaarde van api.instellingen.getVeldInstellingen. */
export interface VeldInstellingenData {
  afwijkingDrempelMinuten: number;
  afwijkingDrempelProcent: number;
  noodprotocolTekst: string | null;
}

/** Afrondingsflow op taakniveau (§8.8): ✓ / ◐ / ○. */
export type TaakStatus = 'afgerond' | 'begonnen_niet_af' | 'niet_gestart';

/** Geldige HH:MM-tijd (client-spiegel van de servervalidatie). */
export function isGeldigeTijd(tijd: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(tijd);
}

/** Begin vóór eind, beide geldig (client-spiegel van de servervalidatie). */
export function isGeldigTijdvak(begin: string, eind: string): boolean {
  return isGeldigeTijd(begin) && isGeldigeTijd(eind) && begin < eind;
}
