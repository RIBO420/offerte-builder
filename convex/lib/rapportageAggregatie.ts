/**
 * Aggregatiehelpers voor de vier vraagsecties van /rapportages.
 *
 * Alles hier is puur en unit-testbaar; `convex/rapportage.ts` doet niets
 * anders dan lezen, filteren op tenant en deze functies aanroepen. De
 * geldbedragen komen uit `omzetDefinities.ts` — hier staat géén tweede
 * omzetberekening.
 *
 * Labels blijven ruwe sleutels (`water_elektra`): mensentaal is UI-werk
 * (masterplan R3), zodat er niet twee vertaaltabellen ontstaan.
 */

import {
  binnenVenster,
  isGetekend,
  isTelbaar,
  peildatumGetekend,
  type OfferteVoorOmzet,
  type Venster,
} from "./omzetDefinities";
import {
  berekenConversionRates,
  berekenPipelineFunnel,
  type PipelineConversionRates,
  type PipelineFunnel,
} from "./pipelineKpis";
// `offertes.klant` is optioneel sinds de offerte-entree (concept zonder klant);
// lezen gaat altijd via klantNaam(), nooit via `offerte.klant.naam`.
import { klantNaam, type OfferteKlant } from "./offerteKlant";

const DAG_MS = 24 * 60 * 60 * 1000;

function rond(n: number): number {
  return Math.round(n * 100) / 100;
}

function rond1(n: number): number {
  return Math.round(n * 10) / 10;
}

function dagenTussen(van: number, tot: number): number {
  return Math.floor((tot - van) / DAG_MS);
}

// ── Statustelling (gedeeld met het dashboard) ────────────────────────────

export interface OfferteStatusTelling {
  concept: number;
  voorcalculatie: number;
  verzonden: number;
  geaccepteerd: number;
  afgewezen: number;
  /** Alles behalve concept — de pipeline begint bij voorcalculatie (§5.3b). */
  pipelineTotaal: number;
}

/**
 * Eén statusteller voor dashboard én rapportage.
 *
 * De legacy-status `definitief` wordt hier expliciet als `voorcalculatie`
 * geteld. Het dashboard deed voorheen `stats[offerte.status]++` op een object
 * zonder `definitief`-sleutel; die offertes belandden in een NaN-veld dat
 * nergens werd getoond. Nu tellen ze mee waar ze horen.
 */
export function telOfferteStatussen(
  offertes: ReadonlyArray<{ status: string }>
): OfferteStatusTelling {
  const telling: OfferteStatusTelling = {
    concept: 0,
    voorcalculatie: 0,
    verzonden: 0,
    geaccepteerd: 0,
    afgewezen: 0,
    pipelineTotaal: 0,
  };

  for (const offerte of offertes) {
    switch (offerte.status) {
      case "concept":
        telling.concept++;
        continue;
      case "voorcalculatie":
      case "definitief": // DEPRECATED-status, hoort bij voorcalculatie
        telling.voorcalculatie++;
        break;
      case "verzonden":
        telling.verzonden++;
        break;
      case "geaccepteerd":
        telling.geaccepteerd++;
        break;
      case "afgewezen":
        telling.afgewezen++;
        break;
      default:
        continue;
    }
    telling.pipelineTotaal++;
  }

  return telling;
}

// ── Sectie 2: pipeline ───────────────────────────────────────────────────

export interface OfferteVoorPipeline extends OfferteVoorOmzet {
  _id: unknown;
  offerteNummer: string;
  type: string;
  /** Optioneel: een concept-offerte mag (nog) zonder klant bestaan. */
  klant?: OfferteKlant;
}

export interface BlijftLiggenRegel {
  offerteId: string;
  offerteNummer: string;
  klantNaam: string;
  status: string;
  type: string;
  bedragInclBtw: number;
  /** Dagen sinds verzenden (of aanmaken als er nooit verzonden is). */
  dagenStil: number;
  /** Peildatum waarop `dagenStil` is gebaseerd. */
  sinds: number;
}

