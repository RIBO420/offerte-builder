/**
 * De normbron — en de kruiscontrole die S3 uit de eindschouw dichttimmert.
 *
 * Bevinding S3 (15 aug 2026): dezelfde offerte (Grondwerk, 50 m², diepte
 * "standaard") gaf 12,50 uur op het werkblad en 11,25 uur in de
 * voorcalculatie. Twee engines, twee antwoorden, één klant.
 *
 * Deze suite bewaakt drie dingen:
 * 1. de definitie zelf (wat telt mee als normuur, en wat niet);
 * 2. de kruiscontrole: de werkblad-kant (`calculateTotals`) en de
 *    voorcalculatie-kant (`normurenUitRegels`, wat `voorcalculaties.calculate`
 *    doet) geven op dezelfde invoer hetzelfde getal;
 * 3. het scenario uit de eindschouw zelf, met de échte seed-normuren en
 *    -correctiefactoren, zodat 11,25 niet ongemerkt terug kan komen.
 */

import { describe, it, expect } from "vitest";
import {
  NORMUUR_EENHEID,
  afrondenOpKwartier,
  geschatteWerkdagen,
  isNormuurRegel,
  normurenTotaal,
  normurenUitRegels,
  type NormuurBronRegel,
} from "@convex/lib/normuren";
import {
  calculateOfferteRegels,
  calculateTotals,
  type CalculationContext,
  type OfferteRegel,
} from "@/lib/offerte-calculator";
import type { Bereikbaarheid } from "@/types/offerte";

// ---------------------------------------------------------------------------
// Fixtures: exact de waarden die `convex/normuren.ts` en
// `convex/correctiefactoren.ts` seeden. Wijken die af, dan wijkt deze test af.
// ---------------------------------------------------------------------------

function seedNormuren(): CalculationContext["normuren"] {
  return ([
    { activiteit: "Ontgraven licht", scope: "grondwerk", normuurPerEenheid: 0.15, eenheid: "m²" },
    { activiteit: "Ontgraven standaard", scope: "grondwerk", normuurPerEenheid: 0.25, eenheid: "m²" },
    { activiteit: "Ontgraven zwaar", scope: "grondwerk", normuurPerEenheid: 0.4, eenheid: "m²" },
    { activiteit: "Grond afvoeren", scope: "grondwerk", normuurPerEenheid: 0.1, eenheid: "m³" },
    { activiteit: "Tegels leggen", scope: "bestrating", normuurPerEenheid: 0.4, eenheid: "m²" },
    { activiteit: "Zandbed aanbrengen", scope: "bestrating", normuurPerEenheid: 0.1, eenheid: "m²" },
    { activiteit: "Grondbewerking", scope: "borders", normuurPerEenheid: 0.2, eenheid: "m²" },
    { activiteit: "Planten gemiddeld", scope: "borders", normuurPerEenheid: 0.25, eenheid: "m²" },
    { activiteit: "Graszoden leggen", scope: "gras", normuurPerEenheid: 0.12, eenheid: "m²" },
    { activiteit: "Ondergrond voorbereiden", scope: "gras", normuurPerEenheid: 0.08, eenheid: "m²" },
  ] as const).map((n, i) => ({ ...n, _id: `normuur-${i}` }));
}

