/**
 * Demo-data voor de dev-deployment — met een exacte ongedaan-knop.
 * =================================================================
 *
 * Waarom dit bestaat: de dev-database is vrijwel leeg (2 klanten, 2 offertes,
 * 0 projecten). Elk scherm toont dan een lege staat, en een screenshot van een
 * lege staat zegt niets over de UI. Deze seed vult dezelfde dev-deployment die
 * de ontwikkelaar én een agent voor zich zien — bewust géén aparte database,
 * want dan kijken die twee weer naar verschillende schermen.
 *
 * ┌─ Het ontwerp in één regel ────────────────────────────────────────────┐
 * │ Elk document dat de seed aanmaakt krijgt een regel in `demoSeed`;     │
 * │ opruimen verwijdert UITSLUITEND wat daarin staat.                     │
 * └───────────────────────────────────────────────────────────────────────┘
 *
 * Dat is geen detail maar de kern. In deze deployment staat óók echte,
 * geïmporteerde klantdata (255 klanten uit een relatie-export). Opruimen op
 * "alles in tabel X" of op een naampatroon ("alles met @voorbeeld.test") zou
 * vroeg of laat door die data heen lopen. De registratietabel maakt dat
 * onmogelijk: onbekende documenten kán deze code niet verwijderen.
 *
 * Commando's:
 *     npm run seed:demo    → vult de dev-deployment
 *     npm run seed:clear   → verwijdert exact wat de seed heeft aangemaakt
 *
 * Contactgegevens — NIET "realistischer" maken
 * --------------------------------------------
 * De app heeft e-mailtriggers (`convex/mailTriggers.ts`) en een
 * concept-mail-wachtrij (`convex/conceptMails.ts`). Een demo-klant met een
 * echt ogend e-mailadres kan daardoor post krijgen op het adres van een
 * onbekende. Daarom:
 *  - e-mail: uitsluitend het door IANA gereserveerde top-level domein `.test`
 *    (RFC 2606) — `@voorbeeld.test` kan per definitie nooit bezorgd worden;
 *  - telefoon: het nummerblok `06-9…` wordt in het Nederlandse nummerplan
 *    niet uitgegeven voor mobiel (mobiel loopt via 06-1 t/m 06-5). De nummers
 *    zien er Nederlands uit, voldoen aan `PHONE_PATTERN` uit
 *    `convex/validators.ts`, en bellen niemand.
 * Verander dit niet "voor de echtheid" — dan mailt of belt de demo een vreemde.
 */

import { v } from "convex/values";
import type { DocumentByName, WithoutSystemFields } from "convex/server";
import { ConvexError } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { DataModel, Doc, Id, TableNames } from "./_generated/dataModel";

// ============================================================
// 1. Productie-guard
// ============================================================

/** Dev-deployment: hier mag de seed draaien. */
const DEV_DEPLOYMENT = "affable-rook-669";
/** Productie-deployment: hier mag de seed onder geen beding draaien. */
const PROD_DEPLOYMENT = "impartial-dinosaur-829";

/**
 * Bevestiging die het npm-script meegeeft. Alleen nodig als de deployment
 * zichzelf niet kan identificeren (zie `bepaalDeployment`).
 */
const BEVESTIGING = DEV_DEPLOYMENT;

/**
 * Naam van de deployment waarop deze functie draait.
 *
 * Convex zet in élke functie-omgeving twee systeem-env-variabelen klaar:
 * `CONVEX_CLOUD_URL` (https://<deployment>.convex.cloud) en `CONVEX_SITE_URL`.
 * Ze staan niet in `npx convex env list` — dat toont alleen zelf-gezette
 * variabelen — maar zijn wel beschikbaar. Daaruit halen we de subdomeinnaam.
 *
 * Levert `null` op als de URL ontbreekt of niet te ontleden is; de aanroeper
 * kiest dan de veilige kant en eist een expliciete bevestiging.
 */
function bepaalDeployment(): string | null {
  const url = process.env.CONVEX_CLOUD_URL ?? process.env.CONVEX_SITE_URL ?? "";
  const match = url.match(/^https?:\/\/([^./]+)\./);
  return match ? match[1] : null;
}

/**
 * Weiger te draaien op iets anders dan de dev-deployment.
 *
 * Drie uitkomsten:
 *  1. herkende dev-deployment  → doorgaan;
 *  2. herkende andere deployment (productie of onbekend) → harde weigering;
 *  3. deployment niet vast te stellen → alleen doorgaan met de expliciete
 *     bevestigingsparameter die `npm run seed:demo` meegeeft. Zonder die
 *     terugvaloptie zou een toekomstige Convex-versie die de env-variabele
 *     hernoemt de guard stilzwijgend uitschakelen; nu faalt hij juist dicht.
 */
function bewaakDeployment(bevestiging: string | undefined): string {
  const deployment = bepaalDeployment();

  if (deployment === DEV_DEPLOYMENT) return deployment;

  if (deployment === PROD_DEPLOYMENT) {
    throw new ConvexError(
      `Weigering: dit is de PRODUCTIE-deployment (${PROD_DEPLOYMENT}). ` +
        "De demo-seed draait uitsluitend op de dev-deployment " +
        `${DEV_DEPLOYMENT}.`
    );
  }

  if (deployment !== null) {
    throw new ConvexError(
      `Weigering: onbekende deployment "${deployment}". De demo-seed draait ` +
        `uitsluitend op de dev-deployment ${DEV_DEPLOYMENT}.`
    );
  }

  if (bevestiging !== BEVESTIGING) {
    throw new ConvexError(
      "Weigering: de deployment is niet vast te stellen (CONVEX_CLOUD_URL " +
        "ontbreekt). Geef expliciet mee op welke deployment je denkt te " +
        `draaien: --bevestigDeployment "${BEVESTIGING}".`
    );
  }

  return `${BEVESTIGING} (op bevestiging, niet zelf vastgesteld)`;
}

// ============================================================
// 2. Registratie: insert + boekhouding in één handeling
// ============================================================

/**
 * Insert het document én leg vast dat de seed het heeft aangemaakt.
 *
 * Altijd deze helper gebruiken, nooit `ctx.db.insert` rechtstreeks: een
 * document zonder registratie blijft bij het opruimen achter en vervuilt de
 * dev-database voorgoed.
 */
async function bewaar<T extends TableNames>(
  ctx: MutationCtx,
  geseedOp: number,
  tabel: T,
  doc: WithoutSystemFields<DocumentByName<DataModel, T>>
): Promise<Id<T>> {
  const id = await ctx.db.insert(tabel, doc);
  await ctx.db.insert("demoSeed", {
    tabel,
    documentId: id,
    geseedOp,
  });
  return id;
}

// ============================================================
// 3. Hulpjes
// ============================================================

/**
 * Deterministische pseudo-random (LCG). Bewust geen `Math.random()`: twee
 * seed-runs leveren dan dezelfde bedragen en datums op, wat het vergelijken
 * van screenshots vóór en ná een UI-wijziging een stuk rustiger maakt.
 */
function maakRandom(zaad: number) {
  let staat = zaad;
  return () => {
    staat = (staat * 1664525 + 1013904223) % 4294967296;
    return staat / 4294967296;
  };
}

const DAG = 24 * 60 * 60 * 1000;

/** YYYY-MM-DD, `dagen` dagen vanaf `basis` (negatief = verleden). */
function datumISO(basis: number, dagen: number): string {
  return new Date(basis + dagen * DAG).toISOString().slice(0, 10);
}

/** Twee decimalen — bedragen mogen geen drijvende-komma-ruis tonen. */
function afgerond(bedrag: number): number {
  return Math.round(bedrag * 100) / 100;
}

/**
 * Tijdstip in het VORIGE kalenderjaar, op maand/dag, 10:00 lokale tijd.
 *
 * De historie-offertes rekenen bewust niet in "zoveel dagen geleden" zoals de
 * rest van de seed. De rapportage vergelijkt op kalendergrenzen ("2025" versus
 * "2026", "Zomer 2025" versus "Zomer 2026"); een vaste dagafstand valt bij een
 * seed-run in een andere maand net aan de verkeerde kant van 1 januari. Een
 * anker op het vorige kalenderjaar ligt per definitie altijd volledig in het
 * verleden én volledig in "vorig jaar", wanneer je ook seedt.
 */
function vorigJaarOp(basis: number, maand: number, dag: number): number {
  return new Date(
    new Date(basis).getFullYear() - 1,
    maand,
    dag,
    10,
    0,
    0,
    0
  ).getTime();
}

// ============================================================
// 4. De demo-gegevens (regio Zuid-Limburg)
// ============================================================

/**
 * Top Tuinen zit in Zuid-Limburg; in de echte relatie-import kwamen plaatsen
 * als Sittard, Grevenbicht en Echt voor. De demo houdt diezelfde regio aan,
 * zodat filters op plaats en postcode realistisch gedrag laten zien.
 * Bedrijfs-, VvE- en gemeentenamen zijn bewust verzonnen.
 */
type KlantSpec = {
  naam: string;
  adres: string;
  postcode: string;
  plaats: string;
  type: "particulier" | "zakelijk" | "vve" | "gemeente";
  contactpersoon?: string;
};

const KLANTEN: KlantSpec[] = [
  { naam: "Jos Ummels", adres: "Putstraat 14", postcode: "6131 HL", plaats: "Sittard", type: "particulier" },
  { naam: "Marieke Ramaekers", adres: "Molenweg 62", postcode: "6162 BC", plaats: "Geleen", type: "particulier" },
  { naam: "Pierre Dohmen", adres: "Dijk 24A", postcode: "6127 AG", plaats: "Grevenbicht", type: "particulier" },
  { naam: "Anouk Willems", adres: "Maaseikerweg 8", postcode: "6101 BS", plaats: "Echt", type: "particulier" },
  { naam: "Harrie Janssen", adres: "Bornerweg 133", postcode: "6121 BW", plaats: "Born", type: "particulier" },
  { naam: "Els Meurders", adres: "Kerkstraat 41", postcode: "6151 CG", plaats: "Munstergeleen", type: "particulier" },
  { naam: "Twan Peeters", adres: "Julianastraat 7", postcode: "6191 KA", plaats: "Beek", type: "particulier" },
  { naam: "Sanne Coumans", adres: "Heerstraat Centrum 29", postcode: "6171 HW", plaats: "Stein", type: "particulier" },
  { naam: "Wim Salden", adres: "Op de Berg 5", postcode: "6181 GT", plaats: "Elsloo", type: "particulier" },
  { naam: "Lieke Vranken", adres: "Urmonderbaan 88", postcode: "6129 CG", plaats: "Urmond", type: "particulier" },
  { naam: "Ger Hermans", adres: "Willibrordusstraat 16", postcode: "6114 JS", plaats: "Susteren", type: "particulier" },
  { naam: "Nicole Smeets", adres: "Beekstraat 3", postcode: "6118 AT", plaats: "Nieuwstadt", type: "particulier" },
  { naam: "Raymond Cuijpers", adres: "Beekstraat 57", postcode: "6141 CB", plaats: "Limbricht", type: "particulier" },
  { naam: "Petra Houben", adres: "Kempenweg 21", postcode: "6125 BJ", plaats: "Obbicht", type: "particulier" },
  { naam: "Frank Lemmens", adres: "Veestraat 12", postcode: "6124 AL", plaats: "Papenhoven", type: "particulier" },
  { naam: "Ine Nijsten", adres: "Kloosterstraat 30", postcode: "6129 EN", plaats: "Berg aan de Maas", type: "particulier" },
  { naam: "Bart Odekerken", adres: "Wilgenstraat 4", postcode: "6155 KV", plaats: "Puth", type: "particulier" },
  { naam: "Hub Weerts", adres: "Tudderenderweg 145", postcode: "6137 CJ", plaats: "Sittard", type: "particulier" },
  { naam: "Diana Cremers", adres: "Groenstraat 19", postcode: "6161 HJ", plaats: "Geleen", type: "particulier" },
  { naam: "Bouwbedrijf Frissen B.V.", adres: "Handelsstraat 51", postcode: "6135 KK", plaats: "Sittard", type: "zakelijk", contactpersoon: "Rob Frissen" },
  { naam: "Logistiek Maasdal B.V.", adres: "Industrieweg 12", postcode: "6121 SB", plaats: "Born", type: "zakelijk", contactpersoon: "Sylvia Driessen" },
  { naam: "Zorgcentrum De Lindehof", adres: "Lindenlaan 2", postcode: "6165 BR", plaats: "Geleen", type: "zakelijk", contactpersoon: "Jeroen Hesen" },
  { naam: "VvE Residentie Kollenberg", adres: "Kollenberg 74", postcode: "6132 AG", plaats: "Sittard", type: "vve", contactpersoon: "Ans Kessels" },
  { naam: "VvE Park Molenbeek", adres: "Molenbeekpark 9", postcode: "6163 XN", plaats: "Geleen", type: "vve", contactpersoon: "Theo Wolters" },
  { naam: "Gemeente Maasdal", adres: "Raadhuisplein 1", postcode: "6102 BM", plaats: "Echt", type: "gemeente", contactpersoon: "Mark Beckers" },
];

/** Kanban-kolommen van /leads (configuratorAanvragen.pipelineStatus). */
type LeadKolom = "nieuw" | "contact_gehad" | "offerte_verstuurd" | "gewonnen" | "verloren";

type LeadSpec = {
  naam: string;
  plaats: string;
  postcode: string;
  adres: string;
  kolom: LeadKolom;
  bron:
    | "configurator_gazon"
    | "configurator_boomschors"
    | "configurator_verticuteren"
    | "website_contact"
    | "handmatig"
    | "telefoon"
    | "email"
    | "doorverwijzing";
  waarde: number;
  omschrijving: string;
};