export interface PipelineSectie {
  /** Open offertes op dít moment — bewust niet periodegebonden. */
  openStatussen: OfferteStatusTelling;
  openWaardeInclBtw: number;
  funnel: PipelineFunnel;
  conversie: PipelineConversionRates;
  /** Conversie van de offertes die ín de periode zijn aangemaakt. */
  conversieInPeriode: PipelineConversionRates;
  aangemaaktInPeriode: number;
  blijftLiggen: BlijftLiggenRegel[];
  /** Aantal open offertes dat langer dan `drempelDagen` stil ligt. */
  aantalBlijftLiggen: number;
  drempelDagen: number;
}

const OPEN_STATUSSEN = new Set(["voorcalculatie", "definitief", "verzonden"]);

/**
 * "Wat zit er in de pipeline?"
 *
 * Twee tijdsbegrippen naast elkaar, omdat ze allebei nodig zijn:
 *  - de open offertes zijn open op dit moment, ongeacht welke periode je
 *    bekijkt (een offerte van april ligt in augustus nog steeds stil);
 *  - de conversie gaat over de offertes die ín de periode zijn aangemaakt,
 *    want alleen dan zeg je iets over de instroom van die periode.
 */
export function berekenPipelineSectie(
  offertes: ReadonlyArray<OfferteVoorPipeline>,
  venster: Venster | null,
  nu: number,
  drempelDagen: number = 14,
  maxRegels: number = 12
): PipelineSectie {
  const telbaar = offertes.filter(isTelbaar);

  const open = telbaar.filter((o) => OPEN_STATUSSEN.has(o.status));
  const openStatussen = telOfferteStatussen(open);
  const openWaardeInclBtw = open.reduce(
    (som, o) => som + (o.totalen.totaalInclBtw ?? 0),
    0
  );

  const alleTelling = telOfferteStatussen(telbaar);
  const funnel = berekenPipelineFunnel(alleTelling);
  const conversie = berekenConversionRates(funnel);

  const inPeriode = telbaar.filter((o) => binnenVenster(o.createdAt, venster));
  const conversieInPeriode = berekenConversionRates(
    berekenPipelineFunnel(telOfferteStatussen(inPeriode))
  );

  const blijftLiggenAlles: BlijftLiggenRegel[] = open
    .map((o) => {
      const sinds = o.verzondenAt ?? o.createdAt;
      return {
        offerteId: String(o._id),
        offerteNummer: o.offerteNummer,
        klantNaam: klantNaam(o.klant),
        status: o.status,
        type: o.type,
        bedragInclBtw: rond(o.totalen.totaalInclBtw ?? 0),
        dagenStil: Math.max(0, dagenTussen(sinds, nu)),
        sinds,
      };
    })
    .sort((a, b) => b.dagenStil - a.dagenStil);

  return {
    openStatussen,
    openWaardeInclBtw: rond(openWaardeInclBtw),
    funnel,
    conversie,
    conversieInPeriode,
    aangemaaktInPeriode: inPeriode.length,
    blijftLiggen: blijftLiggenAlles.slice(0, maxRegels),
    aantalBlijftLiggen: blijftLiggenAlles.filter(
      (r) => r.dagenStil >= drempelDagen
    ).length,
    drempelDagen,
  };
}

// ── Sectie 3: openstaande facturen ───────────────────────────────────────

export interface FactuurVoorOuderdom {
  _id: unknown;
  factuurnummer: string;
  klant: { naam: string };
  totaalInclBtw: number;
  vervaldatum: number;
  factuurdatum: number;
}

export interface OpenstaandeFactuurRegel {
  factuurId: string;
  factuurnummer: string;
  klantNaam: string;
  bedragInclBtw: number;
  openstaand: number;
  vervaldatum: number;
  /** Positief = dagen te laat, negatief = dagen tot vervaldatum. */
  dagenTeLaat: number;
  bucket: OuderdomsBucket;
}

