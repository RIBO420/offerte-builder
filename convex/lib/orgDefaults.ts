/**
 * De standaard-inrichting van een nieuwe organisatie: instellingen, normuren
 * en producten waarmee een verse tenant meteen kan rekenen.
 *
 * Deze lijsten stonden tot de Clerk-Organizations-migratie in `convex/users.ts`
 * en werden daar per gebruiker geseed. Er is nu nog één zaai-route, en die is
 * org-gescoped: `seedOrgDefaults` hieronder, aangeroepen door
 * `organisaties.maakOrganisatie` (nieuwe tenant) en `users.initializeDefaults`
 * (inhaalslag voor een organisatie die nog niets heeft). `users.upsert` seedt
 * sinds cluster 3.9 niets meer — een nieuwe aanmelding is geen tenant.
 */

import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

/**
 * Verse standaardinstellingen. Bewust een functie en geen constante: elke
 * insert krijgt zo zijn eigen `bedrijfsgegevens`-object in plaats van een
 * gedeelde referentie.
 */
export function standaardInstellingen() {
  return {
    uurtarief: 45.0,
    standaardMargePercentage: 15,
    btwPercentage: 21,
    bedrijfsgegevens: {
      naam: "",
      adres: "",
      postcode: "",
      plaats: "",
    },
    offerteNummerPrefix: "OFF-",
    laatsteOfferteNummer: 0,
  };
}