function seedFactoren(): CalculationContext["correctiefactoren"] {
  return ([
    { type: "bereikbaarheid", waarde: "goed", factor: 1.0 },
    { type: "bereikbaarheid", waarde: "beperkt", factor: 1.2 },
    { type: "bereikbaarheid", waarde: "slecht", factor: 1.5 },
    { type: "achterstalligheid", waarde: "laag", factor: 1.0 },
    { type: "achterstalligheid", waarde: "gemiddeld", factor: 1.3 },
    { type: "achterstalligheid", waarde: "hoog", factor: 1.6 },
    // Precies de val uit S3: de diepte zit al ín de gekozen normuur, dus deze
    // factor mag er niet nóg een keer overheen.
    { type: "diepte", waarde: "licht", factor: 1.0 },
    { type: "diepte", waarde: "standaard", factor: 1.5 },
    { type: "diepte", waarde: "zwaar", factor: 2.0 },
    { type: "snijwerk", waarde: "laag", factor: 1.0 },
    { type: "snijwerk", waarde: "gemiddeld", factor: 1.1 },
    { type: "snijwerk", waarde: "hoog", factor: 1.3 },
    { type: "intensiteit", waarde: "weinig", factor: 0.8 },
    { type: "intensiteit", waarde: "gemiddeld", factor: 1.0 },
    { type: "intensiteit", waarde: "veel", factor: 1.3 },
  ] as const).map((f, i) => ({ ...f, _id: `factor-${i}` }));
}

function context(bereikbaarheid: Bereikbaarheid = "goed"): CalculationContext {
  return {
    normuren: seedNormuren(),
    correctiefactoren: seedFactoren(),
    producten: [],
    instellingen: {
      uurtarief: 45,
      standaardMargePercentage: 20,
      btwPercentage: 21,
    },
    bereikbaarheid,
  };
}

/**
 * De regels van een offerte, zoals het werkblad ze maakt. Beide paden in de
 * kruiscontrole vertrekken hiervandaan — dat is precies het punt.
 */
function offerteRegels(
  scopes: string[],
  scopeData: Record<string, unknown>,
  bereikbaarheid: Bereikbaarheid = "goed"
): OfferteRegel[] {
  return calculateOfferteRegels(
    { type: "aanleg", scopes, scopeData, bereikbaarheid },
    context(bereikbaarheid)
  );
}

function regel(over: Partial<NormuurBronRegel> = {}): NormuurBronRegel {
  return {
    scope: over.scope ?? "grondwerk",
    type: over.type ?? "arbeid",
    eenheid: over.eenheid ?? "uur",
    hoeveelheid: over.hoeveelheid ?? 1,
  };
}

/** Hoe de voorcalculatie-query rekent: alleen optellen, niets herrekenen. */
function voorcalculatiePad(regels: OfferteRegel[], scopes: string[]) {
  return normurenUitRegels(regels, scopes);
}

/** Hoe het werkblad rekent: het urentotaal uit `calculateTotals`. */
function werkbladPad(regels: OfferteRegel[]) {
  return calculateTotals(regels, 20, 21).totaalUren;
}

// ---------------------------------------------------------------------------

