/**
 * Factuurketen (HERO-nabouw fase 3): termijnen 50/30/20 en de eindfactuur
 * met de restmethode. Acceptatietest 1 uit DOCUMENTEN-MODULE.md op offerte
 * 01399 (gemengde btw): de som van alle facturen is op de cent de offerte.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { berekenFactuurTotalen } from "../../../../convex/facturatieLogica";
import {
  STANDAARD_TERMIJNSCHEMA,
  aftrekVanFactuur,
  berekenEindfactuurTotalen,
  eindfactuurRegels,
  eindfactuurRegelsVoorOfferte,
  offerteGrondslagPerTarief,
  termijnRegels,
  valideerTermijnschema,
} from "../../../../convex/lib/termijnFacturatie";

const fixture = JSON.parse(
  readFileSync(join(process.cwd(), "docs/hero-nabouw/offerte/hero-datamodel.json"), "utf8")
).fixture_01399 as {
  lines: { quantity: number; net_price_per_unit: number; vat_percent: 9 | 21 }[];
};

const offerte = {
  bron: "vrij" as const,
  regels: fixture.lines.map((l) => ({
    totaal: Math.round(l.quantity * l.net_price_per_unit * 100) / 100,
    btwCode: l.vat_percent,
  })),
  totalen: { totaalExBtw: 24699.1, btw: 5106.17 },
};

function termijnFactuur(nummer: number) {
  const grondslag = offerteGrondslagPerTarief(offerte);
  const regels = termijnRegels(grondslag, STANDAARD_TERMIJNSCHEMA[nummer - 1], nummer, "01399");
  const t = berekenFactuurTotalen(regels, 21);
  return { regels, ...t, factuurnummer: `FACT0113${nummer}`, deelfactuurNummer: nummer };
}

describe("termijnschema", () => {
  it("50/30/20 is geldig; een schema dat niet op 100% uitkomt niet", () => {
    expect(valideerTermijnschema(STANDAARD_TERMIJNSCHEMA)).toBeUndefined();
    expect(
      valideerTermijnschema([
        { percentage: 50, label: "na gunning" },
        { percentage: 40, label: "bij oplevering" },
      ])
    ).toMatch(/90%/);
    expect(valideerTermijnschema([])).toBeUndefined();
  });
});

describe("offerte 01399 in termijnen (acceptatietest 1)", () => {
  it("grondslag per tarief: 21% 24.027,10 en 9% 672,00", () => {
    expect(offerteGrondslagPerTarief(offerte).map((g) => [g.percentage, g.grondslag])).toEqual([
      [9, 672],
      [21, 24027.1],
    ]);
  });

  it("termijn 1 (50%): 12.013,55 + 336,00, btw 2.553,09, bruto 14.902,64", () => {
    const t1 = termijnFactuur(1);
    expect(t1.regels.map((r) => r.totaal)).toEqual([336, 12013.55]);
    expect(t1.regels[1].omschrijving).toBe(
      "Termijn 1 – 50% na gunning van offerte 01399 (21% btw)"
    );
    expect(t1.btwBedrag).toBe(2553.09);
    expect(t1.totaalInclBtw).toBe(14902.64);
  });

  it("termijn 2 (30%): 7.208,13 + 201,60, btw 1.531,85, bruto 8.941,58", () => {
    const t2 = termijnFactuur(2);
    expect(t2.regels.map((r) => r.totaal)).toEqual([201.6, 7208.13]);
    expect(t2.btwBedrag).toBe(1531.85);
    expect(t2.totaalInclBtw).toBe(8941.58);
  });

  it("eindfactuur: rest 4.805,42 + 134,40, btw 1.021,23 (niet 1.021,24), bruto 5.961,05", () => {
    const grondslag = offerteGrondslagPerTarief(offerte);
    const aftrek = [termijnFactuur(1), termijnFactuur(2)].flatMap(aftrekVanFactuur);
    const eind = berekenEindfactuurTotalen(eindfactuurRegels(grondslag, "01399"), aftrek);
    expect(eind.btwUitsplitsing).toEqual([
      { percentage: 9, grondslag: 134.4, bedrag: 12.1 },
      { percentage: 21, grondslag: 4805.42, bedrag: 1009.13 },
    ]);
    expect(eind.btwBedrag).toBe(1021.23);
    expect(eind.totaalInclBtw).toBe(5961.05);
  });

  it("de som van alle facturen is de offerte: btw 5.106,17, bruto 29.805,27", () => {
    const grondslag = offerteGrondslagPerTarief(offerte);
    const t1 = termijnFactuur(1);
    const t2 = termijnFactuur(2);
    const eind = berekenEindfactuurTotalen(
      eindfactuurRegels(grondslag, "01399"),
      [t1, t2].flatMap(aftrekVanFactuur)
    );
    const r = (n: number) => Math.round(n * 100) / 100;
    expect(r(t1.btwBedrag + t2.btwBedrag + eind.btwBedrag)).toBe(5106.17);
    expect(r(t1.totaalInclBtw + t2.totaalInclBtw + eind.totaalInclBtw)).toBe(29805.27);
  });

  it("aftrek noemt de termijn en het factuurnummer", () => {
    expect(aftrekVanFactuur(termijnFactuur(1))[0].omschrijving).toBe(
      "Termijn 1 (factuur FACT01131)"
    );
  });
});

describe("wizard-offerte (één tarief)", () => {
  it("leidt het tarief af uit de totalen", () => {
    expect(
      offerteGrondslagPerTarief({ regels: [], totalen: { totaalExBtw: 1000, btw: 210 } })
    ).toEqual([{ percentage: 21, grondslag: 1000, bedrag: 210 }]);
  });
});

describe("eindfactuur: regels los, niet gebundeld", () => {
  const regel = (over: Record<string, unknown>) => ({
    omschrijving: "Graszoden",
    eenheid: "m²",
    hoeveelheid: 10,
    prijsPerEenheid: 10,
    totaal: 100,
    btwCode: 21 as const,
    ...over,
  });

  it("vrije offerte: elke regel apart, met beschrijving, hoofdstuk en volgorde", () => {
    const regels = eindfactuurRegelsVoorOfferte(
      {
        bron: "vrij",
        regels: [
          regel({ id: "a", scope: "Gazon", artikelBeschrijving: "Vers gesneden" }),
          regel({ id: "b", omschrijving: "Haagplant", totaal: 50, prijsPerEenheid: 5, btwCode: 9 }),
          regel({ id: "c", optioneel: true }),
        ],
        totalen: { totaalExBtw: 150, btw: 25.5 },
      },
      "01400"
    );
    expect(regels.map((r) => r.id)).toEqual(["a", "b"]);
    expect(regels[0]).toMatchObject({ omschrijving: "Graszoden", hoeveelheid: 10, scope: "Gazon", artikelBeschrijving: "Vers gesneden" });
    expect(regels[1].btwCode).toBe(9);
  });

  it("korting op het totaal komt als kortingsregel per tarief; netto per tarief blijft gelijk", () => {
    const offerte = {
      bron: "vrij" as const,
      regels: [regel({ id: "a", totaal: 300 }), regel({ id: "b", totaal: 100, btwCode: 9 as const })],
      kortingOpTotaal: 40,
      totalen: { totaalExBtw: 360, btw: 0 },
    };
    const regels = eindfactuurRegelsVoorOfferte(offerte, "01400");
    const kortingen = regels.filter((r) => r.id.startsWith("korting"));
    expect(kortingen.map((k) => k.totaal)).toEqual([-10, -30]);
    for (const g of offerteGrondslagPerTarief(offerte)) {
      const som = regels.filter((r) => r.btwCode === g.percentage).reduce((t, r) => t + r.totaal, 0);
      expect(Math.round(som * 100) / 100).toBe(g.grondslag);
    }
  });

  it("wizard-offerte blijft één post per tarief (marge zit niet in de regels)", () => {
    const regels = eindfactuurRegelsVoorOfferte(
      { bron: "wizard", regels: [regel({}), regel({})], totalen: { totaalExBtw: 500, btw: 105 } },
      "01400"
    );
    expect(regels).toHaveLength(1);
    expect(regels[0].omschrijving).toContain("offerte 01400");
  });
});