const LEADS: LeadSpec[] = [
  { naam: "Ruud Verheggen", plaats: "Sittard", postcode: "6136 GT", adres: "Rijksweg Zuid 210", kolom: "nieuw", bron: "configurator_gazon", waarde: 2400, omschrijving: "Nieuw gazon achtertuin, 120 m²" },
  { naam: "Chantal Bours", plaats: "Geleen", postcode: "6166 AB", adres: "Anjelierstraat 33", kolom: "nieuw", bron: "website_contact", waarde: 5800, omschrijving: "Terras vervangen, keramisch" },
  { naam: "Math Erkens", plaats: "Echt", postcode: "6104 AN", adres: "Peijerstraat 62", kolom: "nieuw", bron: "telefoon", waarde: 1750, omschrijving: "Haag snoeien en afvoeren, 45 m" },
  { naam: "Yvonne Stassen", plaats: "Born", postcode: "6121 JL", adres: "Kerkstraat 18", kolom: "nieuw", bron: "configurator_boomschors", waarde: 890, omschrijving: "Boomschors leveren en aanbrengen" },
  { naam: "Peter Wolters", plaats: "Stein", postcode: "6171 EE", adres: "Mauritsweg 4", kolom: "contact_gehad", bron: "doorverwijzing", waarde: 14500, omschrijving: "Complete achtertuin, bestrating en borders" },
  { naam: "Sylvia Grond", plaats: "Beek", postcode: "6191 VN", adres: "Prins Mauritslaan 71", kolom: "contact_gehad", bron: "email", waarde: 3200, omschrijving: "Beregening voortuin, 2 zones" },
  { naam: "Jack Corstjens", plaats: "Susteren", postcode: "6114 BE", adres: "Feurthstraat 9", kolom: "contact_gehad", bron: "configurator_verticuteren", waarde: 640, omschrijving: "Verticuteren en bijzaaien, 300 m²" },
  { naam: "Nathalie Habets", plaats: "Sittard", postcode: "6133 AV", adres: "Bradleystraat 27", kolom: "offerte_verstuurd", bron: "handmatig", waarde: 9600, omschrijving: "Vlonder en pergola in hardhout" },
  { naam: "Rob Simons", plaats: "Grevenbicht", postcode: "6127 BH", adres: "Bornerweg 55", kolom: "offerte_verstuurd", bron: "website_contact", waarde: 7300, omschrijving: "Oprit in betonklinkers, 90 m²" },
  { naam: "Ellen Kuipers", plaats: "Geleen", postcode: "6164 HN", adres: "Norbertijnenstraat 12", kolom: "offerte_verstuurd", bron: "configurator_gazon", waarde: 2150, omschrijving: "Graszoden en opsluitbanden" },
  { naam: "Serviceflat Aldenhof", plaats: "Sittard", postcode: "6137 BK", adres: "Aldenhofpark 3", kolom: "gewonnen", bron: "doorverwijzing", waarde: 18900, omschrijving: "Jaarcontract onderhoud buitenterrein" },
  { naam: "Marco Delnoy", plaats: "Elsloo", postcode: "6181 EH", adres: "Burg. Maenenstraat 41", kolom: "gewonnen", bron: "telefoon", waarde: 6400, omschrijving: "Parkeerplaats bedrijfspand, 6 plaatsen" },
  { naam: "Miriam Op den Kamp", plaats: "Nieuwstadt", postcode: "6118 CD", adres: "Sittarderweg 22", kolom: "verloren", bron: "website_contact", waarde: 4100, omschrijving: "Tuinrenovatie — koos andere hovenier" },
  { naam: "Tim Schoenmakers", plaats: "Munstergeleen", postcode: "6151 AL", adres: "Pastoor Vonckenstraat 6", kolom: "verloren", bron: "email", waarde: 2700, omschrijving: "Schutting plaatsen — budget te krap" },
  { naam: "Karin Bekkers", plaats: "Urmond", postcode: "6129 BR", adres: "Grotestraat 88", kolom: "verloren", bron: "configurator_gazon", waarde: 1300, omschrijving: "Kunstgras — project uitgesteld" },
];

/** Reden bij een verloren lead (index loopt gelijk met de "verloren"-leads). */
const VERLIES_REDENEN = [
  "Prijs: concurrent zat 12% lager",
  "Budget: klant stelt uit naar volgend jaar",
  "Timing: wij konden pas in het najaar starten",
];

type MedewerkerSpec = {
  naam: string;
  functie: string;
  uurtarief: number;
  contractType: "fulltime" | "parttime" | "zzp" | "seizoen";
};

const MEDEWERKERS: MedewerkerSpec[] = [
  { naam: "Sjaak Ummels", functie: "Voorman", uurtarief: 52, contractType: "fulltime" },
  { naam: "Dennis Kessels", functie: "Hovenier", uurtarief: 46, contractType: "fulltime" },
  { naam: "Roel Notten", functie: "Hovenier", uurtarief: 46, contractType: "fulltime" },
  { naam: "Kevin Bruls", functie: "Stratenmaker", uurtarief: 49, contractType: "fulltime" },
  { naam: "Lars Hendriks", functie: "Leerling hovenier", uurtarief: 32, contractType: "parttime" },
  { naam: "Ilse Gerards", functie: "Hovenier onderhoud", uurtarief: 44, contractType: "fulltime" },
];

/** Eén offerteregel zoals de wizard hem oplevert. */
type RegelSpec = {
  scope: string;
  omschrijving: string;
  eenheid: string;
  hoeveelheid: number;
  prijs: number;
  soort: "materiaal" | "arbeid" | "machine";
};

type OfferteSpec = {
  /** Index in KLANTEN. */
  klant: number;
  type: "aanleg" | "onderhoud";
  status: "concept" | "voorcalculatie" | "verzonden" | "geaccepteerd" | "afgewezen";
  scopes: string[];
  /** Scope-specifieke invoer; moet door de validators uit validators.ts komen. */
  scopeData: Record<string, unknown>;
  regels: RegelSpec[];
  /** Dagen geleden aangemaakt. */
  dagenGeleden: number;
};

