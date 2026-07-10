/**
 * Unit tests vrije offerte-builder (route 2, PRD §2.5b + §8.11 twee-routes-test)
 *
 * Test de pure doorrekening uit convex/vrijeOfferteBerekening.ts:
 * - Margefactor conform PRD: 1 ÷ (1 − marge); 30% → ×1,43, 40% → ×1,67,
 *   en het verschil met 40% opslag óp inkoop (= maar 28,6% marge)
 * - Marge ↔ verkoopprijs, beide kanten op
 * - Infinity%-verbod: geen marge-berekening op prijs-op-regel en €0-inkoop
 * - Regeltotaal met korting per regel; korting op totaal (naar rato in de btw)
 * - Hoofdstukken met subtotalen
 * - Btw per regel (9/21) in de totalen
 * - Artikel-picker vult de regel (naam, eenheid, inkoopprijs, btw-code)
 * - Gebruiksteller alleen voor nieuw gebruikte artikelen (definitief opslaan)
 * - Live overzichtsblok: posten, werkuren, inkoop, marge (€ en %), netto, bruto
 */

import { describe, it, expect } from "vitest";
import { ConvexError } from "convex/values";
import {
  MARGEFACTOR_TOELICHTING,
  margeNaarFactor,
  verkoopprijsUitMarge,
  margeUitVerkoopprijs,
  isPrijsOpRegel,
  berekenRegelTotaal,
  productNaarRegel,
  nieuweProductIdsVoorGebruik,
  berekenHoofdstukSubtotalen,
  berekenVrijeTotalen,
  berekenOverzicht,
  type VrijeRegel,
} from "../../../../convex/vrijeOfferteBerekening";

const regel = (over: Partial<VrijeRegel> = {}): VrijeRegel => ({
  id: over.id ?? "r1",
  scope: over.scope ?? "Aanleg",
  omschrijving: over.omschrijving ?? "Testregel",
  eenheid: over.eenheid ?? "stuk",
  hoeveelheid: over.hoeveelheid ?? 1,
  prijsPerEenheid: over.prijsPerEenheid ?? 100,
  totaal:
    over.totaal ??
    (over.hoeveelheid ?? 1) * (over.prijsPerEenheid ?? 100),
  type: over.type ?? "materiaal",
  ...over,
});

describe("margeNaarFactor (PRD §2.5b: factor = 1 ÷ (1 − marge))", () => {
  it("30% marge → ×1,43 en 40% → ×1,67 (zoals de (i)-toelichting zegt)", () => {
    expect(margeNaarFactor(30)).toBeCloseTo(1.4286, 3);
    expect(margeNaarFactor(40)).toBeCloseTo(1.6667, 3);
    expect(margeNaarFactor(0)).toBe(1);
  });

  it("40% opslag óp inkoop (×1,40) is maar 28,6% marge — het PRD-voorbeeld", () => {
    // inkoop 100, opslag 40% → verkoop 140; marge op verkoop:
    const marge = margeUitVerkoopprijs(100, 140, false);
    expect(marge).toBeCloseTo(28.57, 1);
    // en de toelichting benoemt precies dit onderscheid
    expect(MARGEFACTOR_TOELICHTING).toContain("×1,43");
    expect(MARGEFACTOR_TOELICHTING).toContain("28,6% marge");
  });

  it("weigert marge ≥ 100% en niet-eindige waarden", () => {
    expect(() => margeNaarFactor(100)).toThrow(ConvexError);
    expect(() => margeNaarFactor(Infinity)).toThrow(ConvexError);
    expect(() => margeNaarFactor(-5)).toThrow(ConvexError);
  });
});

describe("marge ↔ verkoopprijs, beide kanten op", () => {
  it("marge invullen → verkoopprijs (30% op €70 inkoop → €100)", () => {
    expect(verkoopprijsUitMarge(70, 30, false)).toBe(100);
  });

  it("verkoopprijs invullen → marge (inkoop €70, verkoop €100 → 30%)", () => {
    expect(margeUitVerkoopprijs(70, 100, false)).toBe(30);
  });

  it("rondreis is consistent: inkoop → verkoop → zelfde marge terug", () => {
    const verkoop = verkoopprijsUitMarge(48.5, 42.5, false);
    expect(margeUitVerkoopprijs(48.5, verkoop, false)).toBeCloseTo(42.5, 1);
  });
});