// Default normuren data
export const DEFAULT_NORMUREN = [
  // Grondwerk
  { activiteit: "Ontgraven licht", scope: "grondwerk", normuurPerEenheid: 0.15, eenheid: "m²", omschrijving: "Licht ontgraven tot 20cm diep" },
  { activiteit: "Ontgraven standaard", scope: "grondwerk", normuurPerEenheid: 0.25, eenheid: "m²", omschrijving: "Standaard ontgraven 20-40cm diep" },
  { activiteit: "Ontgraven zwaar", scope: "grondwerk", normuurPerEenheid: 0.4, eenheid: "m²", omschrijving: "Zwaar ontgraven >40cm diep" },
  { activiteit: "Grond afvoeren", scope: "grondwerk", normuurPerEenheid: 0.1, eenheid: "m³", omschrijving: "Laden en afvoeren grond" },
  // Bestrating
  { activiteit: "Tegels leggen", scope: "bestrating", normuurPerEenheid: 0.35, eenheid: "m²", omschrijving: "Leggen standaard tegels" },
  { activiteit: "Klinkers leggen", scope: "bestrating", normuurPerEenheid: 0.45, eenheid: "m²", omschrijving: "Leggen klinkers" },
  { activiteit: "Natuursteen leggen", scope: "bestrating", normuurPerEenheid: 0.55, eenheid: "m²", omschrijving: "Leggen natuursteen" },
  { activiteit: "Zandbed aanbrengen", scope: "bestrating", normuurPerEenheid: 0.1, eenheid: "m²", omschrijving: "Aanbrengen en egaliseren zandbed" },
  { activiteit: "Opsluitbanden plaatsen", scope: "bestrating", normuurPerEenheid: 0.25, eenheid: "m", omschrijving: "Plaatsen opsluitbanden" },
  // Borders
  { activiteit: "Grondbewerking border", scope: "borders", normuurPerEenheid: 0.2, eenheid: "m²", omschrijving: "Spitten en losmaken grond" },
  { activiteit: "Planten laag", scope: "borders", normuurPerEenheid: 0.15, eenheid: "m²", omschrijving: "Aanplanten lage intensiteit" },
  { activiteit: "Planten gemiddeld", scope: "borders", normuurPerEenheid: 0.25, eenheid: "m²", omschrijving: "Aanplanten gemiddelde intensiteit" },
  { activiteit: "Planten hoog", scope: "borders", normuurPerEenheid: 0.4, eenheid: "m²", omschrijving: "Aanplanten hoge intensiteit" },
  { activiteit: "Schors aanbrengen", scope: "borders", normuurPerEenheid: 0.08, eenheid: "m²", omschrijving: "Aanbrengen bodembedekking schors" },
  // Gras
  { activiteit: "Graszoden leggen", scope: "gras", normuurPerEenheid: 0.12, eenheid: "m²", omschrijving: "Leggen graszoden" },
  { activiteit: "Gras zaaien", scope: "gras", normuurPerEenheid: 0.05, eenheid: "m²", omschrijving: "Inzaaien gazon" },
  { activiteit: "Ondergrond bewerken", scope: "gras", normuurPerEenheid: 0.15, eenheid: "m²", omschrijving: "Voorbereiden ondergrond gazon" },
  // Houtwerk
  { activiteit: "Schutting plaatsen", scope: "houtwerk", normuurPerEenheid: 0.8, eenheid: "m", omschrijving: "Plaatsen schutting per strekkende meter" },
  { activiteit: "Vlonder leggen", scope: "houtwerk", normuurPerEenheid: 0.6, eenheid: "m²", omschrijving: "Leggen vlonder" },
  { activiteit: "Pergola bouwen", scope: "houtwerk", normuurPerEenheid: 4.0, eenheid: "stuk", omschrijving: "Bouwen pergola" },
  { activiteit: "Fundering standaard", scope: "houtwerk", normuurPerEenheid: 0.5, eenheid: "stuk", omschrijving: "Plaatsen funderingspaal/voet standaard" },
  { activiteit: "Fundering zwaar", scope: "houtwerk", normuurPerEenheid: 0.8, eenheid: "stuk", omschrijving: "Plaatsen funderingspaal/voet zwaar" },
  // Water/Elektra
  { activiteit: "Sleuf graven", scope: "water_elektra", normuurPerEenheid: 0.3, eenheid: "m", omschrijving: "Graven kabelsleuven" },
  { activiteit: "Kabel leggen", scope: "water_elektra", normuurPerEenheid: 0.1, eenheid: "m", omschrijving: "Leggen bekabeling" },
  { activiteit: "Armatuur plaatsen", scope: "water_elektra", normuurPerEenheid: 0.5, eenheid: "stuk", omschrijving: "Plaatsen verlichtingsarmatuur" },
  { activiteit: "Sleuf herstellen", scope: "water_elektra", normuurPerEenheid: 0.2, eenheid: "m", omschrijving: "Dichten en herstellen sleuf" },
  // Onderhoud - Gras
  { activiteit: "Maaien", scope: "gras_onderhoud", normuurPerEenheid: 0.02, eenheid: "m²", omschrijving: "Gras maaien" },
  { activiteit: "Kanten steken", scope: "gras_onderhoud", normuurPerEenheid: 0.05, eenheid: "m", omschrijving: "Graskanten steken" },
  { activiteit: "Verticuteren", scope: "gras_onderhoud", normuurPerEenheid: 0.03, eenheid: "m²", omschrijving: "Gazon verticuteren" },
  // Onderhoud - Borders
  { activiteit: "Wieden weinig", scope: "borders_onderhoud", normuurPerEenheid: 0.08, eenheid: "m²", omschrijving: "Onkruid verwijderen - weinig intensief" },
  { activiteit: "Wieden gemiddeld", scope: "borders_onderhoud", normuurPerEenheid: 0.15, eenheid: "m²", omschrijving: "Onkruid verwijderen - gemiddeld intensief" },
  { activiteit: "Wieden veel", scope: "borders_onderhoud", normuurPerEenheid: 0.25, eenheid: "m²", omschrijving: "Onkruid verwijderen - intensief" },
  { activiteit: "Snoei licht", scope: "borders_onderhoud", normuurPerEenheid: 0.1, eenheid: "m²", omschrijving: "Lichte snoei in borders" },
  { activiteit: "Snoei zwaar", scope: "borders_onderhoud", normuurPerEenheid: 0.2, eenheid: "m²", omschrijving: "Zware snoei in borders" },
  // Onderhoud - Heggen
  { activiteit: "Heg snoeien", scope: "heggen_onderhoud", normuurPerEenheid: 0.15, eenheid: "m³", omschrijving: "Snoeien heg per m³ volume" },
  { activiteit: "Snoeisel afvoeren", scope: "heggen_onderhoud", normuurPerEenheid: 0.1, eenheid: "m³", omschrijving: "Afvoeren snoeisel" },
  // Onderhoud - Bomen
  { activiteit: "Boom snoeien licht", scope: "bomen_onderhoud", normuurPerEenheid: 0.5, eenheid: "stuk", omschrijving: "Lichte snoei boom" },
  { activiteit: "Boom snoeien zwaar", scope: "bomen_onderhoud", normuurPerEenheid: 1.5, eenheid: "stuk", omschrijving: "Zware snoei boom" },
] as const;