const OFFERTES: OfferteSpec[] = [
  // ── concept (4) ─────────────────────────────────────────────────────
  {
    klant: 0,
    type: "aanleg",
    status: "concept",
    scopes: ["grondwerk", "bestrating"],
    scopeData: {
      grondwerk: { oppervlakte: 85, diepte: "standaard", afvoerGrond: true },
      bestrating: {
        oppervlakte: 72,
        typeBestrating: "klinker",
        snijwerk: "gemiddeld",
        onderbouw: { type: "zand_fundering", dikteOnderlaag: 20, opsluitbanden: true },
        bestratingtype: "terrein",
      },
    },
    regels: [
      { scope: "grondwerk", omschrijving: "Ontgraven en afvoeren grond", eenheid: "m³", hoeveelheid: 21, prijs: 46, soort: "materiaal" },
      { scope: "grondwerk", omschrijving: "Grondwerk uitvoeren", eenheid: "uur", hoeveelheid: 14, prijs: 48, soort: "arbeid" },
      { scope: "bestrating", omschrijving: "Betonklinkers dikformaat", eenheid: "m²", hoeveelheid: 72, prijs: 28, soort: "materiaal" },
      { scope: "bestrating", omschrijving: "Bestrating aanbrengen", eenheid: "uur", hoeveelheid: 32, prijs: 48, soort: "arbeid" },
      { scope: "bestrating", omschrijving: "Trilplaat inzet", eenheid: "dag", hoeveelheid: 2, prijs: 85, soort: "machine" },
    ],
    dagenGeleden: 3,
  },
  {
    klant: 3,
    type: "aanleg",
    status: "concept",
    scopes: ["gras", "borders"],
    scopeData: {
      gras: { oppervlakte: 140, type: "graszoden", ondergrond: "nieuw", afwateringNodig: false, opsluitbanden: true, opsluitbandenMeters: 48 },
      borders: { oppervlakte: 34, beplantingsintensiteit: "gemiddeld", bodemverbetering: true, afwerking: "schors", orientatie: "zuid" },
    },
    regels: [
      { scope: "gras", omschrijving: "Graszoden incl. leveren", eenheid: "m²", hoeveelheid: 140, prijs: 7.4, soort: "materiaal" },
      { scope: "gras", omschrijving: "Grondbewerking en zoden leggen", eenheid: "uur", hoeveelheid: 18, prijs: 48, soort: "arbeid" },
      { scope: "borders", omschrijving: "Vaste planten en heesters", eenheid: "m²", hoeveelheid: 34, prijs: 41, soort: "materiaal" },
      { scope: "borders", omschrijving: "Beplanten borders", eenheid: "uur", hoeveelheid: 12, prijs: 48, soort: "arbeid" },
    ],
    dagenGeleden: 6,
  },
  {
    klant: 22,
    type: "onderhoud",
    status: "concept",
    scopes: ["gras", "borders", "heggen"],
    scopeData: {
      tuinOppervlakte: 1450,
      gras: { grasAanwezig: true, grasOppervlakte: 780, maaien: true, kantenSteken: true, verticuteren: false, afvoerGras: true },
      borders: { borderOppervlakte: 210, onderhoudsintensiteit: "gemiddeld", onkruidVerwijderen: true, snoeiInBorders: "licht", bodem: "bedekt", afvoerGroenafval: true },
      heggen: { lengte: 165, hoogte: 1.6, breedte: 0.6, snoei: "beide", afvoerSnoeisel: true, haagsoort: "liguster", snoeiFrequentie: "2x" },
    },
    regels: [
      { scope: "gras", omschrijving: "Maaien en kanten steken (per beurt)", eenheid: "beurt", hoeveelheid: 22, prijs: 148, soort: "arbeid" },
      { scope: "borders", omschrijving: "Borderonderhoud (per beurt)", eenheid: "beurt", hoeveelheid: 12, prijs: 96, soort: "arbeid" },
      { scope: "heggen", omschrijving: "Haagsnoei incl. afvoer", eenheid: "beurt", hoeveelheid: 2, prijs: 640, soort: "arbeid" },
      { scope: "heggen", omschrijving: "Afvoer groenafval", eenheid: "m³", hoeveelheid: 9, prijs: 38, soort: "materiaal" },
    ],
    dagenGeleden: 9,
  },
  {
    klant: 16,
    type: "aanleg",
    status: "concept",
    scopes: ["houtwerk"],
    scopeData: {
      houtwerk: { typeHoutwerk: "vlonder", afmeting: 26, fundering: "standaard" },
    },
    regels: [
      { scope: "houtwerk", omschrijving: "Vlonderplanken hardhout", eenheid: "m²", hoeveelheid: 26, prijs: 96, soort: "materiaal" },
      { scope: "houtwerk", omschrijving: "Onderconstructie en montage", eenheid: "uur", hoeveelheid: 20, prijs: 48, soort: "arbeid" },
    ],
    dagenGeleden: 12,
  },

  // ── voorcalculatie (4) ──────────────────────────────────────────────
  {
    klant: 19,
    type: "aanleg",
    status: "voorcalculatie",
    scopes: ["grondwerk", "parkeerplaats"],
    scopeData: {
      grondwerk: { oppervlakte: 180, diepte: "zwaar", afvoerGrond: true },
      parkeerplaats: {
        oppervlakte: 165,
        aantalPlaatsen: 12,
        verharding: "betonklinker",
        draagkracht: "vrachtverkeer",
        ontgraven: true,
        opsluitbanden: true,
        opsluitbandenMeters: 62,
        afwatering: "kolken",
        aantalKolken: 3,
        belijning: true,
      },
    },
    regels: [
      { scope: "grondwerk", omschrijving: "Ontgraven cunet 50 cm incl. afvoer", eenheid: "m³", hoeveelheid: 90, prijs: 44, soort: "materiaal" },
      { scope: "grondwerk", omschrijving: "Graafmachine 5 ton", eenheid: "dag", hoeveelheid: 3, prijs: 320, soort: "machine" },
      { scope: "parkeerplaats", omschrijving: "Gebroken puin 0/40 fundering", eenheid: "ton", hoeveelheid: 84, prijs: 26, soort: "materiaal" },
      { scope: "parkeerplaats", omschrijving: "Betonklinker zwaar verkeer", eenheid: "m²", hoeveelheid: 165, prijs: 28, soort: "materiaal" },
      { scope: "parkeerplaats", omschrijving: "Straatkolk incl. aansluiting", eenheid: "stuk", hoeveelheid: 3, prijs: 185, soort: "materiaal" },
      { scope: "parkeerplaats", omschrijving: "Vakbelijning aanbrengen", eenheid: "stuk", hoeveelheid: 12, prijs: 34, soort: "materiaal" },
      { scope: "parkeerplaats", omschrijving: "Bestraten parkeerterrein", eenheid: "uur", hoeveelheid: 78, prijs: 49, soort: "arbeid" },
    ],
    dagenGeleden: 18,
  },
  {
    klant: 6,
    type: "aanleg",
    status: "voorcalculatie",
    scopes: ["beregening", "gras"],
    scopeData: {
      beregening: {
        oppervlakte: 320,
        aantalZones: 4,
        sproeierType: "popup",
        waterbron: "waterleiding",
        regelkast: true,
        wifiModule: true,
        wintervast: true,
      },
      gras: { oppervlakte: 320, type: "zaaien", ondergrond: "bestaand", afwateringNodig: false },
    },
    regels: [
      { scope: "beregening", omschrijving: "Pop-up sproeier incl. plaatsing", eenheid: "stuk", hoeveelheid: 22, prijs: 45, soort: "materiaal" },
      { scope: "beregening", omschrijving: "Leidingwerk PE 25 mm", eenheid: "m", hoeveelheid: 210, prijs: 4.6, soort: "materiaal" },
      { scope: "beregening", omschrijving: "Regelkast 6 zones met wifi", eenheid: "stuk", hoeveelheid: 1, prijs: 285, soort: "materiaal" },
      { scope: "beregening", omschrijving: "Aanleg beregeningsinstallatie", eenheid: "uur", hoeveelheid: 26, prijs: 48, soort: "arbeid" },
      { scope: "gras", omschrijving: "Graszaad speelgazon", eenheid: "m²", hoeveelheid: 320, prijs: 1.1, soort: "materiaal" },
      { scope: "gras", omschrijving: "Inzaaien en aanwalsen", eenheid: "uur", hoeveelheid: 10, prijs: 48, soort: "arbeid" },
    ],
    dagenGeleden: 21,
  },
  {
    klant: 23,
    type: "onderhoud",
    status: "voorcalculatie",
    scopes: ["gras", "reiniging"],
    scopeData: {
      tuinOppervlakte: 2200,
      gras: { grasAanwezig: true, grasOppervlakte: 1100, maaien: true, kantenSteken: true, verticuteren: true, afvoerGras: true },
      reiniging: { terrasReiniging: true, terrasType: "beton", terrasOppervlakte: 340, bladruimen: true },
    },
    regels: [
      { scope: "gras", omschrijving: "Maaien met zitmaaier (per beurt)", eenheid: "beurt", hoeveelheid: 24, prijs: 178, soort: "arbeid" },
      { scope: "reiniging", omschrijving: "Terras reinigen hogedruk", eenheid: "m²", hoeveelheid: 340, prijs: 3.2, soort: "arbeid" },
      { scope: "reiniging", omschrijving: "Hogedrukreiniger inzet", eenheid: "dag", hoeveelheid: 2, prijs: 110, soort: "machine" },
    ],
    dagenGeleden: 25,
  },
  {
    klant: 12,
    type: "aanleg",
    status: "voorcalculatie",
    scopes: ["water_elektra", "borders"],
    scopeData: {
      water_elektra: { verlichting: "uitgebreid", aantalPunten: 14, sleuvenNodig: true, verlichtingsplan: true, diepteEis: 60 },
      borders: { oppervlakte: 52, beplantingsintensiteit: "veel", bodemverbetering: true, afwerking: "grind", orientatie: "west" },
    },
    regels: [
      { scope: "water_elektra", omschrijving: "LED-tuinspot 12V", eenheid: "stuk", hoeveelheid: 14, prijs: 68, soort: "materiaal" },
      { scope: "water_elektra", omschrijving: "Grondkabel en trafo", eenheid: "post", hoeveelheid: 1, prijs: 340, soort: "materiaal" },
      { scope: "water_elektra", omschrijving: "Sleuven graven en bekabelen", eenheid: "uur", hoeveelheid: 16, prijs: 48, soort: "arbeid" },
      { scope: "borders", omschrijving: "Beplanting hoge dichtheid", eenheid: "m²", hoeveelheid: 52, prijs: 54, soort: "materiaal" },
      { scope: "borders", omschrijving: "Aanplant en afwerking", eenheid: "uur", hoeveelheid: 18, prijs: 48, soort: "arbeid" },
    ],
    dagenGeleden: 28,
  },

  // ── verzonden (4) ───────────────────────────────────────────────────
  {
    klant: 1,
    type: "aanleg",
    status: "verzonden",
    scopes: ["bestrating", "gras"],
    scopeData: {
      bestrating: {
        oppervlakte: 48,
        typeBestrating: "natuursteen",
        snijwerk: "hoog",
        onderbouw: { type: "zware_fundering", dikteOnderlaag: 25, opsluitbanden: true },
        bestratingtype: "pad",
      },
      gras: { oppervlakte: 96, type: "graszoden", ondergrond: "nieuw", afwateringNodig: true, drainage: true, drainageMeters: 32 },
    },
    regels: [
      { scope: "bestrating", omschrijving: "Natuursteen keramisch 60x60", eenheid: "m²", hoeveelheid: 48, prijs: 74, soort: "materiaal" },
      { scope: "bestrating", omschrijving: "Bestraten incl. snijwerk", eenheid: "uur", hoeveelheid: 30, prijs: 49, soort: "arbeid" },
      { scope: "gras", omschrijving: "Drainagebuis incl. omhulling", eenheid: "m", hoeveelheid: 32, prijs: 12.5, soort: "materiaal" },
      { scope: "gras", omschrijving: "Graszoden leggen", eenheid: "uur", hoeveelheid: 14, prijs: 48, soort: "arbeid" },
    ],
    dagenGeleden: 8,
  },
  {
    klant: 20,
    type: "aanleg",
    status: "verzonden",
    scopes: ["parkeerplaats"],
    scopeData: {
      parkeerplaats: {
        oppervlakte: 88,
        aantalPlaatsen: 6,
        verharding: "grasbetontegel",
        draagkracht: "bestelbus",
        ontgraven: true,
        opsluitbanden: false,
        afwatering: "infiltratie",
        belijning: false,
      },
    },
    regels: [
      { scope: "parkeerplaats", omschrijving: "Grasbetontegel 60x40x12", eenheid: "m²", hoeveelheid: 88, prijs: 24, soort: "materiaal" },
      { scope: "parkeerplaats", omschrijving: "Menggranulaat fundering", eenheid: "ton", hoeveelheid: 42, prijs: 26, soort: "materiaal" },
      { scope: "parkeerplaats", omschrijving: "Aanleg parkeervakken", eenheid: "uur", hoeveelheid: 38, prijs: 49, soort: "arbeid" },
      { scope: "parkeerplaats", omschrijving: "Minigraver 3 ton", eenheid: "dag", hoeveelheid: 2, prijs: 245, soort: "machine" },
    ],
    dagenGeleden: 14,
  },
  {
    klant: 24,
    type: "onderhoud",
    status: "verzonden",
    scopes: ["gras", "borders", "bomen"],
    scopeData: {
      tuinOppervlakte: 5400,
      gras: { grasAanwezig: true, grasOppervlakte: 3200, maaien: true, kantenSteken: false, verticuteren: true, afvoerGras: true },
      borders: { borderOppervlakte: 640, onderhoudsintensiteit: "weinig", onkruidVerwijderen: true, snoeiInBorders: "zwaar", bodem: "open", afvoerGroenafval: true },
      bomen: { aantalBomen: 34, snoei: "licht", hoogteklasse: "hoog", afvoer: true, inspectieType: "gecertificeerd" },
    },
    regels: [
      { scope: "gras", omschrijving: "Maaien openbaar groen (per beurt)", eenheid: "beurt", hoeveelheid: 26, prijs: 420, soort: "arbeid" },
      { scope: "borders", omschrijving: "Onkruidbeheersing borders", eenheid: "beurt", hoeveelheid: 10, prijs: 310, soort: "arbeid" },
      { scope: "bomen", omschrijving: "Boomveiligheidscontrole (VTA)", eenheid: "stuk", hoeveelheid: 34, prijs: 22, soort: "arbeid" },
      { scope: "bomen", omschrijving: "Hoogwerker inzet", eenheid: "dag", hoeveelheid: 4, prijs: 380, soort: "machine" },
    ],
    dagenGeleden: 20,
  },
  {
    klant: 8,
    type: "aanleg",
    status: "verzonden",
    scopes: ["beregening"],
    scopeData: {
      beregening: {
        oppervlakte: 140,
        aantalZones: 2,
        sproeierType: "combinatie",
        waterbron: "regenwater",
        leidinglengte: 95,
        regelkast: true,
        wintervast: true,
      },
    },
    regels: [
      { scope: "beregening", omschrijving: "Pop-up sproeier incl. plaatsing", eenheid: "stuk", hoeveelheid: 11, prijs: 45, soort: "materiaal" },
      { scope: "beregening", omschrijving: "Druppelslang borders", eenheid: "m", hoeveelheid: 60, prijs: 3.1, soort: "materiaal" },
      { scope: "beregening", omschrijving: "Regelkast 4 zones", eenheid: "stuk", hoeveelheid: 1, prijs: 285, soort: "materiaal" },
      { scope: "beregening", omschrijving: "Aanleg installatie", eenheid: "uur", hoeveelheid: 16, prijs: 48, soort: "arbeid" },
    ],
    dagenGeleden: 30,
  },

  // ── geaccepteerd (5) ────────────────────────────────────────────────
  {
    klant: 2,
    type: "aanleg",
    status: "geaccepteerd",
    scopes: ["grondwerk", "bestrating", "borders"],
    scopeData: {
      grondwerk: { oppervlakte: 210, diepte: "standaard", afvoerGrond: true },
      bestrating: {
        oppervlakte: 96,
        typeBestrating: "tegel",
        snijwerk: "gemiddeld",
        onderbouw: { type: "zand_fundering", dikteOnderlaag: 20, opsluitbanden: true },
        bestratingtype: "terrein",
      },
      borders: { oppervlakte: 66, beplantingsintensiteit: "gemiddeld", bodemverbetering: true, afwerking: "schors", orientatie: "oost" },
    },
    regels: [
      { scope: "grondwerk", omschrijving: "Ontgraven en afvoeren", eenheid: "m³", hoeveelheid: 48, prijs: 45, soort: "materiaal" },
      { scope: "grondwerk", omschrijving: "Grondwerk", eenheid: "uur", hoeveelheid: 26, prijs: 48, soort: "arbeid" },
      { scope: "bestrating", omschrijving: "Betontegel 60x60 grijs", eenheid: "m²", hoeveelheid: 96, prijs: 32, soort: "materiaal" },
      { scope: "bestrating", omschrijving: "Bestraten terras", eenheid: "uur", hoeveelheid: 44, prijs: 49, soort: "arbeid" },
      { scope: "borders", omschrijving: "Heesters en vaste planten", eenheid: "m²", hoeveelheid: 66, prijs: 43, soort: "materiaal" },
      { scope: "borders", omschrijving: "Aanplant borders", eenheid: "uur", hoeveelheid: 22, prijs: 48, soort: "arbeid" },
    ],
    dagenGeleden: 62,
  },
  {
    klant: 4,
    type: "aanleg",
    status: "geaccepteerd",
    scopes: ["gras", "houtwerk", "water_elektra"],
    scopeData: {
      gras: { oppervlakte: 185, type: "graszoden", ondergrond: "nieuw", afwateringNodig: false, verticuteren: false },
      houtwerk: { typeHoutwerk: "schutting", afmeting: 42, fundering: "standaard" },
      water_elektra: { verlichting: "basis", aantalPunten: 6, sleuvenNodig: true },
    },
    regels: [
      { scope: "gras", omschrijving: "Graszoden incl. leveren", eenheid: "m²", hoeveelheid: 185, prijs: 7.4, soort: "materiaal" },
      { scope: "gras", omschrijving: "Grondbewerking en zoden", eenheid: "uur", hoeveelheid: 20, prijs: 48, soort: "arbeid" },
      { scope: "houtwerk", omschrijving: "Schuttingpanelen douglas", eenheid: "m", hoeveelheid: 42, prijs: 78, soort: "materiaal" },
      { scope: "houtwerk", omschrijving: "Schutting plaatsen", eenheid: "uur", hoeveelheid: 24, prijs: 48, soort: "arbeid" },
      { scope: "water_elektra", omschrijving: "LED-spots met trafo", eenheid: "post", hoeveelheid: 1, prijs: 480, soort: "materiaal" },
      { scope: "water_elektra", omschrijving: "Bekabeling aanleggen", eenheid: "uur", hoeveelheid: 8, prijs: 48, soort: "arbeid" },
    ],
    dagenGeleden: 54,
  },
  {
    klant: 21,
    type: "onderhoud",
    status: "geaccepteerd",
    scopes: ["gras", "borders", "reiniging"],
    scopeData: {
      tuinOppervlakte: 1900,
      gras: { grasAanwezig: true, grasOppervlakte: 900, maaien: true, kantenSteken: true, verticuteren: false, afvoerGras: true },
      borders: { borderOppervlakte: 280, onderhoudsintensiteit: "gemiddeld", onkruidVerwijderen: true, snoeiInBorders: "licht", bodem: "bedekt", afvoerGroenafval: true },
      reiniging: { terrasReiniging: true, terrasType: "klinkers", terrasOppervlakte: 190, bladruimen: true },
    },
    regels: [
      { scope: "gras", omschrijving: "Maaibeurt incl. afvoer", eenheid: "beurt", hoeveelheid: 22, prijs: 165, soort: "arbeid" },
      { scope: "borders", omschrijving: "Borderonderhoud", eenheid: "beurt", hoeveelheid: 12, prijs: 118, soort: "arbeid" },
      { scope: "reiniging", omschrijving: "Klinkers reinigen en onkruidvrij", eenheid: "m²", hoeveelheid: 190, prijs: 3.4, soort: "arbeid" },
    ],
    dagenGeleden: 48,
  },
  {
    klant: 5,
    type: "aanleg",
    status: "geaccepteerd",
    scopes: ["bestrating", "beregening", "borders"],
    scopeData: {
      bestrating: {
        oppervlakte: 64,
        typeBestrating: "klinker",
        snijwerk: "laag",
        onderbouw: { type: "zandbed", dikteOnderlaag: 15, opsluitbanden: true },
        bestratingtype: "oprit",
      },
      beregening: {
        oppervlakte: 210,
        aantalZones: 3,
        sproeierType: "popup",
        waterbron: "put",
        regelkast: true,
        wintervast: true,
      },
      borders: { oppervlakte: 40, beplantingsintensiteit: "weinig", bodemverbetering: false, afwerking: "grind", orientatie: "noord" },
    },
    regels: [
      { scope: "bestrating", omschrijving: "Waalformaat klinker", eenheid: "m²", hoeveelheid: 64, prijs: 31, soort: "materiaal" },
      { scope: "bestrating", omschrijving: "Oprit bestraten", eenheid: "uur", hoeveelheid: 28, prijs: 49, soort: "arbeid" },
      { scope: "beregening", omschrijving: "Pop-up sproeiers", eenheid: "stuk", hoeveelheid: 16, prijs: 45, soort: "materiaal" },
      { scope: "beregening", omschrijving: "Regelkast 4 zones", eenheid: "stuk", hoeveelheid: 1, prijs: 285, soort: "materiaal" },
      { scope: "beregening", omschrijving: "Installatie beregening", eenheid: "uur", hoeveelheid: 20, prijs: 48, soort: "arbeid" },
      { scope: "borders", omschrijving: "Siergrind en beplanting", eenheid: "m²", hoeveelheid: 40, prijs: 36, soort: "materiaal" },
    ],
    dagenGeleden: 41,
  },
  {
    klant: 10,
    type: "aanleg",
    status: "geaccepteerd",
    scopes: ["grondwerk", "gras", "specials"],
    scopeData: {
      grondwerk: { oppervlakte: 120, diepte: "licht", afvoerGrond: false },
      gras: { oppervlakte: 120, type: "zaaien", ondergrond: "nieuw", afwateringNodig: false },
      specials: { items: [{ type: "jacuzzi", omschrijving: "Fundering en aansluiting jacuzzi 220x220" }] },
    },
    regels: [
      { scope: "grondwerk", omschrijving: "Egaliseren en frezen", eenheid: "uur", hoeveelheid: 12, prijs: 48, soort: "arbeid" },
      { scope: "gras", omschrijving: "Graszaad en startmeststof", eenheid: "m²", hoeveelheid: 120, prijs: 1.3, soort: "materiaal" },
      { scope: "gras", omschrijving: "Inzaaien", eenheid: "uur", hoeveelheid: 8, prijs: 48, soort: "arbeid" },
      { scope: "specials", omschrijving: "Betonplaat jacuzzi incl. wapening", eenheid: "post", hoeveelheid: 1, prijs: 1450, soort: "materiaal" },
      { scope: "specials", omschrijving: "Aanleg fundering en aansluiting", eenheid: "uur", hoeveelheid: 22, prijs: 52, soort: "arbeid" },
    ],
    dagenGeleden: 35,
  },

  // ── afgewezen (3) ───────────────────────────────────────────────────
  {
    klant: 11,
    type: "aanleg",
    status: "afgewezen",
    scopes: ["bestrating"],
    scopeData: {
      bestrating: {
        oppervlakte: 120,
        typeBestrating: "natuursteen",
        snijwerk: "hoog",
        onderbouw: { type: "zware_fundering", dikteOnderlaag: 30, opsluitbanden: true },
        bestratingtype: "terrein",
      },
    },
    regels: [
      { scope: "bestrating", omschrijving: "Natuursteen graniet 80x80", eenheid: "m²", hoeveelheid: 120, prijs: 118, soort: "materiaal" },
      { scope: "bestrating", omschrijving: "Bestraten natuursteen", eenheid: "uur", hoeveelheid: 72, prijs: 52, soort: "arbeid" },
    ],
    dagenGeleden: 70,
  },
  {
    klant: 13,
    type: "onderhoud",
    status: "afgewezen",
    scopes: ["heggen", "bomen"],
    scopeData: {
      tuinOppervlakte: 640,
      heggen: { lengte: 84, hoogte: 2.2, breedte: 0.8, snoei: "beide", afvoerSnoeisel: true, haagsoort: "conifeer", hoogwerkerNodig: true },
      bomen: { aantalBomen: 6, snoei: "zwaar", hoogteklasse: "hoog", afvoer: true, groottecategorie: "10-20m" },
    },
    regels: [
      { scope: "heggen", omschrijving: "Coniferenhaag snoeien", eenheid: "m", hoeveelheid: 84, prijs: 9.5, soort: "arbeid" },
      { scope: "bomen", omschrijving: "Kroonreductie grote bomen", eenheid: "stuk", hoeveelheid: 6, prijs: 285, soort: "arbeid" },
      { scope: "bomen", omschrijving: "Hoogwerker 22 m", eenheid: "dag", hoeveelheid: 2, prijs: 420, soort: "machine" },
    ],
    dagenGeleden: 76,
  },
  {
    klant: 17,
    type: "aanleg",
    status: "afgewezen",
    scopes: ["houtwerk", "water_elektra"],
    scopeData: {
      houtwerk: { typeHoutwerk: "pergola", afmeting: 18, fundering: "zwaar" },
      water_elektra: { verlichting: "uitgebreid", aantalPunten: 10, sleuvenNodig: false },
    },
    regels: [
      { scope: "houtwerk", omschrijving: "Pergola hardhout op maat", eenheid: "m²", hoeveelheid: 18, prijs: 210, soort: "materiaal" },
      { scope: "houtwerk", omschrijving: "Montage pergola", eenheid: "uur", hoeveelheid: 26, prijs: 50, soort: "arbeid" },
      { scope: "water_elektra", omschrijving: "Inbouwverlichting pergola", eenheid: "stuk", hoeveelheid: 10, prijs: 72, soort: "materiaal" },
    ],
    dagenGeleden: 84,
  },
];

