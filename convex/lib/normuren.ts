/**
 * De normbron — de enige plek waar "hoeveel uur kost dit werk?" beantwoord wordt.
 *
 * ## Waarom dit bestand er is
 *
 * Tot 15 aug 2026 rekenden het werkblad en de voorcalculatie langs twee paden.
 * Op één en dezelfde offerte (Grondwerk, 50 m², diepte "standaard") gaf het
 * werkblad 12,50 uur en de voorcalculatie 11,25 uur:
 *
 * - Het werkblad (`src/lib/offerte-calculator.ts`) zoekt de normuur die bij de
 *   gekozen diepte hoort — "Ontgraven standaard", 0,25 u/m² — en past géén
 *   extra diepte-factor toe: de diepte zit al in de gekozen normuur.
 *   → 50 × 0,25 = 12,50 uur.
 * - De voorcalculatie pakte de éérste normuur waarvan de naam "ontgraven"
 *   bevatte — dat is "Ontgraven licht", 0,15 u/m² — en vermenigvuldigde die
 *   daarna alsnog met de correctiefactor `diepte/standaard` (1,5).
 *   → 50 × 0,15 × 1,5 = 11,25 uur.
 *
 * Twee fouten tegelijk dus: de verkeerde normuur (naam-`includes` zonder
 * diepte) én diepte twee keer gemodelleerd. Het verschil was geen afronding,
 * het waren twee engines die uit elkaar gegroeid waren — er stonden zelfs drie
 * kopieën van die tweede engine (`convex/voorcalculaties.ts`,
 * `src/lib/voorcalculatie-calculator.ts`, en het switch-blok in de query).
 *
 * ## De definitie die geldt
 *
 * > **De normuren van een offerte zijn de arbeidsuren die als regel op die
 * > offerte staan.**
 *
 * Concreet: elke offerteregel met `type: "arbeid"` **én** `eenheid: "uur"`
 * telt mee met zijn `hoeveelheid`, gegroepeerd op `scope` en per scope
 * afgerond op een kwartier. Het totaal is de som van die afgeronde scopes,
 * zodat de delen optellen tot het geheel.
 *
 * Waarom de regels en niet de scopeData? Omdat de regels zijn wát er verkocht
 * wordt: ze staan op de offerte, in de pdf en op de factuur. Elke andere bron
 * kan daarvan afwijken; de regels kunnen dat per definitie niet. De
 * correctiefactoren (bereikbaarheid, achterstalligheid, snijwerk, diepte)
 * zitten al ín die uren verwerkt — `calculateOfferteRegels` past ze toe bij het
 * maken van de regel. Ze mogen er dus **niet** nog een keer overheen.
 *
 * Waarom `eenheid: "uur"` erbij? Niet elke arbeidsregel is een urenregel: de
 * onderhoudscatalogus rekent in "beurt", boominspectie in "boom", de
 * offerte-overhead in "vast" en een p.m.-post in "p.m.". Die hoeveelheden zijn
 * geen uren en horen dus niet in een urentotaal.
 *
 * Wie deze definitie gebruikt:
 * - `calculateTotals` in `src/lib/offerte-calculator.ts` → `totaalUren` in het
 *   palet van de werkbank.
 * - `voorcalculaties.calculate` in `convex/voorcalculaties.ts` → de
 *   voorcalculatie-pagina en het opgeslagen `normUrenTotaal`.
 *
 * De kruiscontrole staat in `src/__tests__/unit/normuren.test.ts`.
 */

/** De eenheid die een arbeidsregel tot urenregel maakt. */
export const NORMUUR_EENHEID = "uur";

/**
 * Het minimum dat een regel moet hebben om als normuur mee te kunnen tellen.
 * Bewust smaller dan `OfferteRegel`: deze module wordt ook gevoed vanuit
 * Convex, waar `regels` uit de database komt.
 */
export interface NormuurBronRegel {
  scope: string;
  type: "materiaal" | "arbeid" | "machine";
  eenheid: string;
  hoeveelheid: number;
}

export interface NormurenUitkomst {
  /** Uren per scope, elk afgerond op een kwartier. */
  normUrenPerScope: Record<string, number>;
  /** De som van `normUrenPerScope` — de delen tellen op tot het geheel. */
  normUrenTotaal: number;
}

/**
 * Uren worden in kwartieren geboekt, niet in seconden. `createArbeidsRegel`
 * rondt al zo af; handmatig bijgestelde regels worden hier gelijkgetrokken.
 */
export function afrondenOpKwartier(uren: number): number {
  if (!Number.isFinite(uren)) return 0;
  return Math.round(uren * 4) / 4;
}

/** Telt deze regel mee als normuur? Zie de definitie boven in dit bestand. */
export function isNormuurRegel(regel: {
  type?: string;
  eenheid?: string;
  hoeveelheid?: number;
}): boolean {
  return (
    regel.type === "arbeid" &&
    regel.eenheid === NORMUUR_EENHEID &&
    typeof regel.hoeveelheid === "number" &&
    Number.isFinite(regel.hoeveelheid)
  );
}

/**
 * De normuren van een offerte, uit haar eigen regels.
 *
 * @param regels  De offerteregels. Alles wat geen urenregel is wordt genegeerd.
 * @param scopes  De scopes van de offerte. Scopes zonder urenregel komen als
 *                `0` in de uitkomst te staan — "nul uur" is een antwoord,
 *                een ontbrekende sleutel is dat niet.
 */
export function normurenUitRegels(
  regels: readonly NormuurBronRegel[] | undefined | null,
  scopes: readonly string[] = []
): NormurenUitkomst {
  const ruwPerScope = new Map<string, number>();
  for (const scope of scopes) ruwPerScope.set(scope, 0);

  for (const regel of regels ?? []) {
    if (!isNormuurRegel(regel)) continue;
    const scope = regel.scope || "overig";
    ruwPerScope.set(scope, (ruwPerScope.get(scope) ?? 0) + regel.hoeveelheid);
  }

  const normUrenPerScope: Record<string, number> = {};
  let normUrenTotaal = 0;
  for (const [scope, uren] of ruwPerScope) {
    const afgerond = afrondenOpKwartier(uren);
    normUrenPerScope[scope] = afgerond;
    normUrenTotaal += afgerond;
  }

  return {
    normUrenPerScope,
    // Kwartieren optellen geeft weer een kwartier; het afronden hier vangt
    // alleen de drijvende-komma-ruis van de optelling af.
    normUrenTotaal: afrondenOpKwartier(normUrenTotaal),
  };
}

/** Alleen het totaal — voor wie de verdeling per scope niet nodig heeft. */
export function normurenTotaal(
  regels: readonly NormuurBronRegel[] | undefined | null
): number {
  return normurenUitRegels(regels).normUrenTotaal;
}

/**
 * Hoeveel werkdagen kost dit met dit team?
 *
 * Naar boven afgerond: een halve dag inplannen bestaat niet in de weekplanning.
 */
export function geschatteWerkdagen(
  normUrenTotaal: number,
  teamGrootte: number,
  effectieveUrenPerDag: number
): number {
  const capaciteitPerDag = teamGrootte * effectieveUrenPerDag;
  if (!Number.isFinite(capaciteitPerDag) || capaciteitPerDag <= 0) return 0;
  return Math.ceil(normUrenTotaal / capaciteitPerDag);
}
