// @vitest-environment node
/**
 * `werkitems.resolveAdres` — welk adres een werkitem toont.
 *
 * De ruling van sep 2026 (wens Mickey): wérk gaat naar het uitvoeradres van de
 * klant als dat er is, anders naar het hoofdadres. Een eigen `adres` op het
 * werkitem blijft de hardste override — dat is het vrije veld waarin kantoor
 * "achterom, poort naast nr. 12" kan zetten.
 *
 * Deze suite bewaakt de volgorde: werkitem-adres → uitvoeradres → hoofdadres.
 */

import { describe, it, expect } from "vitest";

import { resolveAdres } from "../../../../convex/werkitems";

const hoofdadres = {
  adres: "Hoofdweg 1",
  postcode: "1234 AB",
  plaats: "Meppel",
};

const uitvoerAdres = {
  adres: "Tuinlaan 9",
  postcode: "7941 CD",
  plaats: "Staphorst",
};

describe("resolveAdres", () => {
  it("gebruikt het uitvoeradres van de klant als dat er is", () => {
    expect(resolveAdres({}, { ...hoofdadres, uitvoerAdres })).toBe(
      "Tuinlaan 9, 7941 CD Staphorst"
    );
  });

  it("valt terug op het hoofdadres zonder uitvoeradres", () => {
    expect(resolveAdres({}, hoofdadres)).toBe("Hoofdweg 1, 1234 AB Meppel");
  });

  it("laat een eigen werkitem-adres altijd winnen", () => {
    expect(
      resolveAdres({ adres: "Achterom, poort naast nr. 12" }, {
        ...hoofdadres,
        uitvoerAdres,
      })
    ).toBe("Achterom, poort naast nr. 12");
  });

  it("geeft null zonder klant en zonder eigen adres", () => {
    expect(resolveAdres({}, null)).toBeNull();
  });

  it("geeft null als klant én uitvoeradres helemaal leeg zijn", () => {
    expect(
      resolveAdres(
        {},
        {
          adres: "",
          postcode: "",
          plaats: "",
          uitvoerAdres: { adres: " ", postcode: " ", plaats: " " },
        }
      )
    ).toBeNull();
  });
});