/**
 * Historie: het vorige kalenderjaar, seizoen voor seizoen.
 * =======================================================
 *
 * De rapportagepagina (`api.rapportage.getRapportage`) zet elke periode naast
 * twee vergelijkingen: de vorige periode én **dezelfde periode vorig jaar**.
 * Die tweede is voor een hovenier de interessantste — een natte mei vergelijk
 * je met mei, niet met april. De rest van deze seed spant maar ~120 dagen, dus
 * "Zomer 2025" en "2025" stonden allebei stug op € 0 en las de UI als kapot.
 *
 * Daarom deze twaalf offertes, verspreid over voorjaar, zomer en najaar van
 * het vorige kalenderjaar. Drie dingen die de opzet bepalen:
 *
 *  1. **De peildatum van getekende omzet is het TEKENMOMENT**, niet de
 *     aanmaakdatum: `peildatumGetekend` in `convex/lib/omzetDefinities.ts`
 *     leest `customerResponse.respondedAt` en valt pas daarna terug op
 *     `updatedAt`. Elke historie-offerte zet dus allebei in het verleden;
 *     zou `updatedAt` op "nu" staan, dan telde een offerte van vorig jaar
 *     stilletjes mee in de omzet van deze maand.
 *  2. **Geen werkitems eraan.** `users.initializeDefaults` archiveert bij het
 *     laden van de app elke offerte met een betaalde PROJECT-factuur, en
 *     gearchiveerde offertes tellen nergens meer mee (`isTelbaar`). De
 *     historische facturen hangen daarom aan de klant (`bron: "handmatig"`,
 *     geen `projectId`) — precies waar dat veld optioneel voor is. Zo blijft
 *     de omzet van vorig jaar staan in plaats van binnen een seconde na het
 *     seeden weg te archiveren.
 *  3. **Kalenderanker, geen dagafstand.** Zie `vorigJaarOp`.
 */
type HistorieSpec = {
  /** Index in KLANTEN. */
  klant: number;
  type: "aanleg" | "onderhoud";
  status: "geaccepteerd" | "afgewezen";
  scopes: string[];
  scopeData: Record<string, unknown>;
  regels: RegelSpec[];
  /** [maand 0-11, dag] van aanmaken, in het vorige kalenderjaar. */
  gemaakt: [number, number];
  /** [maand 0-11, dag] van het tekenmoment — de omzet-peildatum. */
  getekend: [number, number];
  /**
   * Bijbehorende losse factuur op de klant. `betaald: false` levert een
   * verzonden factuur die allang over zijn vervaldatum is — die vult de
   * "90+ dagen"-emmer van het openstaand-overzicht, die anders leeg blijft.
   */
  factuur?: { datum: [number, number]; betaald: boolean };
};

