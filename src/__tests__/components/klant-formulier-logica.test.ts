/**
 * De drie klantformulieren (klantenlijst, aanmaakdialoog, dossier) deelden tot
 * sep 2026 alleen hun uiterlijk, niet hun regels: elk had zijn eigen kopie van
 * "hoe volgt `naam` uit de naamdelen", "wat staat er bij bewerken al in de
 * velden" en "wat stuurt een afwijkend uitvoeradres naar de backend".
 *
 * Wat hier vastligt is precies dat gedeelde gedrag — inclusief de twee dingen
 * die makkelijk stilzwijgend verkeerd gaan:
 *
 * 1. Lege strings zijn het wissignaal van `klanten.update` (`undefined` slaat
 *    hij over), dus een omgezet klanttype moet ze meesturen.
 * 2. Een dichtgeklapt uitvoeradres wist bij een bewerking, maar gaat bij het
 *    aanmaken helemaal niet mee.
 */
import { describe, it, expect } from "vitest";

import {
  isZakelijk,
  naamVelden,
  splitsVoorBewerken,
  uitvoerAdresCompleet,
  uitvoerAdresIngevuld,
  uitvoerAdresPayload,
  UITVOERADRES_WISSEN,
} from "@/components/klanten/velden/klant-formulier-logica";

describe("isZakelijk", () => {
  it("kent alleen een particulier als niet-zakelijk", () => {
    expect(isZakelijk("particulier")).toBe(false);
    expect(isZakelijk("zakelijk")).toBe(true);
    expect(isZakelijk("vve")).toBe(true);
    expect(isZakelijk("gemeente")).toBe(true);
    expect(isZakelijk("overig")).toBe(true);
  });
});

describe("naamVelden", () => {
  it("leidt `naam` af uit voor- en achternaam bij een particulier", () => {
    expect(
      naamVelden({
        klantType: "particulier",
        naam: "iets ouds",
        voornaam: " Jan ",
        achternaam: " van der Berg ",
      })
    ).toEqual({
      naam: "Jan van der Berg",
      voornaam: "Jan",
      achternaam: "van der Berg",
    });
  });

  it("laat een lege particulier ook echt leeg (zodat 'verplicht' verschijnt)", () => {
    // Niet terugvallen op de oude naam: dat lijkt op wissen en is het niet.
    expect(
      naamVelden({
        klantType: "particulier",
        naam: "Alanys Rerimassie",
        voornaam: "  ",
        achternaam: "",
      }).naam
    ).toBe("");
  });

  it("houdt bij een bedrijf de bedrijfsnaam en wist de naamdelen", () => {
    expect(
      naamVelden({
        klantType: "zakelijk",
        naam: "  De Groene Tuin B.V. ",
        voornaam: "Jan",
        achternaam: "Jansen",
      })
    ).toEqual({
      naam: "De Groene Tuin B.V.",
      // Lege strings, geen undefined: alleen zo wist `klanten.update` de
      // naamdelen die van vóór het omzetten van het type stammen.
      voornaam: "",
      achternaam: "",
    });
  });
});

describe("splitsVoorBewerken", () => {
  it("splitst een klant die alleen een naam heeft", () => {
    expect(splitsVoorBewerken({ naam: "Jan van der Berg" })).toEqual({
      voornaam: "Jan",
      achternaam: "van der Berg",
    });
  });

  it("houdt een naam die met een tussenvoegsel begint heel", () => {
    expect(splitsVoorBewerken({ naam: "van der Berg" })).toEqual({
      voornaam: "",
      achternaam: "van der Berg",
    });
  });

  it("laat opgeslagen naamdelen met rust", () => {
    expect(
      splitsVoorBewerken({
        naam: "Alanys Rerimassie",
        achternaam: "Rerimassie",
      })
    ).toEqual({ voornaam: "", achternaam: "Rerimassie" });
  });

  it("splitst een bedrijfsnaam nooit", () => {
    expect(
      splitsVoorBewerken({ naam: "De Groene Tuin B.V." }, "zakelijk")
    ).toEqual({ voornaam: "", achternaam: "" });
  });

  it("kan met een klant zonder naam overweg", () => {
    expect(splitsVoorBewerken({})).toEqual({ voornaam: "", achternaam: "" });
  });
});

describe("uitvoeradres", () => {
  const VOLLEDIG = {
    adres: "Kerkstraat 12",
    postcode: "6411 CA",
    plaats: "Heerlen",
  };
  const LEEG = { adres: "", postcode: "", plaats: "" };

  it("telt een dichtgeklapt blok nooit als ingevuld", () => {
    expect(uitvoerAdresIngevuld(false, VOLLEDIG)).toBe(false);
  });

  it("telt een open blok met één gevuld veld als ingevuld", () => {
    expect(uitvoerAdresIngevuld(true, { ...LEEG, plaats: "Heerlen" })).toBe(true);
  });

  it("telt een open blok met alleen spaties als leeg", () => {
    expect(uitvoerAdresIngevuld(true, { ...LEEG, adres: "   " })).toBe(false);
  });

  it("eist alle drie de velden voor compleet", () => {
    expect(uitvoerAdresCompleet(VOLLEDIG)).toBe(true);
    expect(uitvoerAdresCompleet({ ...VOLLEDIG, postcode: " " })).toBe(false);
  });

  it("stuurt het getrimde adres mee zodra het blok open staat", () => {
    expect(
      uitvoerAdresPayload(
        true,
        { adres: " Kerkstraat 12 ", postcode: " 6411 CA", plaats: "Heerlen " },
        "bijwerken"
      )
    ).toEqual(VOLLEDIG);
  });

  it("wist met drie lege velden bij een bewerking", () => {
    expect(uitvoerAdresPayload(false, VOLLEDIG, "bijwerken")).toEqual({
      adres: "",
      postcode: "",
      plaats: "",
    });
  });

  it("stuurt bij het aanmaken niets mee als het blok dicht staat", () => {
    expect(uitvoerAdresPayload(false, VOLLEDIG, "aanmaken")).toBeUndefined();
  });

  it("geeft nooit de constante zelf terug", () => {
    const payload = uitvoerAdresPayload(false, VOLLEDIG, "bijwerken");
    expect(payload).not.toBe(UITVOERADRES_WISSEN);
  });
});