describe("Infinity%-verbod (HERO-les bijlage B)", () => {
  it("geen marge-berekening op prijs-op-regel-artikelen", () => {
    expect(() => verkoopprijsUitMarge(100, 30, true)).toThrow(
      /prijs wordt op de offerte-regel/
    );
    expect(() => margeUitVerkoopprijs(100, 130, true)).toThrow(ConvexError);
  });

  it("geen marge-berekening op inkoopprijs €0 of lager", () => {
    expect(() => verkoopprijsUitMarge(0, 30, false)).toThrow(
      /€0 of lager/
    );
    expect(() => margeUitVerkoopprijs(-5, 100, false)).toThrow(ConvexError);
  });

  it("isPrijsOpRegel volgt de productbestand-definitie (leeg of ≤ €0)", () => {
    expect(isPrijsOpRegel(undefined)).toBe(true);
    expect(isPrijsOpRegel(null)).toBe(true);
    expect(isPrijsOpRegel(0)).toBe(true);
    expect(isPrijsOpRegel(12.5)).toBe(false);
  });
});

describe("berekenRegelTotaal (korting per regel)", () => {
  it("hoeveelheid × verkoopprijs, minus regel-korting", () => {
    expect(berekenRegelTotaal(4, 25)).toBe(100);
    expect(berekenRegelTotaal(4, 25, 10)).toBe(90);
  });

  it("weigert korting buiten 0-100%", () => {
    expect(() => berekenRegelTotaal(1, 100, -1)).toThrow(ConvexError);
    expect(() => berekenRegelTotaal(1, 100, 101)).toThrow(ConvexError);
  });
});

describe("artikel-picker vult de regel (PRD §2.5b)", () => {
  it("neemt naam, eenheid, inkoopprijs en btw-code direct over", () => {
    const r = productNaarRegel(
      {
        _id: "p1",
        productnaam: "Boomschors 50L",
        eenheid: "zak",
        inkoopprijs: 6,
        verkoopprijs: 9,
        btwCode: 21,
        gebruiksteller: 116,
      },
      "Borders",
      "regel-1"
    );
    expect(r.omschrijving).toBe("Boomschors 50L");
    expect(r.eenheid).toBe("zak");
    expect(r.inkoopprijsPerEenheid).toBe(6);
    expect(r.btwCode).toBe(21);
    expect(r.productId).toBe("p1");
    expect(r.prijsPerEenheid).toBe(9);
    // marge afgeleid uit inkoop/verkoop: 1 − 6/9 = 33,33%
    expect(r.margePercentage).toBeCloseTo(33.33, 1);
    expect(r.prijsOpRegel).toBeUndefined();
  });

  it("€0-inkoop → prijs-op-regel: verkoop €0, geen marge (kantoor vult in)", () => {
    const r = productNaarRegel(
      { _id: "p2", productnaam: "Stelpost vijver", inkoopprijs: 0 },
      "Specials",
      "regel-2"
    );
    expect(r.prijsOpRegel).toBe(true);
    expect(r.prijsPerEenheid).toBe(0);
    expect(r.margePercentage).toBeUndefined();
    expect(r.inkoopprijsPerEenheid).toBeUndefined();
  });

  it("zonder verkoopprijs in het bestand: standaardmarge bepaalt de verkoopprijs", () => {
    const r = productNaarRegel(
      { _id: "p3", productnaam: "Split 25kg", inkoopprijs: 8 },
      "Bestrating",
      "regel-3",
      20
    );
    expect(r.prijsPerEenheid).toBe(10); // 8 ÷ (1 − 0,20)
    expect(r.margePercentage).toBe(20);
  });
});

describe("gebruiksteller bij definitief opslaan (niet per klik)", () => {
  it("telt alleen artikelen die nieuw op de offerte staan, elk één keer", () => {
    const bestaand = [{ productId: "a" }, { productId: undefined }];
    const nieuw = [
      { productId: "a" }, // stond er al → niet tellen
      { productId: "b" },
      { productId: "b" }, // zelfde artikel 2× op de offerte → één keer tellen
      { productId: undefined }, // vrije regel → nooit tellen
    ];
    expect(nieuweProductIdsVoorGebruik(bestaand, nieuw)).toEqual(["b"]);
  });
});