const HISTORIE: HistorieSpec[] = [
  // ── voorjaar vorig jaar (mrt–mei) ───────────────────────────────────
  {
    klant: 7,
    type: "aanleg",
    status: "geaccepteerd",
    scopes: ["grondwerk", "bestrating"],
    scopeData: {
      grondwerk: { oppervlakte: 130, diepte: "standaard", afvoerGrond: true },
      bestrating: {
        oppervlakte: 92,
        typeBestrating: "tegel",
        snijwerk: "gemiddeld",
        onderbouw: { type: "zand_fundering", dikteOnderlaag: 20, opsluitbanden: true },
        bestratingtype: "terrein",
      },
    },
    regels: [
      { scope: "grondwerk", omschrijving: "Ontgraven en afvoeren grond", eenheid: "m³", hoeveelheid: 32, prijs: 44, soort: "materiaal" },
      { scope: "grondwerk", omschrijving: "Grondwerk uitvoeren", eenheid: "uur", hoeveelheid: 18, prijs: 46, soort: "arbeid" },
      { scope: "bestrating", omschrijving: "Betontegel 60x60 antraciet", eenheid: "m²", hoeveelheid: 92, prijs: 31, soort: "materiaal" },
      { scope: "bestrating", omschrijving: "Terras bestraten", eenheid: "uur", hoeveelheid: 40, prijs: 47, soort: "arbeid" },
    ],
    gemaakt: [2, 12],
    getekend: [2, 24],
    factuur: { datum: [3, 22], betaald: true },
  },
  {
    klant: 14,
    type: "onderhoud",
    status: "geaccepteerd",
    scopes: ["gras", "borders", "heggen"],
    scopeData: {
      tuinOppervlakte: 1250,
      gras: { grasAanwezig: true, grasOppervlakte: 660, maaien: true, kantenSteken: true, verticuteren: true, afvoerGras: true },
      borders: { borderOppervlakte: 180, onderhoudsintensiteit: "gemiddeld", onkruidVerwijderen: true, snoeiInBorders: "licht", bodem: "bedekt", afvoerGroenafval: true },
      heggen: { lengte: 120, hoogte: 1.4, breedte: 0.5, snoei: "beide", afvoerSnoeisel: true, haagsoort: "beuk", snoeiFrequentie: "2x" },
    },
    regels: [
      { scope: "gras", omschrijving: "Maaien en kanten steken (per beurt)", eenheid: "beurt", hoeveelheid: 20, prijs: 138, soort: "arbeid" },
      { scope: "borders", omschrijving: "Borderonderhoud (per beurt)", eenheid: "beurt", hoeveelheid: 10, prijs: 92, soort: "arbeid" },
      { scope: "heggen", omschrijving: "Beukenhaag snoeien incl. afvoer", eenheid: "beurt", hoeveelheid: 2, prijs: 480, soort: "arbeid" },
    ],
    gemaakt: [3, 8],
    getekend: [3, 18],
    factuur: { datum: [4, 16], betaald: true },
  },
  {
    klant: 18,
    type: "aanleg",
    status: "geaccepteerd",
    scopes: ["gras", "borders"],
    scopeData: {
      gras: { oppervlakte: 210, type: "graszoden", ondergrond: "nieuw", afwateringNodig: false, opsluitbanden: true, opsluitbandenMeters: 60 },
      borders: { oppervlakte: 48, beplantingsintensiteit: "gemiddeld", bodemverbetering: true, afwerking: "schors", orientatie: "zuid" },
    },
    regels: [
      { scope: "gras", omschrijving: "Graszoden incl. leveren", eenheid: "m²", hoeveelheid: 210, prijs: 7.1, soort: "materiaal" },
      { scope: "gras", omschrijving: "Grondbewerking en zoden leggen", eenheid: "uur", hoeveelheid: 24, prijs: 46, soort: "arbeid" },
      { scope: "borders", omschrijving: "Vaste planten en heesters", eenheid: "m²", hoeveelheid: 48, prijs: 39, soort: "materiaal" },
      { scope: "borders", omschrijving: "Beplanten borders", eenheid: "uur", hoeveelheid: 16, prijs: 46, soort: "arbeid" },
    ],
    gemaakt: [4, 15],
    getekend: [4, 27],
    factuur: { datum: [5, 24], betaald: true },
  },

  // ── zomer vorig jaar (jun–aug) — het drukste seizoen ─────────────────
  {
    klant: 9,
    type: "aanleg",
    status: "geaccepteerd",
    scopes: ["bestrating", "gras"],
    scopeData: {
      bestrating: {
        oppervlakte: 58,
        typeBestrating: "klinker",
        snijwerk: "laag",
        onderbouw: { type: "zandbed", dikteOnderlaag: 15, opsluitbanden: true },
        bestratingtype: "oprit",
      },
      gras: { oppervlakte: 130, type: "graszoden", ondergrond: "bestaand", afwateringNodig: false },
    },
    regels: [
      { scope: "bestrating", omschrijving: "Waalformaat klinker", eenheid: "m²", hoeveelheid: 58, prijs: 29, soort: "materiaal" },
      { scope: "bestrating", omschrijving: "Oprit bestraten", eenheid: "uur", hoeveelheid: 26, prijs: 47, soort: "arbeid" },
      { scope: "gras", omschrijving: "Graszoden incl. leveren", eenheid: "m²", hoeveelheid: 130, prijs: 7.1, soort: "materiaal" },
      { scope: "gras", omschrijving: "Zoden leggen", eenheid: "uur", hoeveelheid: 12, prijs: 46, soort: "arbeid" },
    ],
    gemaakt: [5, 3],
    getekend: [5, 16],
    factuur: { datum: [6, 14], betaald: true },
  },
  {
    klant: 24,
    type: "onderhoud",
    status: "geaccepteerd",
    scopes: ["gras", "reiniging"],
    scopeData: {
      tuinOppervlakte: 4800,
      gras: { grasAanwezig: true, grasOppervlakte: 2900, maaien: true, kantenSteken: false, verticuteren: false, afvoerGras: true },
      reiniging: { terrasReiniging: true, terrasType: "beton", terrasOppervlakte: 420, bladruimen: true },
    },
    regels: [
      { scope: "gras", omschrijving: "Maaien openbaar groen (per beurt)", eenheid: "beurt", hoeveelheid: 24, prijs: 395, soort: "arbeid" },
      { scope: "reiniging", omschrijving: "Verharding reinigen hogedruk", eenheid: "m²", hoeveelheid: 420, prijs: 3.1, soort: "arbeid" },
      { scope: "reiniging", omschrijving: "Hogedrukreiniger inzet", eenheid: "dag", hoeveelheid: 3, prijs: 105, soort: "machine" },
    ],
    gemaakt: [5, 24],
    getekend: [6, 4],
    factuur: { datum: [7, 2], betaald: true },
  },
  {
    klant: 20,
    type: "aanleg",
    status: "geaccepteerd",
    scopes: ["grondwerk", "parkeerplaats"],
    scopeData: {
      grondwerk: { oppervlakte: 140, diepte: "zwaar", afvoerGrond: true },
      parkeerplaats: {
        oppervlakte: 132,
        aantalPlaatsen: 9,
        verharding: "betonklinker",
        draagkracht: "bestelbus",
        ontgraven: true,
        opsluitbanden: true,
        opsluitbandenMeters: 54,
        afwatering: "kolken",
        aantalKolken: 2,
        belijning: true,
      },
    },
    regels: [
      { scope: "grondwerk", omschrijving: "Ontgraven cunet incl. afvoer", eenheid: "m³", hoeveelheid: 66, prijs: 43, soort: "materiaal" },
      { scope: "grondwerk", omschrijving: "Graafmachine 5 ton", eenheid: "dag", hoeveelheid: 2, prijs: 310, soort: "machine" },
      { scope: "parkeerplaats", omschrijving: "Gebroken puin 0/40 fundering", eenheid: "ton", hoeveelheid: 64, prijs: 25, soort: "materiaal" },
      { scope: "parkeerplaats", omschrijving: "Betonklinker zwaar verkeer", eenheid: "m²", hoeveelheid: 132, prijs: 27, soort: "materiaal" },
      { scope: "parkeerplaats", omschrijving: "Bestraten parkeerterrein", eenheid: "uur", hoeveelheid: 62, prijs: 47, soort: "arbeid" },
    ],
    gemaakt: [6, 7],
    getekend: [6, 18],
    factuur: { datum: [7, 20], betaald: true },
  },
  {
    klant: 15,
    type: "aanleg",
    status: "geaccepteerd",
    scopes: ["houtwerk", "water_elektra"],
    scopeData: {
      houtwerk: { typeHoutwerk: "vlonder", afmeting: 34, fundering: "standaard" },
      water_elektra: { verlichting: "basis", aantalPunten: 8, sleuvenNodig: true },
    },
    regels: [
      { scope: "houtwerk", omschrijving: "Vlonderplanken hardhout", eenheid: "m²", hoeveelheid: 34, prijs: 92, soort: "materiaal" },
      { scope: "houtwerk", omschrijving: "Onderconstructie en montage", eenheid: "uur", hoeveelheid: 26, prijs: 46, soort: "arbeid" },
      { scope: "water_elektra", omschrijving: "LED-tuinspot 12V", eenheid: "stuk", hoeveelheid: 8, prijs: 64, soort: "materiaal" },
      { scope: "water_elektra", omschrijving: "Sleuven graven en bekabelen", eenheid: "uur", hoeveelheid: 10, prijs: 46, soort: "arbeid" },
    ],
    gemaakt: [6, 21],
    getekend: [7, 1],
  },
  {
    klant: 22,
    type: "onderhoud",
    status: "geaccepteerd",
    scopes: ["gras", "borders", "bomen"],
    scopeData: {
      tuinOppervlakte: 1450,
      gras: { grasAanwezig: true, grasOppervlakte: 780, maaien: true, kantenSteken: true, verticuteren: false, afvoerGras: true },
      borders: { borderOppervlakte: 210, onderhoudsintensiteit: "gemiddeld", onkruidVerwijderen: true, snoeiInBorders: "licht", bodem: "bedekt", afvoerGroenafval: true },
      bomen: { aantalBomen: 18, snoei: "licht", hoogteklasse: "middel", afvoer: true, inspectieType: "visueel" },
    },
    regels: [
      { scope: "gras", omschrijving: "Maaibeurt incl. afvoer", eenheid: "beurt", hoeveelheid: 20, prijs: 142, soort: "arbeid" },
      { scope: "borders", omschrijving: "Borderonderhoud", eenheid: "beurt", hoeveelheid: 11, prijs: 104, soort: "arbeid" },
      { scope: "bomen", omschrijving: "Boomveiligheidscontrole (VTA)", eenheid: "stuk", hoeveelheid: 18, prijs: 21, soort: "arbeid" },
    ],
    gemaakt: [7, 4],
    getekend: [7, 14],
    factuur: { datum: [8, 10], betaald: true },
  },
  {
    klant: 1,
    type: "aanleg",
    status: "afgewezen",
    scopes: ["beregening", "gras"],
    scopeData: {
      beregening: {
        oppervlakte: 260,
        aantalZones: 3,
        sproeierType: "popup",
        waterbron: "waterleiding",
        regelkast: true,
        wintervast: true,
      },
      gras: { oppervlakte: 260, type: "zaaien", ondergrond: "bestaand", afwateringNodig: false },
    },
    regels: [
      { scope: "beregening", omschrijving: "Pop-up sproeier incl. plaatsing", eenheid: "stuk", hoeveelheid: 18, prijs: 43, soort: "materiaal" },
      { scope: "beregening", omschrijving: "Aanleg beregeningsinstallatie", eenheid: "uur", hoeveelheid: 22, prijs: 46, soort: "arbeid" },
      { scope: "gras", omschrijving: "Graszaad speelgazon", eenheid: "m²", hoeveelheid: 260, prijs: 1.1, soort: "materiaal" },
    ],
    gemaakt: [7, 18],
    getekend: [7, 28],
  },

  // ── najaar vorig jaar (sep–nov) ─────────────────────────────────────
  {
    klant: 3,
    type: "aanleg",
    status: "geaccepteerd",
    scopes: ["bestrating", "borders"],
    scopeData: {
      bestrating: {
        oppervlakte: 44,
        typeBestrating: "natuursteen",
        snijwerk: "gemiddeld",
        onderbouw: { type: "zware_fundering", dikteOnderlaag: 25, opsluitbanden: true },
        bestratingtype: "pad",
      },
      borders: { oppervlakte: 38, beplantingsintensiteit: "veel", bodemverbetering: true, afwerking: "grind", orientatie: "west" },
    },
    regels: [
      { scope: "bestrating", omschrijving: "Natuursteen keramisch 60x60", eenheid: "m²", hoeveelheid: 44, prijs: 71, soort: "materiaal" },
      { scope: "bestrating", omschrijving: "Bestraten incl. snijwerk", eenheid: "uur", hoeveelheid: 24, prijs: 47, soort: "arbeid" },
      { scope: "borders", omschrijving: "Beplanting hoge dichtheid", eenheid: "m²", hoeveelheid: 38, prijs: 51, soort: "materiaal" },
      { scope: "borders", omschrijving: "Aanplant en afwerking", eenheid: "uur", hoeveelheid: 14, prijs: 46, soort: "arbeid" },
    ],
    gemaakt: [8, 9],
    getekend: [8, 20],
    factuur: { datum: [9, 18], betaald: true },
  },
  {
    klant: 23,
    type: "onderhoud",
    status: "geaccepteerd",
    scopes: ["heggen", "bomen"],
    scopeData: {
      tuinOppervlakte: 2600,
      heggen: { lengte: 240, hoogte: 1.8, breedte: 0.6, snoei: "beide", afvoerSnoeisel: true, haagsoort: "liguster", snoeiFrequentie: "2x" },
      bomen: { aantalBomen: 22, snoei: "licht", hoogteklasse: "hoog", afvoer: true, inspectieType: "gecertificeerd" },
    },
    regels: [
      { scope: "heggen", omschrijving: "Haagsnoei incl. afvoer", eenheid: "beurt", hoeveelheid: 2, prijs: 760, soort: "arbeid" },
      { scope: "bomen", omschrijving: "Boomveiligheidscontrole (VTA)", eenheid: "stuk", hoeveelheid: 22, prijs: 22, soort: "arbeid" },
      { scope: "bomen", omschrijving: "Hoogwerker inzet", eenheid: "dag", hoeveelheid: 2, prijs: 365, soort: "machine" },
    ],
    gemaakt: [9, 6],
    getekend: [9, 15],
    factuur: { datum: [10, 12], betaald: false },
  },
  {
    klant: 11,
    type: "aanleg",
    status: "afgewezen",
    scopes: ["houtwerk", "specials"],
    scopeData: {
      houtwerk: { typeHoutwerk: "pergola", afmeting: 22, fundering: "zwaar" },
      specials: { items: [{ type: "sauna", omschrijving: "Buitensauna 2,4 x 2,0 m incl. fundering" }] },
    },
    regels: [
      { scope: "houtwerk", omschrijving: "Pergola hardhout op maat", eenheid: "m²", hoeveelheid: 22, prijs: 205, soort: "materiaal" },
      { scope: "houtwerk", omschrijving: "Montage pergola", eenheid: "uur", hoeveelheid: 24, prijs: 48, soort: "arbeid" },
      { scope: "specials", omschrijving: "Betonplaat buitensauna incl. wapening", eenheid: "post", hoeveelheid: 1, prijs: 1850, soort: "materiaal" },
      { scope: "specials", omschrijving: "Fundering aanleggen en aansluiten", eenheid: "uur", hoeveelheid: 28, prijs: 48, soort: "arbeid" },
    ],
    gemaakt: [10, 4],
    getekend: [10, 14],
  },
];

/**
 * Projecten (werkitems). Elk project verwijst naar een offerte — bewust:
 * een werkitem zónder `offerteId` maakt van `q.eq("offerteId", undefined)` een
 * zoekopdracht die álle offerte-loze voorcalculaties matcht (zie
 * `convex/lib/voorcalculatieLookup.ts`). De seed mag dat risico niet vergroten.
 */
type ProjectSpec = {
  /** Index in OFFERTES — bepaalt klant, naam en offertekoppeling. */
  offerte: number;
  naam: string;
  status:
    | "gepland"
    | "in_uitvoering"
    | "afgerond"
    | "nacalculatie_compleet"
    | "gefactureerd";
  /** Startdag t.o.v. vandaag (negatief = in het verleden). */
  startDag: number;
  duurDagen: number;
  /** Index in TEAMS. */
  team: number;
  geschatteUren: number;
  /**
   * Werkitem staat in de opdrachtenbak van het planbord: dat is precies de
   * combinatie "geen geplandeStart + status gepland" (convex/planbord.ts
   * `getWachtrij`). Zonder zulke items is de bak op /planning/weekbord leeg.
   */
  wachtrij?: boolean;
};

const PROJECTEN: ProjectSpec[] = [
  { offerte: 12, naam: "Tuinaanleg Dohmen — terras en borders", status: "gefactureerd", startDag: -46, duurDagen: 5, team: 0, geschatteUren: 92 },
  { offerte: 13, naam: "Achtertuin Janssen — gras en schutting", status: "nacalculatie_compleet", startDag: -38, duurDagen: 4, team: 1, geschatteUren: 60 },
  { offerte: 14, naam: "Onderhoud De Lindehof — seizoen 2026", status: "afgerond", startDag: -30, duurDagen: 3, team: 2, geschatteUren: 48 },
  { offerte: 15, naam: "Oprit en beregening Meurders", status: "afgerond", startDag: -22, duurDagen: 4, team: 0, geschatteUren: 64 },
  { offerte: 16, naam: "Gazon en jacuzzi Hermans", status: "in_uitvoering", startDag: -5, duurDagen: 5, team: 1, geschatteUren: 46 },
  { offerte: 4, naam: "Parkeerterrein Bouwbedrijf Frissen", status: "in_uitvoering", startDag: -2, duurDagen: 8, team: 0, geschatteUren: 168 },
  { offerte: 5, naam: "Beregening en gazon Peeters", status: "in_uitvoering", startDag: 0, duurDagen: 3, team: 1, geschatteUren: 38 },
  { offerte: 6, naam: "Onderhoud VvE Park Molenbeek — voorjaarsronde", status: "gepland", startDag: 4, duurDagen: 2, team: 2, geschatteUren: 30 },
  { offerte: 7, naam: "Verlichting en borders Cuijpers", status: "gepland", startDag: 7, duurDagen: 3, team: 1, geschatteUren: 36 },
  { offerte: 9, naam: "Parkeerplaats Logistiek Maasdal", status: "gepland", startDag: 11, duurDagen: 4, team: 0, geschatteUren: 44 },
  // Nog in te plannen — vult de opdrachtenbak op het weekbord.
  { offerte: 8, naam: "Terras en drainage Ramaekers", status: "gepland", startDag: 0, duurDagen: 3, team: 0, geschatteUren: 44, wachtrij: true },
  { offerte: 11, naam: "Beregening Salden", status: "gepland", startDag: 0, duurDagen: 2, team: 1, geschatteUren: 16, wachtrij: true },
];

/** Teams (planbord-kleuren). */
const TEAMS = [
  { naam: "Team Aanleg", kleur: "#16a34a", ledenIndex: [0, 3, 4] },
  { naam: "Team Groen", kleur: "#0ea5e9", ledenIndex: [1, 2] },
  { naam: "Team Onderhoud", kleur: "#f59e0b", ledenIndex: [5, 4] },
];

/** Planningstaken per scope — checklist op het werkitem. */
const TAKEN_PER_SCOPE: Record<string, string[]> = {
  grondwerk: ["Cunet ontgraven", "Grond afvoeren", "Bodem egaliseren"],
  bestrating: ["Fundering aanbrengen", "Bestrating leggen", "Voegen en afwerken"],
  parkeerplaats: ["Cunet ontgraven", "Puinfundering verdichten", "Klinkers zetten", "Belijning aanbrengen"],
  beregening: ["Leidingtracé uitzetten", "Sleuven graven", "Sproeiers plaatsen", "Regelkast programmeren"],
  borders: ["Bodem verbeteren", "Beplanting zetten", "Afwerklaag aanbrengen"],
  gras: ["Ondergrond frezen", "Zoden leggen of inzaaien", "Aanwalsen en beregenen"],
  houtwerk: ["Palen uitzetten", "Fundering storten", "Panelen monteren"],
  water_elektra: ["Sleuven graven", "Kabels trekken", "Armaturen aansluiten"],
  specials: ["Fundering aanleggen", "Object plaatsen", "Aansluiten en testen"],
  heggen: ["Haag snoeien", "Snoeisel afvoeren"],
  bomen: ["Boomcontrole uitvoeren", "Snoeiwerk uitvoeren"],
  reiniging: ["Terras reinigen", "Onkruid verwijderen"],
};