export type OuderdomsBucket =
  | "nog_niet_vervallen"
  | "1_30_dagen"
  | "31_60_dagen"
  | "ouder_dan_60_dagen";

export const OUDERDOMS_BUCKETS: readonly OuderdomsBucket[] = [
  "nog_niet_vervallen",
  "1_30_dagen",
  "31_60_dagen",
  "ouder_dan_60_dagen",
];

export function bucketVanOuderdom(dagenTeLaat: number): OuderdomsBucket {
  if (dagenTeLaat <= 0) return "nog_niet_vervallen";
  if (dagenTeLaat <= 30) return "1_30_dagen";
  if (dagenTeLaat <= 60) return "31_60_dagen";
  return "ouder_dan_60_dagen";
}

export interface OpenstaandOverzicht {
  regels: OpenstaandeFactuurRegel[];
  totaalOpenstaand: number;
  perBucket: Record<OuderdomsBucket, { bedrag: number; aantal: number }>;
  /** Gewogen gemiddelde ouderdom van het openstaande bedrag, in dagen. */
  gemiddeldeOuderdomDagen: number;
}

/**
 * "Waar blijft geld liggen?" — deel 1: facturen die nog niet binnen zijn.
 * Bewust NIET periodegebonden: openstaand geld is openstaand, ook als de
 * factuur van vorig kwartaal is. De periodekiezer verandert dit blok niet.
 */
export function berekenOpenstaandOverzicht(
  facturen: ReadonlyArray<
    FactuurVoorOuderdom & { openstaand: number }
  >,
  nu: number,
  maxRegels: number = 12
): OpenstaandOverzicht {
  const perBucket = Object.fromEntries(
    OUDERDOMS_BUCKETS.map((b) => [b, { bedrag: 0, aantal: 0 }])
  ) as Record<OuderdomsBucket, { bedrag: number; aantal: number }>;

  let totaal = 0;
  let gewogenDagen = 0;

  const regels: OpenstaandeFactuurRegel[] = [];

  for (const factuur of facturen) {
    if (factuur.openstaand <= 0) continue;
    const dagenTeLaat = dagenTussen(factuur.vervaldatum, nu);
    const bucket = bucketVanOuderdom(dagenTeLaat);
    perBucket[bucket].bedrag = rond(perBucket[bucket].bedrag + factuur.openstaand);
    perBucket[bucket].aantal++;
    totaal += factuur.openstaand;
    gewogenDagen += Math.max(0, dagenTeLaat) * factuur.openstaand;

    regels.push({
      factuurId: String(factuur._id),
      factuurnummer: factuur.factuurnummer,
      klantNaam: factuur.klant?.naam ?? "Onbekende klant",
      bedragInclBtw: rond(factuur.totaalInclBtw),
      openstaand: rond(factuur.openstaand),
      vervaldatum: factuur.vervaldatum,
      dagenTeLaat,
      bucket,
    });
  }

  regels.sort((a, b) => b.dagenTeLaat - a.dagenTeLaat);

  return {
    regels: regels.slice(0, maxRegels),
    totaalOpenstaand: rond(totaal),
    perBucket,
    gemiddeldeOuderdomDagen: totaal > 0 ? rond1(gewogenDagen / totaal) : 0,
  };
}

// ── Sectie 3: voor- vs. nacalculatie ─────────────────────────────────────

export interface VoorNaPaar {
  projectId: string;
  projectNaam: string;
  klantNaam: string;
  /** Peildatum van het project (createdAt). */
  peildatum: number;
  geplandeUren: number;
  werkelijkeUren: number;
  /** Afwijking per scope in uren (positief = meer uren dan begroot). */
  afwijkingenPerScope: Record<string, number>;
  normUrenPerScope: Record<string, number>;
}

