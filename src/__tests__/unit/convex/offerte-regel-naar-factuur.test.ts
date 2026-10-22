import { describe, it, expect } from "vitest";
import { offerteRegelNaarFactuurRegel } from "../../../../convex/facturatieLogica";

const basis = {
  id: "r1",
  omschrijving: "Renovatie gazon",
  eenheid: "m²",
  hoeveelheid: 40,
  prijsPerEenheid: 12.5,
  totaal: 500,
};

describe("offerteRegelNaarFactuurRegel (facturen.generate)", () => {
  it("neemt de artikelbeschrijving en het btw-tarief mee", () => {
    expect(
      offerteRegelNaarFactuurRegel({
        ...basis,
        btwCode: 9,
        artikelBeschrijving: "  Wij verzorgen de complete renovatie.\n- Verticuteren  ",
      })
    ).toEqual({
      ...basis,
      btwCode: 9,
      artikelBeschrijving: "Wij verzorgen de complete renovatie.\n- Verticuteren",
    });
  });

  it("laat scope, type en lege velden weg", () => {
    const regel = offerteRegelNaarFactuurRegel({
      ...basis,
      artikelBeschrijving: "   ",
      // extra offertevelden die de factuur niet kent
      ...({ scope: "Gras", type: "materiaal" } as object),
    });
    expect(regel).toEqual(basis);
    expect("artikelBeschrijving" in regel).toBe(false);
    expect("btwCode" in regel).toBe(false);
    expect("scope" in regel).toBe(false);
  });
});