// Default products data
export const DEFAULT_PRODUCTEN = [
  // Bestrating
  { productnaam: "Betontegel 30x30 grijs", categorie: "Bestrating", inkoopprijs: 1.50, verkoopprijs: 3.50, eenheid: "stuk", leverancier: "Struyk Verwo", verliespercentage: 5 },
  { productnaam: "Betontegel 60x60 grijs", categorie: "Bestrating", inkoopprijs: 8.00, verkoopprijs: 15.00, eenheid: "stuk", leverancier: "Struyk Verwo", verliespercentage: 5 },
  { productnaam: "Klinker waalformaat rood", categorie: "Bestrating", inkoopprijs: 0.35, verkoopprijs: 0.75, eenheid: "stuk", leverancier: "Wienerberger", verliespercentage: 8 },
  { productnaam: "Klinker waalformaat antraciet", categorie: "Bestrating", inkoopprijs: 0.40, verkoopprijs: 0.85, eenheid: "stuk", leverancier: "Wienerberger", verliespercentage: 8 },
  { productnaam: "Natuursteen tegels 60x60", categorie: "Bestrating", inkoopprijs: 35.00, verkoopprijs: 65.00, eenheid: "stuk", leverancier: "Beltrami", verliespercentage: 3 },
  { productnaam: "Opsluitband 100x20x6", categorie: "Bestrating", inkoopprijs: 2.50, verkoopprijs: 5.50, eenheid: "stuk", leverancier: "Struyk Verwo", verliespercentage: 5 },
  // Zand en fundering
  { productnaam: "Straatzand", categorie: "Zand en fundering", inkoopprijs: 18.00, verkoopprijs: 32.00, eenheid: "m³", leverancier: "De Beijer", verliespercentage: 10 },
  { productnaam: "Metselzand", categorie: "Zand en fundering", inkoopprijs: 20.00, verkoopprijs: 35.00, eenheid: "m³", leverancier: "De Beijer", verliespercentage: 10 },
  { productnaam: "Puingranulaat 0-31,5", categorie: "Zand en fundering", inkoopprijs: 12.00, verkoopprijs: 25.00, eenheid: "m³", leverancier: "De Beijer", verliespercentage: 10 },
  { productnaam: "Betonpuin", categorie: "Zand en fundering", inkoopprijs: 8.00, verkoopprijs: 18.00, eenheid: "m³", leverancier: "De Beijer", verliespercentage: 10 },
  // Houtwerk
  { productnaam: "Schuttingplank 180x15cm", categorie: "Houtwerk", inkoopprijs: 3.50, verkoopprijs: 7.50, eenheid: "stuk", leverancier: "Jongeneel", verliespercentage: 5 },
  { productnaam: "Schuttingpaal 7x7x270cm", categorie: "Houtwerk", inkoopprijs: 12.00, verkoopprijs: 25.00, eenheid: "stuk", leverancier: "Jongeneel", verliespercentage: 3 },
  { productnaam: "Vlonderdeel hardhout 21x145mm", categorie: "Houtwerk", inkoopprijs: 8.50, verkoopprijs: 16.00, eenheid: "m", leverancier: "Jongeneel", verliespercentage: 8 },
  { productnaam: "Balk 45x70mm geïmpregneerd", categorie: "Houtwerk", inkoopprijs: 4.50, verkoopprijs: 9.00, eenheid: "m", leverancier: "Jongeneel", verliespercentage: 5 },
  { productnaam: "Betonpoer 30x30x30cm", categorie: "Houtwerk", inkoopprijs: 8.00, verkoopprijs: 16.00, eenheid: "stuk", leverancier: "Struyk Verwo", verliespercentage: 3 },
  // Grond en bodemverbetering
  { productnaam: "Tuinaarde", categorie: "Grond", inkoopprijs: 22.00, verkoopprijs: 40.00, eenheid: "m³", leverancier: "De Beijer", verliespercentage: 10 },
  { productnaam: "Compost", categorie: "Grond", inkoopprijs: 18.00, verkoopprijs: 32.00, eenheid: "m³", leverancier: "De Beijer", verliespercentage: 10 },
  { productnaam: "Boomschors 10-40mm", categorie: "Grond", inkoopprijs: 45.00, verkoopprijs: 75.00, eenheid: "m³", leverancier: "De Beijer", verliespercentage: 5 },
  { productnaam: "Siersplit wit 8-16mm", categorie: "Grond", inkoopprijs: 65.00, verkoopprijs: 110.00, eenheid: "m³", leverancier: "De Beijer", verliespercentage: 5 },
  // Gras
  { productnaam: "Graszoden", categorie: "Gras", inkoopprijs: 3.50, verkoopprijs: 7.50, eenheid: "m²", leverancier: "Graszodenkwekerij", verliespercentage: 5 },
  { productnaam: "Graszaad siergazon", categorie: "Gras", inkoopprijs: 35.00, verkoopprijs: 60.00, eenheid: "kg", leverancier: "Barenbrug", verliespercentage: 10 },
  { productnaam: "Graszaad speelgazon", categorie: "Gras", inkoopprijs: 30.00, verkoopprijs: 50.00, eenheid: "kg", leverancier: "Barenbrug", verliespercentage: 10 },
  // Planten
  { productnaam: "Bodembedekker (pot 9cm)", categorie: "Planten", inkoopprijs: 1.50, verkoopprijs: 4.50, eenheid: "stuk", leverancier: "Kwekerij", verliespercentage: 5 },
  { productnaam: "Heester (3 liter)", categorie: "Planten", inkoopprijs: 8.00, verkoopprijs: 18.00, eenheid: "stuk", leverancier: "Kwekerij", verliespercentage: 5 },
  { productnaam: "Solitaire struik (10 liter)", categorie: "Planten", inkoopprijs: 25.00, verkoopprijs: 55.00, eenheid: "stuk", leverancier: "Kwekerij", verliespercentage: 3 },
  { productnaam: "Haagplant (60-80cm)", categorie: "Planten", inkoopprijs: 6.00, verkoopprijs: 14.00, eenheid: "stuk", leverancier: "Kwekerij", verliespercentage: 5 },
  // Elektra
  { productnaam: "Grondspot LED", categorie: "Elektra", inkoopprijs: 35.00, verkoopprijs: 75.00, eenheid: "stuk", leverancier: "Buitenverlichting.nl", verliespercentage: 2 },
  { productnaam: "Tuinlamp op paal LED", categorie: "Elektra", inkoopprijs: 85.00, verkoopprijs: 165.00, eenheid: "stuk", leverancier: "Buitenverlichting.nl", verliespercentage: 2 },
  { productnaam: "Kabel 3x1,5 grond", categorie: "Elektra", inkoopprijs: 1.50, verkoopprijs: 3.50, eenheid: "m", leverancier: "Elektrotechnisch", verliespercentage: 5 },
  { productnaam: "Lasdoos waterdicht", categorie: "Elektra", inkoopprijs: 4.50, verkoopprijs: 12.00, eenheid: "stuk", leverancier: "Elektrotechnisch", verliespercentage: 5 },
  // Afvoer
  { productnaam: "Afvoer grond (stort)", categorie: "Afvoer", inkoopprijs: 25.00, verkoopprijs: 35.00, eenheid: "m³", leverancier: "Stortplaats", verliespercentage: 0 },
  { productnaam: "Afvoer groenafval", categorie: "Afvoer", inkoopprijs: 15.00, verkoopprijs: 25.00, eenheid: "m³", leverancier: "Stortplaats", verliespercentage: 0 },
  { productnaam: "Afvoer puin", categorie: "Afvoer", inkoopprijs: 18.00, verkoopprijs: 28.00, eenheid: "m³", leverancier: "Stortplaats", verliespercentage: 0 },
] as const;

/**
 * Zet de standaard-inrichting klaar voor een organisatie: instellingen,
 * normuren en producten, allemaal met `orgId` gezet.
 *
 * Idempotent: bestaat er al een instellingen-rij voor deze organisatie, dan
 * gebeurt er niets. Dat is de vangnet-check voor de prod-migratie (fase 6/8),
 * waar bestaande gemigreerde data van een user al een orgId heeft gekregen —
 * die mag niet nóg een keer geseed worden.
 *
 * @returns true als er geseed is, false als de organisatie al ingericht was.
 */
export async function seedOrgDefaults(
  ctx: MutationCtx,
  orgId: Id<"organisaties">
): Promise<boolean> {
  const bestaandeInstellingen = await ctx.db
    .query("instellingen")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .first();
  if (bestaandeInstellingen) return false;

  await ctx.db.insert("instellingen", {
    orgId,
    ...standaardInstellingen(),
  });

  for (const normuur of DEFAULT_NORMUREN) {
    await ctx.db.insert("normuren", {
      orgId,
      ...normuur,
    });
  }

  const now = Date.now();
  for (const product of DEFAULT_PRODUCTEN) {
    await ctx.db.insert("producten", {
      orgId,
      ...product,
      isActief: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  return true;
}
