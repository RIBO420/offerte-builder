/**
 * Acceptatietest HERO-nabouw: offerte 01399 (docs/hero-nabouw/offerte/hero-datamodel.json).
 *
 * Een echte offerte-aanleg uit HERO met gemengde btw (werk 21%, planten 9%).
 * De vrije builder en de factuurlogica moeten exact dezelfde totalen halen als
 * HERO: netto 24.699,10 · btw 5.106,17 (21%: 5.045,69 + 9%: 60,48) · bruto 29.805,27.
 * HERO rondt de btw per tarief af; wij ook.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  berekenVrijeTotalen,
  berekenBtwPerTarief,
  berekenRegelTotaal,
  type VrijeRegel,
} from "../../../../convex/vrijeOfferteBerekening";
import { berekenFactuurTotalen } from "../../../../convex/facturatieLogica";

interface HeroRegel {
  nr: string;
  name: string;
  quantity: number;
  unit: string;
  base_price: number;
  marge: number;
  net_price_per_unit: number;
  vat_percent: 9 | 21;
}

const datamodel = JSON.parse(
  readFileSync(
    join(process.cwd(), "docs/hero-nabouw/offerte/hero-datamodel.json"),
    "utf8"
  )
);
const fixture = datamodel.fixture_01399 as {
  lines: HeroRegel[];
  expected_totals: {
    base: number;
    net: number;
    byVat: { vat: number; net: number; base: number }[];
    vat: number;
    brutto: number;
  };
};

// HERO-regel → vrije regel: inkoop en verkoop gaan één op één over, de
// opslag van HERO wordt niet bewaard (die volgt uit de twee prijzen).
const regels: VrijeRegel[] = fixture.lines.map((r) => ({
  id: r.nr,
  scope: "Aanleg",
  omschrijving: r.name,
  eenheid: r.unit,
  hoeveelheid: r.quantity,
  prijsPerEenheid: r.net_price_per_unit,
  totaal: berekenRegelTotaal(r.quantity, r.net_price_per_unit),
  type: "materiaal",
  inkoopprijsPerEenheid: r.base_price,
  btwCode: r.vat_percent,
}));

const verwacht = fixture.expected_totals;

describe("HERO offerte 01399", () => {
  it("HERO-opslag volgt uit inkoop en verkoop (VP = inkoop × (1 + opslag))", () => {
    for (const r of fixture.lines) {
      const opslag = (r.net_price_per_unit / r.base_price - 1) * 100;
      expect(Math.round(opslag * 100) / 100).toBe(r.marge);
    }
  });

  it("vrije builder haalt netto, btw en bruto exact", () => {
    const t = berekenVrijeTotalen(regels);
    expect(t.totaalExBtw).toBe(verwacht.net);
    expect(t.btw).toBe(verwacht.vat);
    expect(t.totaalInclBtw).toBe(verwacht.brutto);
  });

  it("btw per tarief: 21% over 24.027,10 = 5.045,69 en 9% over 672,00 = 60,48", () => {
    const perTarief = berekenBtwPerTarief(regels);
    expect(perTarief).toEqual([
      { percentage: 9, grondslag: 672, bedrag: 60.48 },
      { percentage: 21, grondslag: 24027.1, bedrag: 5045.69 },
    ]);
    for (const { vat, net } of verwacht.byVat) {
      expect(perTarief.find((p) => p.percentage === vat)?.grondslag).toBe(net);
    }
  });

  it("inkoop totaal = 18.733,35", () => {
    const inkoop = regels.reduce(
      (som, r) => som + (r.inkoopprijsPerEenheid ?? 0) * r.hoeveelheid,
      0
    );
    expect(Math.round(inkoop * 100) / 100).toBe(verwacht.base);
  });

  it("factuurlogica rekent dezelfde regels naar dezelfde totalen", () => {
    const t = berekenFactuurTotalen(
      regels.map((r) => ({ totaal: r.totaal, btwCode: r.btwCode })),
      21
    );
    expect(t.subtotaal).toBe(verwacht.net);
    expect(t.btwBedrag).toBe(verwacht.vat);
    expect(t.totaalInclBtw).toBe(verwacht.brutto);
  });
});