describe("hoofdstukken met subtotalen (PRD §2.5b)", () => {
  it("groepeert op hoofdstuk in volgorde van voorkomen", () => {
    const regels = [
      regel({ id: "1", scope: "Voorbereiding", totaal: 100 }),
      regel({ id: "2", scope: "Beplanting", totaal: 250 }),
      regel({ id: "3", scope: "Voorbereiding", totaal: 50 }),
    ];
    expect(berekenHoofdstukSubtotalen(regels)).toEqual([
      { hoofdstuk: "Voorbereiding", subtotaal: 150, aantalRegels: 2 },
      { hoofdstuk: "Beplanting", subtotaal: 250, aantalRegels: 1 },
    ]);
  });
});

describe("berekenVrijeTotalen (zelfde totalen-vorm als het offerte-record)", () => {
  it("btw per regel: 9% en 21% gemengd", () => {
    const regels = [
      regel({ id: "1", totaal: 100, btwCode: 9 }), // planten
      regel({ id: "2", totaal: 200, btwCode: 21 }), // materiaal
    ];
    const t = berekenVrijeTotalen(regels);
    expect(t.subtotaal).toBe(300);
    expect(t.totaalExBtw).toBe(300);
    expect(t.btw).toBe(9 + 42);
    expect(t.totaalInclBtw).toBe(351);
  });

  it("zonder btw-code valt een regel terug op 21%", () => {
    const t = berekenVrijeTotalen([regel({ totaal: 100 })]);
    expect(t.btw).toBe(21);
  });

  it("korting op totaal gaat vóór btw en wordt naar rato verdeeld", () => {
    const regels = [
      regel({ id: "1", totaal: 100, btwCode: 9 }),
      regel({ id: "2", totaal: 100, btwCode: 21 }),
    ];
    const t = berekenVrijeTotalen(regels, 20); // 10% van het subtotaal
    expect(t.totaalExBtw).toBe(180);
    // grondslag per regel 90: btw = 90×9% + 90×21% = 8,10 + 18,90
    expect(t.btw).toBeCloseTo(27, 2);
    expect(t.totaalInclBtw).toBeCloseTo(207, 2);
  });

  it("weigert korting op totaal groter dan het subtotaal of negatief", () => {
    expect(() => berekenVrijeTotalen([regel({ totaal: 50 })], 60)).toThrow(
      ConvexError
    );
    expect(() => berekenVrijeTotalen([], -1)).toThrow(ConvexError);
  });

  it("marge = verkoop − inkoop, als % van de verkoop (PRD-semantiek)", () => {
    const regels = [
      regel({
        id: "1",
        hoeveelheid: 2,
        prijsPerEenheid: 50,
        totaal: 100,
        inkoopprijsPerEenheid: 35,
      }),
    ];
    const t = berekenVrijeTotalen(regels);
    expect(t.marge).toBe(30); // 100 − 70
    expect(t.margePercentage).toBe(30); // 30 ÷ 100
  });

  it("arbeidregels tellen werkuren en arbeidskosten", () => {
    const regels = [
      regel({
        id: "1",
        type: "arbeid",
        eenheid: "uur",
        hoeveelheid: 8,
        prijsPerEenheid: 65,
        totaal: 520,
      }),
      regel({ id: "2", type: "materiaal", totaal: 100 }),
    ];
    const t = berekenVrijeTotalen(regels);
    expect(t.totaalUren).toBe(8);
    expect(t.arbeidskosten).toBe(520);
    expect(t.materiaalkosten).toBe(100);
  });
});

describe("live overzichtsblok (PRD §2.5b: posten, werkuren, inkoop, marge, netto, bruto)", () => {
  it("rekent mee tijdens het bouwen", () => {
    const regels = [
      regel({
        id: "1",
        type: "arbeid",
        eenheid: "uur",
        hoeveelheid: 4,
        prijsPerEenheid: 65,
        totaal: 260,
        btwCode: 21,
      }),
      regel({
        id: "2",
        hoeveelheid: 10,
        prijsPerEenheid: 12,
        totaal: 120,
        inkoopprijsPerEenheid: 8,
        btwCode: 9,
      }),
    ];
    const o = berekenOverzicht(regels);
    expect(o.posten).toBe(2);
    expect(o.werkuren).toBe(4);
    expect(o.inkoop).toBe(80);
    expect(o.margeBedrag).toBe(40); // alleen de regel met bekende inkoop
    expect(o.netto).toBe(380);
    expect(o.bruto).toBeCloseTo(380 + 260 * 0.21 + 120 * 0.09, 2);
    expect(o.margePercentage).toBeCloseTo((40 / 380) * 100, 1);
  });
});