export interface VoorNaProjectRegel {
  projectId: string;
  projectNaam: string;
  klantNaam: string;
  peildatum: number;
  geplandeUren: number;
  werkelijkeUren: number;
  afwijkingUren: number;
  afwijkingPercentage: number;
  /** Binnen 10% van de begroting. */
  isAccuraat: boolean;
  /** Geldwaarde van de afwijking tegen het uurtarief. */
  afwijkingEuro: number;
}

export interface VoorNaScopeRegel {
  scope: string;
  geplandeUren: number;
  werkelijkeUren: number;
  afwijkingUren: number;
  afwijkingPercentage: number;
  afwijkingEuro: number;
  aantalProjecten: number;
}

export interface VoorNaCalculatie {
  aantalProjecten: number;
  /** Projecten met een afwijking binnen 10%. */
  accurateProjecten: number;
  /** Percentage projecten binnen 10% — de "trefzekerheid" van de begroting. */
  accuratessePercentage: number;
  geplandeUren: number;
  werkelijkeUren: number;
  afwijkingUren: number;
  afwijkingPercentage: number;
  /** Uren boven begroting × uurtarief: het geld dat weglekt. */
  afwijkingEuro: number;
  uurtarief: number;
  projecten: VoorNaProjectRegel[];
  scopes: VoorNaScopeRegel[];
  /** Projecten zonder nacalculatie — daarom kan dit blok onvolledig zijn. */
  projectenZonderNacalculatie: number;
}

const ACCURAAT_MARGE_PROCENT = 10;

/**
 * "Waar blijft geld liggen?" — deel 2: begroot versus werkelijk.
 *
 * De afwijking wordt ook in euro's uitgedrukt (uren × uurtarief), want
 * "12% over de begroting" zegt een hovenier minder dan "€ 2.400 aan uren
 * die niemand betaald heeft".
 */
export function berekenVoorNaCalculatie(
  paren: ReadonlyArray<VoorNaPaar>,
  uurtarief: number,
  projectenZonderNacalculatie: number = 0,
  maxRegels: number = 12
): VoorNaCalculatie {
  const scopeAggregatie: Record<
    string,
    { gepland: number; werkelijk: number; aantal: number }
  > = {};

  const projecten: VoorNaProjectRegel[] = paren.map((paar) => {
    const afwijkingUren = paar.werkelijkeUren - paar.geplandeUren;
    const afwijkingPercentage =
      paar.geplandeUren > 0 ? rond1((afwijkingUren / paar.geplandeUren) * 100) : 0;

    const scopes = new Set([
      ...Object.keys(paar.normUrenPerScope ?? {}),
      ...Object.keys(paar.afwijkingenPerScope ?? {}),
    ]);
    for (const scope of scopes) {
      const gepland = paar.normUrenPerScope?.[scope] ?? 0;
      const afwijking = paar.afwijkingenPerScope?.[scope] ?? 0;
      if (!scopeAggregatie[scope]) {
        scopeAggregatie[scope] = { gepland: 0, werkelijk: 0, aantal: 0 };
      }
      scopeAggregatie[scope].gepland += gepland;
      scopeAggregatie[scope].werkelijk += gepland + afwijking;
      scopeAggregatie[scope].aantal++;
    }

    return {
      projectId: paar.projectId,
      projectNaam: paar.projectNaam,
      klantNaam: paar.klantNaam,
      peildatum: paar.peildatum,
      geplandeUren: rond1(paar.geplandeUren),
      werkelijkeUren: rond1(paar.werkelijkeUren),
      afwijkingUren: rond1(afwijkingUren),
      afwijkingPercentage,
      isAccuraat: Math.abs(afwijkingPercentage) <= ACCURAAT_MARGE_PROCENT,
      afwijkingEuro: rond(afwijkingUren * uurtarief),
    };
  });

  const geplandeUren = paren.reduce((s, p) => s + p.geplandeUren, 0);
  const werkelijkeUren = paren.reduce((s, p) => s + p.werkelijkeUren, 0);
  const afwijkingUren = werkelijkeUren - geplandeUren;
  const accurateProjecten = projecten.filter((p) => p.isAccuraat).length;

  const scopes: VoorNaScopeRegel[] = Object.entries(scopeAggregatie)
    .map(([scope, s]) => {
      const afwijking = s.werkelijk - s.gepland;
      return {
        scope,
        geplandeUren: rond1(s.gepland),
        werkelijkeUren: rond1(s.werkelijk),
        afwijkingUren: rond1(afwijking),
        afwijkingPercentage: s.gepland > 0 ? rond1((afwijking / s.gepland) * 100) : 0,
        afwijkingEuro: rond(afwijking * uurtarief),
        aantalProjecten: s.aantal,
      };
    })
    .sort((a, b) => Math.abs(b.afwijkingEuro) - Math.abs(a.afwijkingEuro));

  return {
    aantalProjecten: paren.length,
    accurateProjecten,
    accuratessePercentage:
      paren.length > 0 ? Math.round((accurateProjecten / paren.length) * 100) : 0,
    geplandeUren: rond1(geplandeUren),
    werkelijkeUren: rond1(werkelijkeUren),
    afwijkingUren: rond1(afwijkingUren),
    afwijkingPercentage:
      geplandeUren > 0 ? rond1((afwijkingUren / geplandeUren) * 100) : 0,
    afwijkingEuro: rond(afwijkingUren * uurtarief),
    uurtarief,
    projecten: projecten
      .slice()
      .sort((a, b) => Math.abs(b.afwijkingEuro) - Math.abs(a.afwijkingEuro))
      .slice(0, maxRegels),
    scopes,
    projectenZonderNacalculatie,
  };
}