type MeldingSpec = {
  klant: number;
  beschrijving: string;
  status: "nieuw" | "in_behandeling" | "wacht_op_derden" | "opgelost";
  prioriteit: "laag" | "normaal" | "hoog" | "urgent";
  soort: "serviceverzoek" | "klacht" | "schade";
  kanaal: "telefoon" | "whatsapp" | "email" | "portaal" | "intern";
  garantie: boolean;
  kosten: number;
  dagenGeleden: number;
};

const MELDINGEN: MeldingSpec[] = [
  { klant: 2, beschrijving: "Verzakking bij de terrasrand aan de tuinzijde, ongeveer 2 cm.", status: "nieuw", prioriteit: "hoog", soort: "klacht", kanaal: "telefoon", garantie: true, kosten: 0, dagenGeleden: 2 },
  { klant: 4, beschrijving: "Schuttingpaneel los na de storm van afgelopen weekend.", status: "nieuw", prioriteit: "normaal", soort: "serviceverzoek", kanaal: "whatsapp", garantie: false, kosten: 145, dagenGeleden: 4 },
  { klant: 5, beschrijving: "Zone 2 van de beregening blijft doorlopen; klep vermoedelijk defect.", status: "in_behandeling", prioriteit: "urgent", soort: "klacht", kanaal: "telefoon", garantie: true, kosten: 0, dagenGeleden: 6 },
  { klant: 21, beschrijving: "Verzoek extra maaibeurt vóór de open dag op 12 september.", status: "in_behandeling", prioriteit: "normaal", soort: "serviceverzoek", kanaal: "email", garantie: false, kosten: 165, dagenGeleden: 9 },
  { klant: 19, beschrijving: "Kolk op het parkeerterrein loopt traag leeg — leverancier moet meekijken.", status: "wacht_op_derden", prioriteit: "hoog", soort: "klacht", kanaal: "email", garantie: true, kosten: 0, dagenGeleden: 13 },
  { klant: 23, beschrijving: "Schade aan opsluitband door vuilniswagen; verzekeraar ingeschakeld.", status: "wacht_op_derden", prioriteit: "normaal", soort: "schade", kanaal: "portaal", garantie: false, kosten: 380, dagenGeleden: 17 },
  { klant: 10, beschrijving: "Kale plek in het nieuwe gazon; opnieuw ingezaaid en aangeslagen.", status: "opgelost", prioriteit: "laag", soort: "klacht", kanaal: "telefoon", garantie: true, kosten: 0, dagenGeleden: 24 },
  { klant: 12, beschrijving: "Tuinspot deed het niet — trafo vervangen, werkt weer.", status: "opgelost", prioriteit: "normaal", soort: "serviceverzoek", kanaal: "intern", garantie: false, kosten: 95, dagenGeleden: 31 },
];

// ============================================================
// 5. Vullen
// ============================================================

