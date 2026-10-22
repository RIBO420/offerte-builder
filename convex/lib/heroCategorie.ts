/**
 * Categorie voor een HERO-artikel, afgeleid uit naam (en anders de
 * beschrijving). HERO kent zelf geen categorieën; deze indeling volgt het
 * werk van een hovenier. De volgorde van REGELS is de voorrang: de eerste
 * regel die past wint ("Afvoerkosten groenafval" is afvoer, geen onderhoud).
 * Een categorie mag meer regels hebben, op verschillende plekken in de rij.
 *
 * Puur en zonder imports, zodat het ook los te draaien is.
 */

export const HERO_CATEGORIEEN = [
  "Arbeid en uurtarieven",
  "Voorrijkosten en transport",
  "Afvoer",
  "Machines",
  "Tuinonderhoud en snoei",
  "Gazon",
  "Beplanting",
  "Bestrating en terras",
  "Hout, schutting en poort",
  "Water en verlichting",
  "Grondwerk en fundering",
  "Zand, grind en grond",
  "Tuinaanleg en renovatie",
  "Termijnen en betalingen",
  "Overig",
] as const;

export type HeroCategorie = (typeof HERO_CATEGORIEEN)[number];

const REGELS: ReadonlyArray<[HeroCategorie, RegExp]> = [
  ["Termijnen en betalingen", /termijn|aanbetaling|betaling|^factuur\b|restbedrag|resterend bedrag|\bvoorschot/],
  ["Arbeid en uurtarieven", /arbeid|uurtarief|per uur|regiebasis|manuren|\buren\b|medewerker|hovenier|vakman|mandag|dagdeel/],
  ["Voorrijkosten en transport", /voorr+ijkosten|voorrijden|reistijd|transport|aanvoerkosten|\bkilometer|\bkm\b/],
  ["Afvoer", /afvoer|container|\bstort|disposal|green waste|groenafval/],
  ["Machines", /machinekosten|minigraver|graafmachine|hoogwerker|shovel|dumper|kraan|\bhuur\b|materieel|brandstof/],
  ["Tuinonderhoud en snoei", /onderhoud|maintenance|snoei|pruning|onkruid(?!werend)|wieden|maaien|knippen|trimming|periodiek|beurt|inkorten|blad ?ruimen|reinig|hogedruk|pressure wash|cleaning/],
  ["Gazon", /gazon|graszode|graszaad|kunstgras|\bgras\b|sport ?(&|en) ?play|\blawn|\bturf/],
  ["Beplanting", /beplanting|plant|prunus|leiboom|leibomen|\bboom|bomen|heester|haag|hedge|lusitanica|angustifolia|border|taxus|buxus|bloembol|conifeer|liguster|laurier|\brosa\b|rozen/],
  ["Bestrating en terras", /bestrating|terras|tegel|klinker|opsluit|oprit|natuursteen|keramisch|straat|stoep|traptrede|tuinpad|looppad|sierpad|waaltje|keerwand|l-element|voeg/],
  ["Hout, schutting en poort", /schutting|houtwerk|\bhout|poort|erfafscheiding|vlonder|pergola|composiet|tuinpaal|palen|plank|overkapping|hekwerk|\bhek\b|tuinscherm|douglas|lariks|grenen/],
  ["Water en verlichting", /verlichting|lamp|grondspot|spots?\b|elektra|kabel|stroom|12 ?v\b|lightpro|beregening|sproei|vijver|water|drainage|\bput\b|kolk|riolering/],
  ["Grondwerk en fundering", /grondwerk|fundering|ontgrav|uitgrav|egalis|ondergrond|frezen|spitten|ophogen|afgraven/],
  ["Zand, grind en grond", /grind|split|zand|tuingrond|teelaarde|potgrond|\bgrond|boomschors|schors|compost|bodemverbeter|korrelmix|ardenner|breuksteen|keien|kiezel|lava|mulch|big ?bag/],
  ["Tuinonderhoud en snoei", /bemesting|bemesten|mest\b/],
  // Plantnamen zonder trefwoord: cultivar tussen aanhalingstekens, potmaat of maat in cm
  ["Beplanting", /[‘'’"].+[‘'’"]|potmaat|\bp\d{1,2}\b|±\s?\d+\s?(\/\d+)?\s?(cm|meter)|bloemen|mengsel|vaste planten|\d+\s?[-–—]\s?\d+\s?cm|carpinus|fagus|thuja|berberis|wisteria|quercus|querqus|miscanthus|hydrangea|viburnum|salvia|geranium|lavendel|lavandula|acer|betula|malus|pyrus|ilex|hosta/],
  ["Tuinaanleg en renovatie", /tuinaanleg|tuinrenovatie|renovatie|herinrichting|aanleg|tuinontwerp|ontwerp|complete tuin|leeghalen/],
  ["Arbeid en uurtarieven", /werkzaamheden|op afroep/],
];

function zoek(tekst: string): HeroCategorie | undefined {
  const schoon = tekst.toLowerCase();
  for (const [categorie, patroon] of REGELS) {
    if (patroon.test(schoon)) return categorie;
  }
  return undefined;
}

export function categorieUitHero(naam: string, beschrijving?: string): HeroCategorie {
  return zoek(naam) ?? (beschrijving ? zoek(beschrijving) : undefined) ?? "Overig";
}

const ENTITEITEN: Record<string, string> = {
  "&amp;": "&",
  "&#039;": "'",
  "&#39;": "'",
  "&apos;": "'",
  "&quot;": '"',
  "&lt;": "<",
  "&gt;": ">",
  "&nbsp;": " ",
};

/** HERO exporteert tekst met HTML-entiteiten ("&#039;", "&amp;"): terug naar gewone tekens. */
export function schoonHeroTekst(tekst: string): string {
  return tekst
    .replace(/&(amp|#0?39|apos|quot|lt|gt|nbsp);/g, (m) => ENTITEITEN[m] ?? m)
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .trim();
}