// ── Sectie 4: marge per scope ────────────────────────────────────────────

export interface OfferteVoorScope extends OfferteVoorOmzet {
  scopes?: string[];
  regels?: ReadonlyArray<{ scope: string; totaal: number }>;
}

export interface ScopeMargeRegel {
  scope: string;
  omzetExclBtw: number;
  marge: number;
  margePercentage: number;
  aantalOffertes: number;
  /** Aandeel in de totale getekende omzet ex btw, in procenten. */
  aandeelPercentage: number;
}

/**
 * Marge per scope over de getekende offertes in de periode.
 *
 * De omzet wordt toegerekend op basis van de daadwerkelijke regelbedragen
 * per scope. Alleen als een offerte geen bruikbare regels heeft, valt de
 * berekening terug op een gelijke verdeling over de scopes — dat was
 * voorheen de enige methode en trok kleine scopes structureel omhoog.
 */
export function berekenScopeMarges(
  offertes: ReadonlyArray<OfferteVoorScope>,
  venster: Venster | null
): ScopeMargeRegel[] {
  const perScope: Record<
    string,
    { omzet: number; marge: number; aantal: number }
  > = {};

  for (const offerte of offertes) {
    if (!isGetekend(offerte)) continue;
    if (!binnenVenster(peildatumGetekend(offerte), venster)) continue;

    const scopes = offerte.scopes?.length
      ? offerte.scopes
      : [...new Set((offerte.regels ?? []).map((r) => r.scope).filter(Boolean))];
    if (scopes.length === 0) continue;

    const omzet = offerte.totalen.totaalExBtw ?? 0;
    const marge = offerte.totalen.marge ?? 0;

    // Aandeel per scope uit de regelbedragen; anders gelijk verdelen.
    const regelsPerScope: Record<string, number> = {};
    let regelTotaal = 0;
    for (const regel of offerte.regels ?? []) {
      if (!regel.scope || !scopes.includes(regel.scope)) continue;
      regelsPerScope[regel.scope] = (regelsPerScope[regel.scope] ?? 0) + regel.totaal;
      regelTotaal += regel.totaal;
    }

    for (const scope of scopes) {
      const aandeel =
        regelTotaal > 0 ? (regelsPerScope[scope] ?? 0) / regelTotaal : 1 / scopes.length;
      if (!perScope[scope]) perScope[scope] = { omzet: 0, marge: 0, aantal: 0 };
      perScope[scope].omzet += omzet * aandeel;
      perScope[scope].marge += marge * aandeel;
      perScope[scope].aantal++;
    }
  }

  const totaleOmzet = Object.values(perScope).reduce((s, v) => s + v.omzet, 0);

  return Object.entries(perScope)
    .map(([scope, v]) => ({
      scope,
      omzetExclBtw: rond(v.omzet),
      marge: rond(v.marge),
      margePercentage: v.omzet > 0 ? rond1((v.marge / v.omzet) * 100) : 0,
      aantalOffertes: v.aantal,
      aandeelPercentage: totaleOmzet > 0 ? rond1((v.omzet / totaleOmzet) * 100) : 0,
    }))
    .sort((a, b) => b.omzetExclBtw - a.omzetExclBtw);
}