export const vullen = internalMutation({
  args: {
    /**
     * Alleen nodig als de deployment zichzelf niet kan identificeren; het
     * npm-script geeft hem altijd mee. Zie `bewaakDeployment`.
     */
    bevestigDeployment: v.optional(v.string()),
    /** E-mail van de staf-gebruiker die eigenaar wordt van de demo-data. */
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const deployment = bewaakDeployment(args.bevestigDeployment);

    // Idempotentie: liever weigeren dan een tweede berg er bovenop leggen.
    const bestaand = await ctx.db.query("demoSeed").first();
    if (bestaand) {
      throw new ConvexError(
        "Er staat al demo-data in deze deployment. Ruim eerst op met " +
          "`npm run seed:clear` en seed daarna opnieuw."
      );
    }

    const email = args.email ?? "e2e-test@toptuinen.nl";
    const eigenaar = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (!eigenaar) {
      throw new ConvexError(
        `Geen gebruiker gevonden met e-mail "${email}". Geef de juiste ` +
          "staf-gebruiker mee met --email."
      );
    }
    const userId = eigenaar._id;

    // ── Tenant van de demo-data ───────────────────────────────────────
    // Sinds de Clerk-Organizations-migratie is de organisatie de tenant, niet
    // de eigenaar-user. Op een dev-deployment hoort er precies één actieve
    // organisatie te staan; zelfde patroon (en dezelfde voorzichtigheid) als
    // `orgVoorPubliekeIntake` in configuratorAanvragen.ts, maar hier hard:
    // demo-data in de verkeerde tenant is erger dan geen demo-data.
    const actieveOrganisaties = (
      await ctx.db.query("organisaties").collect()
    ).filter((o) => o.actief);
    if (actieveOrganisaties.length !== 1) {
      throw new ConvexError(
        `Verwacht precies één actieve organisatie op deze deployment, ` +
          `gevonden: ${actieveOrganisaties.length}. Seed pas als de ` +
          "organisatie is geprovisioneerd."
      );
    }
    const orgId = actieveOrganisaties[0]._id;

    const nu = Date.now();
    const geseedOp = nu;
    const random = maakRandom(20260814);

    // Bedrijfsgegevens voor de factuur-snapshot; valt terug op een
    // demo-invulling als de organisatie nog geen instellingen heeft.
    const instellingen = await ctx.db
      .query("instellingen")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .first();
    const bedrijf = instellingen?.bedrijfsgegevens ?? {
      naam: "Top Tuinen",
      adres: "Bedrijfsweg 1",
      postcode: "6135 KL",
      plaats: "Sittard",
    };

    // Vanaf hier draagt élke geseede rij `orgId` waar het schema dat veld
    // kent. Tabellen zonder orgId (leadActiviteiten, planningTaken,
    // weekPlanning) hangen aan een ouder die hem wél heeft — lead, project of
    // medewerker — en erven de tenant daarlangs.

    // ── Medewerkers ───────────────────────────────────────────────────
    const medewerkerIds: Id<"medewerkers">[] = [];
    for (const m of MEDEWERKERS) {
      const id = await bewaar(ctx, geseedOp, "medewerkers", {
        orgId,
        naam: m.naam,
        email: `${m.naam.toLowerCase().replace(/[^a-z]+/g, ".")}@voorbeeld.test`,
        telefoon: demoTelefoon(medewerkerIds.length),
        functie: m.functie,
        uurtarief: m.uurtarief,
        contractType: m.contractType,
        isActief: true,
        beschikbaarheid: { werkdagen: [1, 2, 3, 4, 5], urenPerWeek: 40, maxUrenPerDag: 9 },
        createdAt: nu,
        updatedAt: nu,
      });
      medewerkerIds.push(id);
    }

    // ── Teams ─────────────────────────────────────────────────────────
    const teamIds: Id<"teams">[] = [];
    for (const t of TEAMS) {
      const id = await bewaar(ctx, geseedOp, "teams", {
        orgId,
        naam: t.naam,
        leden: t.ledenIndex.map((i) => medewerkerIds[i]),
        kleur: t.kleur,
        isActief: true,
        createdAt: nu,
        updatedAt: nu,
      });
      teamIds.push(id);
    }

    // ── Klanten ───────────────────────────────────────────────────────
    // Let op: bewust ZONDER "lead". `hoortInKlantenLijst`
    // (convex/leadsKlantenHelpers.ts) houdt klanten met pipelineStatus "lead"
    // buiten /klanten — die horen op het leadbord. Een demo-klant met die
    // status zou dus onzichtbaar zijn.
    const pipelineVerdeling = [
      "offerte_verzonden",
      "getekend",
      "in_uitvoering",
      "opgeleverd",
      "onderhoud",
    ] as const;
    const klantIds: Id<"klanten">[] = [];
    for (const [i, k] of KLANTEN.entries()) {
      const id = await bewaar(ctx, geseedOp, "klanten", {
        orgId,
        naam: k.naam,
        adres: k.adres,
        postcode: k.postcode,
        plaats: k.plaats,
        email: demoEmail(k.naam),
        telefoon: demoTelefoon(i),
        klantType: k.type,
        ...(k.contactpersoon ? { contactpersoon: k.contactpersoon } : {}),
        pipelineStatus: pipelineVerdeling[i % pipelineVerdeling.length],
        // Tag/type-dedupe (WS6): geen tags die het klantType herhalen — de
        // type-badge zegt dat al. "contract" blijft als échte extra informatie.
        tags: k.type === "particulier" ? [] : ["contract"],
        createdAt: nu - (120 - i * 3) * DAG,
        updatedAt: nu - (30 - (i % 20)) * DAG,
      });
      klantIds.push(id);
    }

    // ── Leads (kanban) ────────────────────────────────────────────────
    // Let op: een lead in kolom "gewonnen" krijgt bewust GEEN
    // `gekoppeldKlantId`. Met zo'n koppeling geldt hij als gepromoveerd en
    // verdwijnt hij van het bord (configuratorAanvragen.listByPipeline).
    let verliesIndex = 0;
    const leadIds: Id<"configuratorAanvragen">[] = [];
    for (const [i, l] of LEADS.entries()) {
      const aangemaakt = nu - (i * 4 + 2) * DAG;
      const id = await bewaar(ctx, geseedOp, "configuratorAanvragen", {
        orgId,
        type: "contact",
        status: leadStatusVanKolom(l.kolom),
        referentie: `CFG-DEMO-${String(i + 1).padStart(3, "0")}`,
        klantNaam: l.naam,
        klantEmail: demoEmail(l.naam),
        klantTelefoon: demoTelefoon(100 + i),
        klantAdres: l.adres,
        klantPostcode: l.postcode,
        klantPlaats: l.plaats,
        specificaties: {
          onderwerp: l.omschrijving,
          bericht: `Aanvraag via ${l.bron.replace(/_/g, " ")}. ${l.omschrijving}.`,
          hoeGevonden: l.bron,
        },
        indicatiePrijs: l.waarde,
        pipelineStatus: l.kolom,
        bron: l.bron,
        geschatteWaarde: l.waarde,
        omschrijving: l.omschrijving,
        ...(l.kolom === "verloren"
          ? { verliesReden: VERLIES_REDENEN[verliesIndex++ % VERLIES_REDENEN.length] }
          : {}),
        createdAt: aangemaakt,
        updatedAt: aangemaakt + DAG,
      });
      leadIds.push(id);

      await bewaar(ctx, geseedOp, "leadActiviteiten", {
        leadId: id,
        type: "aangemaakt",
        beschrijving: `Lead binnengekomen via ${l.bron.replace(/_/g, " ")}`,
        gebruikerId: userId,
        createdAt: aangemaakt,
      });
      if (l.kolom !== "nieuw") {
        await bewaar(ctx, geseedOp, "leadActiviteiten", {
          leadId: id,
          type: "status_wijziging",
          beschrijving: `Status naar "${l.kolom.replace(/_/g, " ")}"`,
          gebruikerId: userId,
          createdAt: aangemaakt + DAG,
        });
      }
    }

    // ── Offertes (+ voorcalculaties) ──────────────────────────────────
    const margePercentage = instellingen?.standaardMargePercentage ?? 22;
    const btwPercentage = instellingen?.btwPercentage ?? 21;
    const offerteIds: Id<"offertes">[] = [];

    for (const [i, o] of OFFERTES.entries()) {
      const k = KLANTEN[o.klant];
      const aangemaakt = nu - o.dagenGeleden * DAG;
      const { regels, totalen } = maakRegelsEnTotalen(
        o.regels,
        `demo-${i}`,
        margePercentage,
        btwPercentage
      );

      const offerteId = await bewaar(ctx, geseedOp, "offertes", {
        orgId,
        klantId: klantIds[o.klant],
        type: o.type,
        status: o.status,
        offerteNummer: `TOPTUINEN2026-${String(101 + i)}`,
        klant: {
          naam: k.naam,
          adres: k.adres,
          postcode: k.postcode,
          plaats: k.plaats,
          email: demoEmail(k.naam),
          telefoon: demoTelefoon(o.klant),
        },
        algemeenParams: {
          bereikbaarheid: (["goed", "beperkt", "slecht"] as const)[i % 3],
          achterstalligheid: (["laag", "gemiddeld", "hoog"] as const)[i % 3],
          klantvriendelijkheid: 3 + (i % 3),
          afstandVanLoods: 4 + Math.round(random() * 22),
          typeWerkzaamheden: o.scopes,
        },
        scopes: o.scopes,
        scopeData: o.scopeData as never,
        totalen,
        regels,
        bron: "wizard",
        notities: `Demo-offerte (${o.type}) — ${o.scopes.join(", ")}`,
        createdAt: aangemaakt,
        updatedAt: aangemaakt + 2 * DAG,
        ...(o.status === "concept"
          ? {}
          : { verzondenAt: aangemaakt + 2 * DAG }),
        ...(o.status === "geaccepteerd"
          ? {
              customerResponse: {
                status: "geaccepteerd" as const,
                respondedAt: aangemaakt + 5 * DAG,
                viewedAt: aangemaakt + 3 * DAG,
                comment: "Akkoord, graag inplannen.",
              },
            }
          : {}),
        ...(o.status === "afgewezen"
          ? {
              customerResponse: {
                status: "afgewezen" as const,
                respondedAt: aangemaakt + 6 * DAG,
                viewedAt: aangemaakt + 3 * DAG,
                comment: "Helaas buiten budget.",
              },
            }
          : {}),
      });
      offerteIds.push(offerteId);

      // Voorcalculatie hoort bij alles ná de conceptfase. Altijd met een
      // gezette `offerteId` — zie de toelichting bij PROJECTEN.
      if (o.status !== "concept") {
        const teamGrootte = ([2, 3, 4] as const)[i % 3];
        const effectieveUrenPerDag = 7;
        const normUrenPerScope = normUrenPerScopeVan(o.regels, o.scopes);
        const normUrenTotaal = Object.values(normUrenPerScope).reduce((s, u) => s + u, 0);
        await bewaar(ctx, geseedOp, "voorcalculaties", {
          orgId,
          offerteId,
          teamGrootte,
          teamleden: TEAMS[i % TEAMS.length].ledenIndex.map((n) => MEDEWERKERS[n].naam),
          effectieveUrenPerDag,
          normUrenTotaal,
          geschatteDagen: Math.max(
            1,
            Math.ceil(normUrenTotaal / (teamGrootte * effectieveUrenPerDag))
          ),
          normUrenPerScope,
          createdAt: aangemaakt + DAG,
          updatedAt: aangemaakt + DAG,
        });
      }
    }

    // ── Historie: vorig kalenderjaar ──────────────────────────────────
    // Losstaand van OFFERTES: deze reeks hangt bewust aan géén werkitem, en
    // hij mag ook niet in `offerteIds` belanden — PROJECTEN indexeert daarin.
    // Zie de toelichting bij `HISTORIE` voor het waarom van elke datum.
    let aantalHistorieFacturen = 0;
    for (const [i, h] of HISTORIE.entries()) {
      const k = KLANTEN[h.klant];
      const aangemaakt = vorigJaarOp(nu, h.gemaakt[0], h.gemaakt[1]);
      const getekend = vorigJaarOp(nu, h.getekend[0], h.getekend[1]);
      const historieJaar = new Date(aangemaakt).getFullYear();
      const { regels, totalen } = maakRegelsEnTotalen(
        h.regels,
        `demo-h-${i}`,
        margePercentage,
        btwPercentage
      );
      const klantSnapshot = {
        naam: k.naam,
        adres: k.adres,
        postcode: k.postcode,
        plaats: k.plaats,
        email: demoEmail(k.naam),
        telefoon: demoTelefoon(h.klant),
      };

      const offerteId = await bewaar(ctx, geseedOp, "offertes", {
        orgId,
        klantId: klantIds[h.klant],
        type: h.type,
        status: h.status,
        offerteNummer: `TOPTUINEN${historieJaar}-${String(301 + i)}`,
        klant: klantSnapshot,
        algemeenParams: {
          bereikbaarheid: (["goed", "beperkt", "slecht"] as const)[i % 3],
          achterstalligheid: (["laag", "gemiddeld", "hoog"] as const)[i % 3],
          klantvriendelijkheid: 3 + (i % 3),
          // Bewust zonder `random()`: die stroom bedient de bestaande
          // planningstaken en uren, en die mogen niet verschuiven.
          afstandVanLoods: 5 + ((i * 7) % 23),
          typeWerkzaamheden: h.scopes,
        },
        scopes: h.scopes,
        scopeData: h.scopeData as never,
        totalen,
        regels,
        bron: "wizard",
        notities: `Demo-historie ${historieJaar} (${h.type}) — ${h.scopes.join(", ")}`,
        createdAt: aangemaakt,
        // `updatedAt` is de TERUGVAL-peildatum van getekende omzet
        // (peildatumGetekend, lib/omzetDefinities.ts). Op "nu" laten staan zou
        // deze offerte alsnog in de omzet van deze maand duwen.
        updatedAt: getekend,
        verzondenAt: aangemaakt + 2 * DAG,
        customerResponse: {
          status: h.status,
          respondedAt: getekend,
          viewedAt: aangemaakt + 3 * DAG,
          comment:
            h.status === "geaccepteerd"
              ? "Akkoord, graag inplannen."
              : "Helaas buiten budget.",
        },
      });

      const teamGrootte = ([2, 3, 4] as const)[i % 3];
      const effectieveUrenPerDag = 7;
      const normUrenPerScope = normUrenPerScopeVan(h.regels, h.scopes);
      const normUrenTotaal = Object.values(normUrenPerScope).reduce((s, u) => s + u, 0);
      await bewaar(ctx, geseedOp, "voorcalculaties", {
        orgId,
        offerteId,
        teamGrootte,
        teamleden: TEAMS[i % TEAMS.length].ledenIndex.map((n) => MEDEWERKERS[n].naam),
        effectieveUrenPerDag,
        normUrenTotaal,
        geschatteDagen: Math.max(
          1,
          Math.ceil(normUrenTotaal / (teamGrootte * effectieveUrenPerDag))
        ),
        normUrenPerScope,
        createdAt: aangemaakt + DAG,
        updatedAt: aangemaakt + DAG,
      });

      if (!h.factuur) continue;

      const factuurdatum = vorigJaarOp(nu, h.factuur.datum[0], h.factuur.datum[1]);
      const factuurRegels = h.regels.slice(0, 4).map((r, n) => ({
        id: `demo-hf-${i}-${n}`,
        omschrijving: r.omschrijving,
        hoeveelheid: r.hoeveelheid,
        eenheid: r.eenheid,
        prijsPerEenheid: afgerond(r.prijs * 1.22),
        totaal: afgerond(r.hoeveelheid * r.prijs * 1.22),
        btwCode: 21 as const,
        scope: r.scope,
      }));
      const factuurSubtotaal = afgerond(
        factuurRegels.reduce((s, r) => s + r.totaal, 0)
      );
      const factuurBtw = afgerond((factuurSubtotaal * btwPercentage) / 100);
      const factuurTotaal = afgerond(factuurSubtotaal + factuurBtw);

      await bewaar(ctx, geseedOp, "facturen", {
        orgId,
        // GEEN projectId — dat is precies wat deze reeks uit de archiveer-
        // migratie van `users.initializeDefaults` houdt (zie HISTORIE).
        klantId: klantIds[h.klant],
        offerteId,
        factuurnummer: `FAC-${new Date(factuurdatum).getFullYear()}-${String(101 + i)}`,
        status: h.factuur.betaald ? "betaald" : "vervallen",
        documentStatus: "verzonden",
        betaalStatus: h.factuur.betaald ? "betaald" : "vervallen",
        betaaldBedrag: h.factuur.betaald ? factuurTotaal : 0,
        factuurType: "regulier",
        klant: klantSnapshot,
        bedrijf,
        regels: factuurRegels,
        subtotaal: factuurSubtotaal,
        btwPercentage,
        btwBedrag: factuurBtw,
        totaalInclBtw: factuurTotaal,
        btwUitsplitsing: [
          { percentage: btwPercentage, grondslag: factuurSubtotaal, bedrag: factuurBtw },
        ],
        factuurdatum,
        vervaldatum: factuurdatum + 30 * DAG,
        betalingstermijnDagen: 30,
        bron: "handmatig",
        verzondenAt: factuurdatum + DAG,
        ...(h.factuur.betaald ? { betaaldAt: factuurdatum + 21 * DAG } : {}),
        createdAt: factuurdatum,
        updatedAt: factuurdatum + DAG,
      });
      aantalHistorieFacturen++;
    }

    // ── Projecten (werkitems) + planningstaken ────────────────────────
    const projectIds: Id<"projecten">[] = [];
    for (const [i, p] of PROJECTEN.entries()) {
      const spec = OFFERTES[p.offerte];
      const k = KLANTEN[spec.klant];
      const start = datumISO(nu, p.startDag);
      const eind = datumISO(nu, p.startDag + p.duurDagen - 1);
      const projectId = await bewaar(ctx, geseedOp, "projecten", {
        orgId,
        type: "project",
        offerteId: offerteIds[p.offerte],
        klantId: klantIds[spec.klant],
        naam: p.naam,
        status: p.status,
        // Een werkitem verschijnt alleen op het weekbord met geplandeStart
        // ÉN teamId (src/components/planbord/adapter.ts); zonder allebei
        // hoort het in de opdrachtenbak.
        ...(p.wachtrij
          ? {}
          : {
              geplandeStart: start,
              geplandeEind: eind,
              teamId: teamIds[p.team],
              volgordeBinnenDag: (i % 3) + 1,
              geplandeStartTijd: "07:30",
              geplandeEindTijd: "16:00",
            }),
        geschatteUren: p.geschatteUren,
        adres: `${k.adres}, ${k.postcode} ${k.plaats}`,
        toegewezenMedewerkerIds: TEAMS[p.team].ledenIndex.map((n) => medewerkerIds[n]),
        ...(p.status === "afgerond" ||
        p.status === "nacalculatie_compleet" ||
        p.status === "gefactureerd"
          ? { afgerondOp: nu + (p.startDag + p.duurDagen) * DAG, klaarVoorFacturatie: true }
          : {}),
        createdAt: nu + (p.startDag - 14) * DAG,
        updatedAt: nu - DAG,
      });
      projectIds.push(projectId);

      let volgorde = 1;
      for (const scope of spec.scopes) {
        for (const taak of TAKEN_PER_SCOPE[scope] ?? []) {
          await bewaar(ctx, geseedOp, "planningTaken", {
            projectId,
            scope,
            taakNaam: taak,
            normUren: 4 + Math.round(random() * 8),
            geschatteDagen: 1,
            volgorde: volgorde++,
            status:
              p.status === "gepland"
                ? "gepland"
                : p.status === "in_uitvoering"
                  ? volgorde <= 3
                    ? "afgerond"
                    : "gestart"
                  : "afgerond",
            updatedAt: nu - DAG,
          });
        }
      }
    }

    // ── Urenregistraties ──────────────────────────────────────────────
    // Gekoppeld aan project én medewerker, zodat /uren en /rapportages
    // gevuld zijn. `medewerker` is de naamstring die de bestaande
    // Excel-export en de medewerker-indexen gebruiken.
    let aantalUren = 0;
    for (const [i, p] of PROJECTEN.entries()) {
      if (p.wachtrij || p.startDag > 0) continue; // nog niet gestart → nog geen uren
      const teamLeden = TEAMS[p.team].ledenIndex;
      const gewerkteDagen = Math.min(p.duurDagen, Math.max(1, -p.startDag + 1));
      for (let d = 0; d < gewerkteDagen; d++) {
        const datum = datumISO(nu, p.startDag + d);
        const dagVanWeek = new Date(nu + (p.startDag + d) * DAG).getDay();
        if (dagVanWeek === 0 || dagVanWeek === 6) continue; // geen weekendwerk
        for (const ledenIndex of teamLeden) {
          const uren = afgerond(6.5 + random() * 2.5);
          await bewaar(ctx, geseedOp, "urenRegistraties", {
            orgId,
            projectId: projectIds[i],
            datum,
            medewerker: MEDEWERKERS[ledenIndex].naam,
            medewerkerId: medewerkerIds[ledenIndex],
            uren,
            scope: OFFERTES[p.offerte].scopes[0],
            bron: "handmatig",
            notities: d === 0 ? "Startdag, materiaal aangevoerd" : undefined,
          });
          aantalUren++;
        }
      }
    }

    // ── Weekplanning ──────────────────────────────────────────────────
    // `weekPlanning` is voor plánnen DEPRECATED (het werkitem is de waarheid,
    // zie schema.ts), maar /planning leest de tabs maand/kwartaal/jaar er nog
    // uit. Zonder rijen zijn die tabs leeg, dus vult de seed ze wél.
    let aantalWeekPlanning = 0;
    for (const [i, p] of PROJECTEN.entries()) {
      if (p.wachtrij) continue;
      for (let d = 0; d < p.duurDagen; d++) {
        const datum = datumISO(nu, p.startDag + d);
        const dagVanWeek = new Date(nu + (p.startDag + d) * DAG).getDay();
        if (dagVanWeek === 0 || dagVanWeek === 6) continue;
        for (const ledenIndex of TEAMS[p.team].ledenIndex) {
          await bewaar(ctx, geseedOp, "weekPlanning", {
            medewerkerId: medewerkerIds[ledenIndex],
            projectId: projectIds[i],
            datum,
            uren: 8,
            createdAt: nu - 7 * DAG,
            updatedAt: nu - 7 * DAG,
          });
          aantalWeekPlanning++;
        }
      }
    }

    // ── Facturen ──────────────────────────────────────────────────────
    // Bewust gemengd: betaald, deels betaald, open, vervallen en concept —
    // een lijst waarin alles dezelfde status heeft toont de statuskolom niet.
    //
    // LET OP, dit bepaalt de opzet: `users.initializeDefaults` (convex/users.ts,
    // draait bij het laden van de app) is een migratie die per factuur MET een
    // projectId het werkitem bijwerkt — status → "gefactureerd" zodra de
    // factuur definitief/verzonden/betaald is, plus archiveren van werkitem
    // én offerte zodra hij betaald is. Zouden alle acht facturen aan een
    // project hangen, dan stond binnen een seconde na het seeden de halve
    // projectenlijst op "gefactureerd" en waren er drie offertes uit beeld.
    //
    // Daarom: één project-factuur (op het werkitem dat tóch al "gefactureerd"
    // is; die verhuist netjes naar /archief, zodat dat scherm ook gevuld is)
    // en verder losse facturen op de klant — precies waar `projectId`
    // optioneel voor is (§2.8, bron "handmatig").
    type FactuurSpec = {
      /** Index in PROJECTEN, of null voor een losse factuur op de klant. */
      project: number | null;
      /** Index in KLANTEN; alleen nodig bij een losse factuur. */
      klant?: number;
      documentStatus: "concept" | "definitief" | "verzonden";
      betaalStatus: "open" | "gedeeltelijk_betaald" | "betaald" | "vervallen";
      dagenGeleden: number;
      deelBetaald?: number;
    };
    const FACTUREN: FactuurSpec[] = [
      { project: 0, documentStatus: "verzonden", betaalStatus: "betaald", dagenGeleden: 38 },
      { project: null, klant: 4, documentStatus: "verzonden", betaalStatus: "betaald", dagenGeleden: 30 },
      { project: null, klant: 21, documentStatus: "verzonden", betaalStatus: "betaald", dagenGeleden: 24 },
      { project: null, klant: 5, documentStatus: "verzonden", betaalStatus: "gedeeltelijk_betaald", dagenGeleden: 18, deelBetaald: 0.4 },
      { project: null, klant: 9, documentStatus: "verzonden", betaalStatus: "open", dagenGeleden: 9 },
      { project: null, klant: 19, documentStatus: "verzonden", betaalStatus: "vervallen", dagenGeleden: 62 },
      { project: null, klant: 6, documentStatus: "definitief", betaalStatus: "open", dagenGeleden: 3 },
      { project: null, klant: 22, documentStatus: "concept", betaalStatus: "open", dagenGeleden: 1 },
    ];

    for (const [i, f] of FACTUREN.entries()) {
      // Bij een losse factuur pakken we de regels van een offerte van
      // dezelfde klant, zodat de inhoud bij de klant past.
      const p = f.project !== null ? PROJECTEN[f.project] : null;
      const klantIndex = p ? OFFERTES[p.offerte].klant : (f.klant as number);
      const spec =
        p !== null
          ? OFFERTES[p.offerte]
          : (OFFERTES.find((o) => o.klant === klantIndex) ?? OFFERTES[0]);
      const k = KLANTEN[klantIndex];
      const regels = spec.regels.slice(0, 4).map((r, n) => ({
        id: `demo-f-${i}-${n}`,
        omschrijving: r.omschrijving,
        hoeveelheid: r.hoeveelheid,
        eenheid: r.eenheid,
        prijsPerEenheid: afgerond(r.prijs * 1.22),
        totaal: afgerond(r.hoeveelheid * r.prijs * 1.22),
        btwCode: 21 as const,
        scope: r.scope,
      }));
      const subtotaal = afgerond(regels.reduce((s, r) => s + r.totaal, 0));
      const btwBedrag = afgerond((subtotaal * btwPercentage) / 100);
      const totaalInclBtw = afgerond(subtotaal + btwBedrag);
      const factuurdatum = nu - f.dagenGeleden * DAG;

      await bewaar(ctx, geseedOp, "facturen", {
        orgId,
        ...(f.project !== null ? { projectId: projectIds[f.project] } : {}),
        klantId: klantIds[klantIndex],
        factuurnummer: `FAC-2026-${String(201 + i)}`,
        // `status` is de legacy-spiegel van documentStatus/betaalStatus
        // (zie schema.ts); beide worden gezet zodat oude én nieuwe lezers
        // hetzelfde beeld hebben.
        status:
          f.documentStatus === "concept"
            ? "concept"
            : f.betaalStatus === "betaald"
              ? "betaald"
              : f.betaalStatus === "vervallen"
                ? "vervallen"
                : f.documentStatus === "verzonden"
                  ? "verzonden"
                  : "definitief",
        documentStatus: f.documentStatus,
        betaalStatus: f.betaalStatus,
        betaaldBedrag:
          f.betaalStatus === "betaald"
            ? totaalInclBtw
            : f.deelBetaald
              ? afgerond(totaalInclBtw * f.deelBetaald)
              : 0,
        factuurType: "regulier",
        klant: {
          naam: k.naam,
          adres: k.adres,
          postcode: k.postcode,
          plaats: k.plaats,
          email: demoEmail(k.naam),
          telefoon: demoTelefoon(klantIndex),
        },
        bedrijf,
        regels,
        subtotaal,
        btwPercentage,
        btwBedrag,
        totaalInclBtw,
        btwUitsplitsing: [
          { percentage: btwPercentage, grondslag: subtotaal, bedrag: btwBedrag },
        ],
        factuurdatum,
        vervaldatum: factuurdatum + 30 * DAG,
        betalingstermijnDagen: 30,
        ...(p !== null ? { offerteId: offerteIds[p.offerte] } : {}),
        bron: p !== null ? "project" : "handmatig",
        ...(f.documentStatus === "verzonden"
          ? { verzondenAt: factuurdatum + DAG }
          : {}),
        ...(f.betaalStatus === "betaald"
          ? { betaaldAt: factuurdatum + 12 * DAG }
          : {}),
        createdAt: factuurdatum,
        updatedAt: factuurdatum + DAG,
      });
    }

    // ── Servicemeldingen ──────────────────────────────────────────────
    for (const m of MELDINGEN) {
      const aangemaakt = nu - m.dagenGeleden * DAG;
      await bewaar(ctx, geseedOp, "servicemeldingen", {
        orgId,
        klantId: klantIds[m.klant],
        beschrijving: m.beschrijving,
        isGarantie: m.garantie,
        status: m.status,
        type: m.soort,
        kanaal: m.kanaal,
        eigenaarId: userId,
        aangemaaktDoorId: userId,
        taaksoort: "melding",
        prioriteit: m.prioriteit,
        kosten: m.kosten,
        ...(m.soort === "schade" ? { verzekeringsvlag: true } : {}),
        ...(m.soort === "serviceverzoek" ? { beoordelenVoorPlanning: true } : {}),
        ...(m.status !== "opgelost" ? { deadline: datumISO(nu, 7) } : {}),
        createdAt: aangemaakt,
        updatedAt: aangemaakt + DAG,
      });
    }

    // ── Meldingen (notificaties in de app) ────────────────────────────
    const NOTIFICATIES = [
      { type: "offerte_geaccepteerd" as const, title: "Offerte geaccepteerd", message: "Pierre Dohmen accepteerde TOPTUINEN2026-113.", gelezen: false, dagen: 1 },
      { type: "offerte_bekeken" as const, title: "Offerte bekeken", message: "Marieke Ramaekers opende TOPTUINEN2026-109.", gelezen: false, dagen: 2 },
      { type: "offerte_afgewezen" as const, title: "Offerte afgewezen", message: "Nicole Smeets wees TOPTUINEN2026-118 af.", gelezen: false, dagen: 3 },
      { type: "project_status_update" as const, title: "Project gestart", message: "Parkeerterrein Bouwbedrijf Frissen staat op in uitvoering.", gelezen: true, dagen: 4 },
      { type: "budget_warning" as const, title: "Uren boven budget", message: "Gazon en jacuzzi Hermans zit op 108% van de geraamde uren.", gelezen: false, dagen: 5 },
      { type: "offerte_herinnering" as const, title: "Herinnering nodig", message: "TOPTUINEN2026-110 staat 14 dagen op verzonden.", gelezen: true, dagen: 7 },
      { type: "system_reminder" as const, title: "Facturatie klaarzetten", message: "3 werkitems staan klaar voor facturatie.", gelezen: true, dagen: 9 },
      { type: "project_assignment" as const, title: "Team toegewezen", message: "Team Onderhoud staat ingepland op VvE Park Molenbeek.", gelezen: true, dagen: 12 },
    ];
    for (const n of NOTIFICATIES) {
      const aangemaakt = nu - n.dagen * DAG;
      await bewaar(ctx, geseedOp, "notifications", {
        orgId,
        userId,
        type: n.type,
        title: n.title,
        message: n.message,
        isRead: n.gelezen,
        isDismissed: false,
        ...(n.gelezen ? { readAt: aangemaakt + 6 * 60 * 60 * 1000 } : {}),
        triggeredBy: "systeem",
        createdAt: aangemaakt,
      });
    }

    const registraties = await ctx.db
      .query("demoSeed")
      .withIndex("by_geseedOp", (q) => q.eq("geseedOp", geseedOp))
      .collect();

    return {
      deployment,
      eigenaar: `${eigenaar.name} <${eigenaar.email}>`,
      geseedOp,
      totaal: registraties.length,
      perTabel: telPerTabel(registraties),
      urenRegistraties: aantalUren,
      weekPlanning: aantalWeekPlanning,
      historie: {
        jaar: new Date(nu).getFullYear() - 1,
        offertes: HISTORIE.length,
        getekend: HISTORIE.filter((h) => h.status === "geaccepteerd").length,
        facturen: aantalHistorieFacturen,
      },
    };
  },
});