describe("de definitie", () => {
  it("telt alleen arbeidsregels die in uren staan", () => {
    expect(isNormuurRegel(regel())).toBe(true);
    expect(isNormuurRegel(regel({ type: "materiaal" }))).toBe(false);
    expect(isNormuurRegel(regel({ type: "machine" }))).toBe(false);
    // Arbeid, maar geen tijd: catalogusbeurt, boominspectie, overhead, p.m.
    expect(isNormuurRegel(regel({ eenheid: "beurt" }))).toBe(false);
    expect(isNormuurRegel(regel({ eenheid: "boom" }))).toBe(false);
    expect(isNormuurRegel(regel({ eenheid: "vast" }))).toBe(false);
    expect(isNormuurRegel(regel({ eenheid: "p.m." }))).toBe(false);
  });

  it("noemt de eenheid die telt bij naam", () => {
    expect(NORMUUR_EENHEID).toBe("uur");
  });

  it("negeert onvolledige of onzinnige hoeveelheden in plaats van te crashen", () => {
    expect(isNormuurRegel(regel({ hoeveelheid: Number.NaN }))).toBe(false);
    expect(normurenUitRegels(undefined).normUrenTotaal).toBe(0);
    expect(normurenUitRegels(null).normUrenTotaal).toBe(0);
    expect(normurenUitRegels([]).normUrenTotaal).toBe(0);
  });

  it("groepeert per scope en rondt af op een kwartier", () => {
    const uitkomst = normurenUitRegels([
      regel({ scope: "grondwerk", hoeveelheid: 12.5 }),
      regel({ scope: "bestrating", hoeveelheid: 4.1 }),
      regel({ scope: "bestrating", hoeveelheid: 0.9 }),
    ]);

    expect(uitkomst.normUrenPerScope).toEqual({
      grondwerk: 12.5,
      bestrating: 5,
    });
    expect(uitkomst.normUrenTotaal).toBe(17.5);
  });

  it("laat de delen optellen tot het geheel", () => {
    const uitkomst = normurenUitRegels([
      regel({ scope: "a", hoeveelheid: 1.13 }),
      regel({ scope: "b", hoeveelheid: 2.37 }),
      regel({ scope: "c", hoeveelheid: 0.4 }),
    ]);
    const som = Object.values(uitkomst.normUrenPerScope).reduce(
      (a, b) => a + b,
      0
    );
    expect(uitkomst.normUrenTotaal).toBe(afrondenOpKwartier(som));
  });

  it("geeft scopes zonder urenregel een expliciete nul", () => {
    const uitkomst = normurenUitRegels(
      [regel({ scope: "grondwerk", hoeveelheid: 3 })],
      ["grondwerk", "gras"]
    );
    // Een ontbrekende sleutel zou als "onbekend" lezen; nul uur is een antwoord.
    expect(uitkomst.normUrenPerScope.gras).toBe(0);
  });

  it("rekent uren naar werkdagen, altijd naar boven", () => {
    expect(geschatteWerkdagen(56, 2, 7)).toBe(4);
    expect(geschatteWerkdagen(11.25, 2, 7)).toBe(1);
    expect(geschatteWerkdagen(15, 2, 7)).toBe(2);
    // Geen team, geen dagen — en zeker geen deling door nul.
    expect(geschatteWerkdagen(20, 0, 7)).toBe(0);
  });
});

// ---------------------------------------------------------------------------