// ── Sectie 4: topklanten ─────────────────────────────────────────────────

export interface OfferteVoorKlant extends OfferteVoorOmzet {
  klantId?: unknown;
  /** Optioneel: een concept-offerte mag (nog) zonder klant bestaan. */
  klant?: OfferteKlant;
}

export interface TopKlantRegel {
  klantId: string | null;
  klantNaam: string;
  getekendeOmzetExclBtw: number;
  getekendeOmzetInclBtw: number;
  marge: number;
  margePercentage: number;
  aantalGetekend: number;
  laatsteOpdracht: number;
  /** Twee of meer getekende opdrachten in deze periode. */
  isTerugkerend: boolean;
}

export function berekenTopKlanten(
  offertes: ReadonlyArray<OfferteVoorKlant>,
  venster: Venster | null,
  maxRegels: number = 10
): { klanten: TopKlantRegel[]; aantalKlanten: number; aantalTerugkerend: number } {
  const perKlant: Record<
    string,
    {
      klantId: string | null;
      klantNaam: string;
      exclBtw: number;
      inclBtw: number;
      marge: number;
      aantal: number;
      laatste: number;
    }
  > = {};

  for (const offerte of offertes) {
    if (!isGetekend(offerte)) continue;
    const peildatum = peildatumGetekend(offerte);
    if (!binnenVenster(peildatum, venster)) continue;

    const naam = klantNaam(offerte.klant);
    const sleutel = offerte.klantId ? String(offerte.klantId) : `naam:${naam}`;
    if (!perKlant[sleutel]) {
      perKlant[sleutel] = {
        klantId: offerte.klantId ? String(offerte.klantId) : null,
        klantNaam: naam,
        exclBtw: 0,
        inclBtw: 0,
        marge: 0,
        aantal: 0,
        laatste: peildatum,
      };
    }
    const rij = perKlant[sleutel];
    rij.exclBtw += offerte.totalen.totaalExBtw ?? 0;
    rij.inclBtw += offerte.totalen.totaalInclBtw ?? 0;
    rij.marge += offerte.totalen.marge ?? 0;
    rij.aantal++;
    if (peildatum > rij.laatste) rij.laatste = peildatum;
  }

  const klanten = Object.values(perKlant)
    .map((v) => ({
      klantId: v.klantId,
      klantNaam: v.klantNaam,
      getekendeOmzetExclBtw: rond(v.exclBtw),
      getekendeOmzetInclBtw: rond(v.inclBtw),
      marge: rond(v.marge),
      margePercentage: v.exclBtw > 0 ? rond1((v.marge / v.exclBtw) * 100) : 0,
      aantalGetekend: v.aantal,
      laatsteOpdracht: v.laatste,
      isTerugkerend: v.aantal >= 2,
    }))
    .sort((a, b) => b.getekendeOmzetExclBtw - a.getekendeOmzetExclBtw);

  return {
    klanten: klanten.slice(0, maxRegels),
    aantalKlanten: klanten.length,
    aantalTerugkerend: klanten.filter((k) => k.isTerugkerend).length,
  };
}

