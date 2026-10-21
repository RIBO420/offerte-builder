/**
 * Startinhoud van de tekstbibliotheek: de vaste set uit
 * docs/hero-nabouw/documenten/standaardteksten.md (deel C), omgezet naar de
 * placeholders van convex/lib/documentTekst.ts.
 *
 * Dit is een vertrekpunt: de klant past de teksten daarna zelf aan onder
 * Instellingen → Tekstblokken. "Standaardteksten laden" voegt alleen toe wat
 * voor een soort nog ontbreekt en overschrijft nooit iets.
 */

import type { DocumentSoort } from "./documentTekst";

export interface StandaardTekst {
  documentSoort: DocumentSoort;
  positie: "inleiding" | "afsluiting";
  naam: string;
  inhoud: string;
  /** false = extra keuze naast de standaard (bv. prijsaanvraag, K9) */
  standaard?: false;
}

const OFFERTE_INLEIDING = `Beste {{klant.naam}},

Hartelijk dank voor uw offerteaanvraag. Hieronder vindt u onze vrijblijvende offerte en meer informatie over hoe wij te werk gaan.`;

const offerteAfsluiting = (betaalblok: string) => `Bovenstaande prijzen zijn geldig tot {{offerte.geldigTot}}. Wij hebben er alles aan gedaan om uw wensen en verwachtingen zo goed mogelijk in deze offerte te verwerken. Neem gerust de tijd om alles door te nemen. Schiet u later nog iets te binnen, dan passen wij de offerte graag voor u aan, zodat het voorstel helemaal aansluit bij uw wensen.

Wij hopen dat deze offerte een duidelijk beeld geeft van wat wij voor u kunnen betekenen en kijken ernaar uit om samen aan de slag te gaan.

Met groene groet,

{{medewerker.naam}}

Belangrijke informatie

Neem dit even rustig door. Deze informatie is belangrijk om goed op de hoogte te zijn van onze werkwijze, betaling en planning. Zo zijn er geen verrassingen en is alles duidelijk vóór de start van het project.

Let op: dit is een beknopt overzicht van onze werkwijze. Onze algemene voorwaarden zijn als bijlage meegestuurd en maken deel uit van onze samenwerking.

Offerte en geldigheid
- Deze offerte is geldig tot {{offerte.geldigTot}}.
- Gaat u akkoord? Bevestig dit dan schriftelijk of per e-mail via {{bedrijf.email}}.

${betaalblok}

Planning en weersomstandigheden
- De werkzaamheden worden ingepland onder voorbehoud van gunstige weersomstandigheden.
- Bij onwerkbaar weer behouden wij ons het recht voor de werkzaamheden te verplaatsen naar een later, passend moment.

Bereikbaarheid en voorzieningen op locatie
- Wij vragen u te zorgen voor parkeergelegenheid direct bij de woning en een plek om materialen te lossen en tijdelijk op te slaan. Is dat niet mogelijk, neem dan vooraf contact met ons op.
- Wij gaan ervan uit dat de locatie goed bereikbaar is voor personeel en machines, en dat er water, elektriciteit en sanitaire voorzieningen beschikbaar zijn. Is dat niet zo, stem dit dan vooraf met ons af, zodat we samen een oplossing vinden.

Aansprakelijkheid
- {{bedrijf.naam}} is verzekerd voor aansprakelijkheid volgens de geldende richtlijnen in de hoveniersbranche.
- Schadeclaims kunnen alleen in behandeling worden genomen als ze binnen 48 uur na oplevering schriftelijk bij ons zijn gemeld.

Vragen of opmerkingen?
Neem gerust contact met ons op via {{bedrijf.telefoon}} of {{bedrijf.email}}. Wij staan u graag te woord.`;

const PRIJSAFSPRAKEN = `Prijsafspraken
- Staan er in de offerte geen uurtarieven vermeld, dan voeren wij de werkzaamheden uit tegen vaste prijzen.
- Deze prijzen blijven ongewijzigd, ook als de uitvoering langer of korter duurt dan ingeschat.
- Facturen worden per e-mail verzonden en dienen binnen {{bedrijf.betaaltermijn}} dagen na factuurdatum te worden voldaan, tenzij schriftelijk een andere termijn is afgesproken.`;

const FACTUUR_AFSLUITING = `Wij verzoeken u het factuurbedrag van {{document.bedrag}} uiterlijk {{factuur.vervaldatum}} over te maken op {{bedrijf.iban}} t.n.v. {{bedrijf.naam}}, onder vermelding van factuurnummer {{document.nummer}}.

Hartelijk dank voor uw opdracht en het vertrouwen.

Vragen of opmerkingen? Neem gerust contact met ons op via {{bedrijf.telefoon}} of {{bedrijf.email}}.

Met groene groet,

{{medewerker.naam}}`;