describe("kruiscontrole werkblad ↔ voorcalculatie", () => {
  const gevallen: Array<{
    naam: string;
    scopes: string[];
    scopeData: Record<string, unknown>;
    bereikbaarheid?: Bereikbaarheid;
  }> = [
    {
      naam: "S3 uit de eindschouw: grondwerk 50 m², diepte standaard",
      scopes: ["grondwerk"],
      scopeData: { grondwerk: { oppervlakte: 50, diepte: "standaard" } },
    },
    {
      naam: "grondwerk met afvoer",
      scopes: ["grondwerk"],
      scopeData: {
        grondwerk: { oppervlakte: 80, diepte: "zwaar", afvoerGrond: true },
      },
    },
    {
      naam: "bestrating met snijwerk",
      scopes: ["bestrating"],
      scopeData: {
        bestrating: {
          oppervlakte: 35,
          typeBestrating: "tegel",
          snijwerk: "hoog",
          onderbouw: { dikteOnderlaag: 20 },
        },
      },
    },
    {
      naam: "meerdere scopes, slecht bereikbaar",
      scopes: ["grondwerk", "borders", "gras"],
      scopeData: {
        grondwerk: { oppervlakte: 65, diepte: "standaard" },
        borders: { oppervlakte: 18, beplantingsintensiteit: "gemiddeld" },
        gras: { oppervlakte: 90, type: "graszoden" },
      },
      bereikbaarheid: "slecht",
    },
    {
      naam: "lege offerte",
      scopes: [],
      scopeData: {},
    },
  ];

  for (const geval of gevallen) {
    it(`geeft hetzelfde aantal uren — ${geval.naam}`, () => {
      const regels = offerteRegels(
        geval.scopes,
        geval.scopeData,
        geval.bereikbaarheid
      );

      const werkblad = werkbladPad(regels);
      const voorcalculatie = voorcalculatiePad(regels, geval.scopes);

      expect(voorcalculatie.normUrenTotaal).toBe(werkblad);
    });
  }

  it("houdt stand als er handmatig een regel bij komt", () => {
    const regels = offerteRegels(["grondwerk"], {
      grondwerk: { oppervlakte: 50, diepte: "standaard" },
    });
    const metExtra: OfferteRegel[] = [
      ...regels,
      {
        id: "handmatig",
        scope: "grondwerk",
        omschrijving: "Extra handwerk rond de put",
        eenheid: "uur",
        hoeveelheid: 3.5,
        prijsPerEenheid: 45,
        totaal: 157.5,
        type: "arbeid",
      },
    ];

    expect(voorcalculatiePad(metExtra, ["grondwerk"]).normUrenTotaal).toBe(
      werkbladPad(metExtra)
    );
  });

  it("telt een contractbeurt aan geen van beide kanten als uur", () => {
    // De onderhoudscatalogus boekt `type: "arbeid"` in de eenheid "beurt";
    // die hoeveelheid is een frequentie, geen tijd.
    const regels: OfferteRegel[] = [
      {
        id: "uur",
        scope: "gras",
        omschrijving: "Gazon maaien",
        eenheid: "uur",
        hoeveelheid: 6,
        prijsPerEenheid: 45,
        totaal: 270,
        type: "arbeid",
      },
      {
        id: "beurt",
        scope: "gras",
        omschrijving: "Gazon maaien (contract)",
        eenheid: "beurt",
        hoeveelheid: 26,
        prijsPerEenheid: 35,
        totaal: 910,
        type: "arbeid",
      },
    ];

    expect(werkbladPad(regels)).toBe(6);
    expect(voorcalculatiePad(regels, ["gras"]).normUrenTotaal).toBe(6);
  });

  it("laat de losse helper hetzelfde totaal geven als de volledige uitkomst", () => {
    const regels = offerteRegels(["grondwerk", "gras"], {
      grondwerk: { oppervlakte: 40, diepte: "licht" },
      gras: { oppervlakte: 120, type: "graszoden" },
    });
    expect(normurenTotaal(regels)).toBe(
      normurenUitRegels(regels).normUrenTotaal
    );
  });
});

// ---------------------------------------------------------------------------

describe("het getal uit de eindschouw", () => {
  const scopeData = { grondwerk: { oppervlakte: 50, diepte: "standaard" } };

  it("staat op 12,50 uur — de normuur die bij de diepte hoort", () => {
    const regels = offerteRegels(["grondwerk"], scopeData);

    // 50 m² × 0,25 u/m² ("Ontgraven standaard"), zonder extra diepte-factor.
    expect(werkbladPad(regels)).toBe(12.5);
    expect(
      voorcalculatiePad(regels, ["grondwerk"]).normUrenPerScope.grondwerk
    ).toBe(12.5);
  });

  it("komt nooit meer op 11,25 uur uit", () => {
    // 11,25 was 50 × 0,15 ("Ontgraven licht", de eerste normuur waarvan de
    // naam "ontgraven" bevatte) × 1,5 (diepte-factor bovenop de normuur).
    const regels = offerteRegels(["grondwerk"], scopeData);
    expect(voorcalculatiePad(regels, ["grondwerk"]).normUrenTotaal).not.toBe(
      11.25
    );
  });

  it("houdt bereikbaarheid één keer aangebracht", () => {
    // De factor zit in de regels; de voorcalculatie mag hem niet nóg eens
    // toepassen. 50 × 0,25 × 1,5 = 18,75.
    const regels = offerteRegels(["grondwerk"], scopeData, "slecht");
    expect(voorcalculatiePad(regels, ["grondwerk"]).normUrenTotaal).toBe(18.75);
    expect(werkbladPad(regels)).toBe(18.75);
  });
});