// ── Maandreeks (bewijsgrafiek sectie 1) ──────────────────────────────────

export interface MaandPunt {
  /** Sorteerbare sleutel `YYYY-MM`. */
  maandKey: string;
  /** Kort label voor de as: "aug 2026". */
  label: string;
  getekendeOmzetExclBtw: number;
  gefactureerdInclBtw: number;
  aantalGetekend: number;
}

const MAANDNAMEN_KORT = [
  "jan", "feb", "mrt", "apr", "mei", "jun",
  "jul", "aug", "sep", "okt", "nov", "dec",
];

function maandKeyVan(tijdstip: number): string {
  const d = new Date(tijdstip);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function maandLabelVan(tijdstip: number): string {
  const d = new Date(tijdstip);
  return `${MAANDNAMEN_KORT[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Maandreeks binnen het venster, met lege maanden expliciet op nul.
 * Zonder die nullen suggereert een lijngrafiek doorlopende activiteit in een
 * maand waarin niets gebeurde.
 *
 * Het venster wordt geknipt op `maxMaanden` eindigend bij de referentiedatum;
 * bij preset "alles" (venster van 1970 tot het einde der tijden) levert dat
 * de laatste drie jaar in plaats van 660 lege balken.
 */
export function berekenMaandReeks(
  offertes: ReadonlyArray<OfferteVoorOmzet>,
  facturen: ReadonlyArray<{
    factuurdatum: number;
    totaalInclBtw: number;
    gefactureerd: boolean;
  }>,
  venster: Venster,
  nu: number,
  maxMaanden: number = 36
): MaandPunt[] {
  const punten = new Map<string, MaandPunt>();

  const nuDatum = new Date(nu);
  const naVandaag = new Date(nuDatum.getFullYear(), nuDatum.getMonth() + 1, 1).getTime();
  const eind = Math.min(venster.eind, naVandaag);
  const eindDatum = new Date(eind);
  const vroegstToegestaan = new Date(
    eindDatum.getFullYear(),
    eindDatum.getMonth() - maxMaanden,
    1
  ).getTime();

  const startTijd = Math.max(venster.start, vroegstToegestaan);
  const startDatum = new Date(startTijd);
  const cursor = new Date(startDatum.getFullYear(), startDatum.getMonth(), 1);

  let teller = 0;
  while (cursor.getTime() < eind && teller <= maxMaanden) {
    const key = maandKeyVan(cursor.getTime());
    punten.set(key, {
      maandKey: key,
      label: maandLabelVan(cursor.getTime()),
      getekendeOmzetExclBtw: 0,
      gefactureerdInclBtw: 0,
      aantalGetekend: 0,
    });
    cursor.setMonth(cursor.getMonth() + 1);
    teller++;
  }

  for (const offerte of offertes) {
    if (!isGetekend(offerte)) continue;
    const peildatum = peildatumGetekend(offerte);
    if (!binnenVenster(peildatum, venster)) continue;
    const punt = punten.get(maandKeyVan(peildatum));
    if (!punt) continue;
    punt.getekendeOmzetExclBtw = rond(
      punt.getekendeOmzetExclBtw + (offerte.totalen.totaalExBtw ?? 0)
    );
    punt.aantalGetekend++;
  }

  for (const factuur of facturen) {
    if (!factuur.gefactureerd) continue;
    if (!binnenVenster(factuur.factuurdatum, venster)) continue;
    const punt = punten.get(maandKeyVan(factuur.factuurdatum));
    if (!punt) continue;
    punt.gefactureerdInclBtw = rond(
      punt.gefactureerdInclBtw + (factuur.totaalInclBtw ?? 0)
    );
  }

  return [...punten.values()].sort((a, b) => a.maandKey.localeCompare(b.maandKey));
}