// ============================================================
// 6. Opruimen
// ============================================================

export const opruimen = internalMutation({
  args: {
    bevestigDeployment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const deployment = bewaakDeployment(args.bevestigDeployment);

    const registraties = await ctx.db.query("demoSeed").collect();
    if (registraties.length === 0) {
      return {
        deployment,
        verwijderd: 0,
        alWeg: 0,
        perTabel: {},
        melding: "Er stond geen demo-data geregistreerd; niets gedaan.",
      };
    }

    let verwijderd = 0;
    let alWeg = 0;
    const perTabel: Record<string, number> = {};

    for (const registratie of registraties) {
      // normalizeId geeft null als het id niet bij deze tabel hoort — dan is
      // er iets grondig mis en slaan we hem over in plaats van te gokken.
      const id = ctx.db.normalizeId(
        registratie.tabel as TableNames,
        registratie.documentId
      );
      if (id) {
        const doc = await ctx.db.get(id);
        if (doc) {
          await ctx.db.delete(id);
          verwijderd++;
          perTabel[registratie.tabel] = (perTabel[registratie.tabel] ?? 0) + 1;
        } else {
          // Document is met de hand verwijderd — gewoon overslaan.
          alWeg++;
        }
      } else {
        alWeg++;
      }
      await ctx.db.delete(registratie._id);
    }

    return { deployment, verwijderd, alWeg, perTabel };
  },
});

// ============================================================
// 7. Stand van zaken (handig bij het verifiëren)
// ============================================================

export const stand = internalQuery({
  args: {},
  handler: async (ctx) => {
    const registraties = await ctx.db.query("demoSeed").collect();
    return {
      deployment: bepaalDeployment(),
      geregistreerd: registraties.length,
      perTabel: telPerTabel(registraties),
      geseedOp: registraties[0]?.geseedOp
        ? new Date(registraties[0].geseedOp).toISOString()
        : null,
    };
  },
});

// ============================================================
// 8. Kleine hulpjes onderaan (leesvolgorde: eerst het verhaal)
// ============================================================

/**
 * Regels + totalen zoals de calculator ze oplevert. Gedeeld door de lopende
 * offertes en de historie: twee reeksen die elk hun eigen sommetje maken
 * zouden vroeg of laat uit elkaar lopen, en dan liegt de vergelijking.
 */
function maakRegelsEnTotalen(
  regels: RegelSpec[],
  idPrefix: string,
  margePercentage: number,
  btwPercentage: number
) {
  const opgemaakt = regels.map((r, n) => ({
    id: `${idPrefix}-${n}`,
    scope: r.scope,
    omschrijving: r.omschrijving,
    eenheid: r.eenheid,
    hoeveelheid: r.hoeveelheid,
    prijsPerEenheid: r.prijs,
    totaal: afgerond(r.hoeveelheid * r.prijs),
    type: r.soort,
  }));

  const materiaalkosten = afgerond(
    opgemaakt.filter((r) => r.type !== "arbeid").reduce((s, r) => s + r.totaal, 0)
  );
  const arbeidskosten = afgerond(
    opgemaakt.filter((r) => r.type === "arbeid").reduce((s, r) => s + r.totaal, 0)
  );
  const totaalUren = afgerond(
    regels
      .filter((r) => r.soort === "arbeid" && r.eenheid === "uur")
      .reduce((s, r) => s + r.hoeveelheid, 0)
  );
  const subtotaal = afgerond(materiaalkosten + arbeidskosten);
  const marge = afgerond((subtotaal * margePercentage) / 100);
  const totaalExBtw = afgerond(subtotaal + marge);
  const btw = afgerond((totaalExBtw * btwPercentage) / 100);

  return {
    regels: opgemaakt,
    totalen: {
      materiaalkosten,
      arbeidskosten,
      totaalUren,
      subtotaal,
      marge,
      margePercentage,
      totaalExBtw,
      btw,
      totaalInclBtw: afgerond(totaalExBtw + btw),
    },
  };
}

/** Arbeidsuren per scope; scopes zonder uurregel krijgen een minimum van 8. */
function normUrenPerScopeVan(
  regels: RegelSpec[],
  scopes: string[]
): Record<string, number> {
  const perScope: Record<string, number> = {};
  for (const scope of scopes) {
    const uren = regels
      .filter((r) => r.scope === scope && r.soort === "arbeid" && r.eenheid === "uur")
      .reduce((s, r) => s + r.hoeveelheid, 0);
    perScope[scope] = uren > 0 ? uren : 8;
  }
  return perScope;
}

/**
 * E-mailadres op het gereserveerde `.test`-domein (RFC 2606). Kan per
 * definitie niet bezorgd worden — zie de toelichting bovenaan dit bestand.
 */
function demoEmail(naam: string): string {
  const lokaal = naam
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
  return `${lokaal}@voorbeeld.test`;
}

/**
 * Telefoonnummer in het blok `06-9…`, dat in het Nederlandse nummerplan niet
 * voor mobiel wordt uitgegeven. Voldoet aan PHONE_PATTERN uit validators.ts.
 */
function demoTelefoon(index: number): string {
  return `069${String(1000000 + index * 37).slice(0, 7)}`;
}

/** Kanban-kolom → de oude `status`-keten die het schema nog kent. */
function leadStatusVanKolom(
  kolom: LeadKolom
): "nieuw" | "in_behandeling" | "goedgekeurd" | "afgekeurd" | "voltooid" {
  switch (kolom) {
    case "nieuw":
      return "nieuw";
    case "contact_gehad":
    case "offerte_verstuurd":
      return "in_behandeling";
    case "gewonnen":
      return "goedgekeurd";
    case "verloren":
      return "afgekeurd";
  }
}

function telPerTabel(registraties: Doc<"demoSeed">[]): Record<string, number> {
  const perTabel: Record<string, number> = {};
  for (const r of registraties) {
    perTabel[r.tabel] = (perTabel[r.tabel] ?? 0) + 1;
  }
  return perTabel;
}