export const STANDAARDTEKSTEN: readonly StandaardTekst[] = [
  {
    documentSoort: "offerte_aanleg",
    positie: "inleiding",
    naam: "Offerte aanleg – inleiding",
    inhoud: OFFERTE_INLEIDING,
  },
  {
    documentSoort: "offerte_aanleg",
    positie: "afsluiting",
    naam: "Offerte aanleg – afsluiting",
    inhoud: offerteAfsluiting(
      `${PRIJSAFSPRAKEN}

Aanbetaling en betalingstermijnen
Voor tuinaanleg hanteren wij de volgende betalingstermijnen:
{{offerte.termijnschema}}`
    ),
  },
  {
    documentSoort: "offerte_onderhoud",
    positie: "inleiding",
    naam: "Offerte onderhoud – inleiding",
    inhoud: OFFERTE_INLEIDING,
  },
  {
    documentSoort: "offerte_onderhoud",
    positie: "afsluiting",
    naam: "Offerte onderhoud – afsluiting",
    inhoud: offerteAfsluiting(
      `${PRIJSAFSPRAKEN}
- Voor onderhoudswerkzaamheden en kleinere opdrachten is geen aanbetaling vereist, tenzij dit vooraf anders met u is afgesproken.`
    ),
  },
  {
    documentSoort: "factuur",
    positie: "inleiding",
    naam: "Factuur aanleg – inleiding",
    inhoud: `Beste {{klant.naam}},

Hartelijk dank voor uw vertrouwen en uw opdracht. Wij hebben met plezier de onderstaande werkzaamheden uitgevoerd en, waar nodig zoals in de offerte aangegeven, machines of materialen geleverd. Hiervoor ontvangt u hierbij de factuur.`,
  },
  {
    documentSoort: "factuur",
    positie: "afsluiting",
    naam: "Factuur aanleg – afsluiting",
    inhoud: FACTUUR_AFSLUITING,
  },
  {
    documentSoort: "factuur_onderhoud",
    positie: "inleiding",
    naam: "Factuur onderhoud – inleiding",
    inhoud: `Beste {{klant.naam}},

Hartelijk dank voor uw vertrouwen en uw opdracht. Wij hebben met plezier de onderstaande onderhoudswerkzaamheden voor u uitgevoerd. Hiervoor ontvangt u hierbij de factuur.`,
  },
  {
    documentSoort: "factuur_onderhoud",
    positie: "afsluiting",
    naam: "Factuur onderhoud – afsluiting",
    inhoud: FACTUUR_AFSLUITING,
  },
  {
    documentSoort: "termijnfactuur",
    positie: "inleiding",
    naam: "Termijnfactuur – inleiding",
    inhoud: `Beste {{klant.naam}},

Zoals afgesproken in onze offerte {{factuur.referentie}} ontvangt u hierbij de factuur voor {{termijn.omschrijving}} ({{termijn.percentage}}% van het offertebedrag).`,
  },
  {
    documentSoort: "termijnfactuur",
    positie: "afsluiting",
    naam: "Termijnfactuur – afsluiting",
    inhoud: FACTUUR_AFSLUITING,
  },
  {
    documentSoort: "eindfactuur",
    positie: "inleiding",
    naam: "Eindfactuur – inleiding",
    inhoud: `Beste {{klant.naam}},

Hartelijk dank voor uw opdracht. Hierbij ontvangt u de eindfactuur voor de werkzaamheden uit offerte {{factuur.referentie}}. De eerder gefactureerde termijnen zijn hierop in mindering gebracht.`,
  },
  {
    documentSoort: "eindfactuur",
    positie: "afsluiting",
    naam: "Eindfactuur – afsluiting",
    inhoud: FACTUUR_AFSLUITING,
  },
  {
    documentSoort: "creditnota",
    positie: "inleiding",
    naam: "Creditfactuur – inleiding",
    inhoud: `Beste {{klant.naam}},

Zoals afgesproken ontvangt u hierbij de creditfactuur voor onze factuur {{factuur.referentie}}.`,
  },
  {
    documentSoort: "creditnota",
    positie: "afsluiting",
    naam: "Creditfactuur – afsluiting",
    inhoud: `Het bedrag van {{document.bedrag}} wordt binnen {{bedrijf.betaaltermijn}} dagen aan u terugbetaald of verrekend met uw openstaande factuur.

Met groene groet,

{{medewerker.naam}}`,
  },
  {
    documentSoort: "orderbevestiging",
    positie: "inleiding",
    naam: "Orderbevestiging – inleiding",
    inhoud: `Beste {{klant.naam}},

Hartelijk dank voor uw opdracht en het vertrouwen dat u in ons stelt. Conform onze offerte {{document.referentie}} leveren wij de volgende diensten en/of producten:`,
  },
  {
    documentSoort: "orderbevestiging",
    positie: "afsluiting",
    naam: "Orderbevestiging – afsluiting",
    inhoud: `Wij zorgen voor een zorgvuldige afhandeling en kijken ernaar uit om samen aan de slag te gaan. Gaat u akkoord met deze orderbevestiging? Onderteken deze dan en stuur hem per e-mail of post aan ons terug.

Met groene groet,

{{medewerker.naam}}

________________________        ___________________________
Plaats / datum                  Uw handtekening`,
  },
  {
    documentSoort: "bestelformulier",
    positie: "inleiding",
    naam: "Bestelformulier – bestellen",
    inhoud: `Geachte heer/mevrouw,

Graag bestellen wij bij u de onderstaande artikelen. Wilt u de bestelling en de leverdatum aan ons bevestigen via {{bedrijf.email}}?`,
  },
  {
    documentSoort: "bestelformulier",
    positie: "inleiding",
    naam: "Bestelformulier – prijsaanvraag",
    standaard: false,
    inhoud: `Geachte heer/mevrouw,

Graag ontvangen wij van u een vrijblijvende prijsopgave voor de onderstaande artikelen.`,
  },
  {
    documentSoort: "bestelformulier",
    positie: "afsluiting",
    naam: "Bestelformulier – afsluiting",
    inhoud: `Met vriendelijke groet,

{{medewerker.naam}}
{{bedrijf.naam}}`,
  },
  {
    documentSoort: "leveringsbon",
    positie: "inleiding",
    naam: "Leveringsbon – inleiding",
    inhoud: `Beste {{klant.naam}},

Zoals afgesproken leveren wij de volgende goederen bij u af:`,
  },
  {
    documentSoort: "leveringsbon",
    positie: "afsluiting",
    naam: "Leveringsbon – afsluiting",
    inhoud: `Hierbij bevestig ik dat de goederen correct zijn ontvangen.

__________________________________________________
Datum, naam en handtekening`,
  },
];
