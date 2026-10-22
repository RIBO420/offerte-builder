/**
 * HERO-artikelexport → prijsboek (fase 5). Getallen komen uit de echte
 * export van 22-10-2026: Standaardmarge = IP × 1,40, VK1 meestal gelijk aan IP.
 */
import { describe, it, expect } from "vitest";
import {
  btwUitHero,
  eenheidUitHero,
  planHeroArtikelen,
  verkoopprijsUitHero,
  type HeroArtikelRij,
} from "../../../../convex/lib/heroArtikelen";

const rij = (over: Partial<HeroArtikelRij> = {}): HeroArtikelRij => ({
  artikelnummer: "1001",
  naam: "Levering graszoden",
  inkoopprijs: 440,
  standaardmarge: 616,
  vk1: 440,
  gebruikt: 3,
  ...over,
});

describe("verkoopprijs volgens de prijslijst Standaardmarge", () => {
  it("met inkoopprijs: de Standaardmarge-prijs (IP × 1,40), niet VK1", () => {
    expect(verkoopprijsUitHero(rij())).toBe(616);
  });

  it("zonder inkoopprijs: VK1 is de vaste prijs (uurtarief)", () => {
    expect(verkoopprijsUitHero(rij({ inkoopprijs: 0, standaardmarge: 0, vk1: 60 }))).toBe(60);
  });

  it("zonder enige prijs: 0", () => {
    expect(verkoopprijsUitHero(rij({ inkoopprijs: 0, standaardmarge: 0, vk1: 0 }))).toBe(0);
  });

  it("rondt af op centen", () => {
    expect(verkoopprijsUitHero(rij({ inkoopprijs: 1.05, standaardmarge: 1.4700001 }))).toBe(1.47);
  });
});

describe("eenheid en btw", () => {
  it("vertaalt HERO-eenheden naar die van het prijsboek", () => {
    expect(eenheidUitHero("st")).toBe("stuk");
    expect(eenheidUitHero("wk")).toBe("week");
    expect(eenheidUitHero("m³")).toBe("m³");
    expect(eenheidUitHero("ton")).toBe("ton");
    expect(eenheidUitHero(undefined)).toBe("stuk");
  });

  it("btw 21% en 9%; iets anders blijft leeg", () => {
    expect(btwUitHero("21%")).toBe(21);
    expect(btwUitHero("9%")).toBe(9);
    expect(btwUitHero("0%")).toBeUndefined();
    expect(btwUitHero(undefined)).toBeUndefined();
  });
});

describe("planHeroArtikelen: alles over, alleen herbruikbare artikelen actief", () => {
  it("≥ 2× gebruikt → actief; minder → uit, maar wel geïmporteerd", () => {
    const plan = planHeroArtikelen([
      rij({ artikelnummer: "1", naam: "A", gebruikt: 2 }),
      rij({ artikelnummer: "2", naam: "B", gebruikt: 1 }),
      rij({ artikelnummer: "3", naam: "C", gebruikt: 0 }),
    ]);
    expect(plan.map((p) => p.isActief)).toEqual([true, false, false]);
    expect(plan[1].redenUit).toBe("weinig_gebruikt");
  });

  it("dubbele naam: het meest gebruikte artikel is actief, de rest staat uit", () => {
    const plan = planHeroArtikelen([
      rij({ artikelnummer: "10", naam: "Afvoerkosten groenafval", gebruikt: 82 }),
      rij({ artikelnummer: "11", naam: "afvoerkosten  groenafval ", gebruikt: 171 }),
    ]);
    expect(plan.find((p) => p.rij.artikelnummer === "11")?.isActief).toBe(true);
    const uit = plan.find((p) => p.rij.artikelnummer === "10");
    expect(uit?.isActief).toBe(false);
    expect(uit?.redenUit).toBe("dubbele_naam");
  });

  it("dubbele naam met gelijk gebruik: het nieuwste artikelnummer wint", () => {
    const plan = planHeroArtikelen([
      rij({ artikelnummer: "1500", naam: "Voorrijkosten", gebruikt: 5 }),
      rij({ artikelnummer: "1900", naam: "Voorrijkosten", gebruikt: 5 }),
    ]);
    expect(plan.filter((p) => p.isActief).map((p) => p.rij.artikelnummer)).toEqual(["1900"]);
  });

  it("prijs op regel alleen als er geen inkoop én geen vaste prijs is", () => {
    const [metPrijs, zonderPrijs] = planHeroArtikelen([
      rij({ artikelnummer: "1", naam: "Uurtarief", inkoopprijs: 0, standaardmarge: 0, vk1: 60 }),
      rij({ artikelnummer: "2", naam: "Afvoerkosten", inkoopprijs: 0, standaardmarge: 0, vk1: 0 }),
    ]);
    expect(metPrijs.prijsOpRegel).toBe(false);
    expect(metPrijs.verkoopprijs).toBe(60);
    expect(zonderPrijs.prijsOpRegel).toBe(true);
  });

  it("slaat rijen zonder naam over", () => {
    expect(planHeroArtikelen([rij({ naam: "  " })])).toHaveLength(0);
  });
});
