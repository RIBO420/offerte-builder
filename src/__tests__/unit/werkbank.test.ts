/**
 * De kernlogica van het werkblad (fase B van het offerte-entree-masterplan).
 *
 * Wat hier bewaakt wordt zijn de dingen die stil fout kunnen gaan: dubbele
 * lettertoetsen, een scope die zich compleet noemt terwijl de engine niets kan
 * rekenen, werkzaamheden die twee keer op de offerte belanden, en een offerte
 * die definitief gemaakt zou kunnen worden zonder klant.
 */

import { describe, it, expect } from "vitest";
import { isKlantCompleet } from "../../../convex/lib/offerteKlant";
import type { OfferteRegel } from "@/lib/offerte-calculator";
import type { OfferteBouwsteenRegel } from "@/lib/bouwsteen-offerte";
import {
  AANLEG_SCOPES,
  GARANTIE_REGEL_ID,
  catalogusUitBouwsteenRegels,
  garantieUitRegels,
  ONDERHOUD_SCOPES,
  RENOVATIE_COMBI,
  activiteitSleutel,
  garantieRegel,
  geldigeScopes,
  isKlantCompleetVoorWerkbank,
  isScopeCompleet,
  ontdubbelOnderhoudRegels,
  scopeDataVoorOfferte,
  scopeVoorToets,
  scopesVoorType,
  werkbankRegels,
  werkbankVoortgang,
} from "@/lib/werkbank";

function regel(over: Partial<OfferteRegel> = {}): OfferteRegel {
  return {
    id: over.id ?? "r1",
    scope: over.scope ?? "gras",
    omschrijving: over.omschrijving ?? "Gras maaien",
    eenheid: over.eenheid ?? "uur",
    hoeveelheid: over.hoeveelheid ?? 2,
    prijsPerEenheid: over.prijsPerEenheid ?? 45,
    totaal: over.totaal ?? 90,
    type: over.type ?? "arbeid",
    margePercentage: over.margePercentage,
  };
}

describe("palet", () => {
  it("geeft per type negen scopes met unieke lettertoetsen", () => {
    for (const type of ["aanleg", "onderhoud"] as const) {
      const scopes = scopesVoorType(type);
      expect(scopes).toHaveLength(9);
      const letters = scopes.map((s) => s.toets);
      expect(new Set(letters).size).toBe(letters.length);
    }
  });

  it("houdt de entree-letters vast waar de betekenis gelijk is", () => {
    // De tegel-dialog gebruikt deze letters al; vingers hoeven niet om te leren.
    expect(scopeVoorToets("aanleg", "s")?.id).toBe("bestrating");
    expect(scopeVoorToets("aanleg", "p")?.id).toBe("parkeerplaats");
    expect(scopeVoorToets("aanleg", "b")?.id).toBe("beregening");
  });

  it("gebruikt nooit `g`: dat is de prefix van de globale spring-sneltoetsen", () => {
    // "g d" → dashboard, "g o" → offertes … Een palet-`g` zou een scope
    // toevoegen én een navigatiereeks openen; de vólgende letter stuurde je
    // dan van het werkblad af.
    for (const type of ["aanleg", "onderhoud"] as const) {
      expect(scopesVoorType(type).some((s) => s.toets === "g")).toBe(false);
    }
    expect(RENOVATIE_COMBI.toets).not.toBe("g");
  });

  it("botst niet met de renovatie-combinatie", () => {
    expect(scopeVoorToets("aanleg", RENOVATIE_COMBI.toets)).toBeUndefined();
    expect(RENOVATIE_COMBI.scopes).toEqual(["grondwerk", "borders", "gras"]);
  });

  it("hoofdletters werken net zo goed als kleine letters", () => {
    expect(scopeVoorToets("aanleg", "S")?.id).toBe("bestrating");
  });
});

describe("geldigeScopes (?scope= uit de URL)", () => {
  it("negeert onzin en scopes van het andere type", () => {
    expect(geldigeScopes("aanleg", ["bestrating", "heggen", "drop-tables"])).toEqual(
      ["bestrating"]
    );
  });

  it("ontdubbelt en zet altijd in paletvolgorde", () => {
    // ?scope=gras&scope=grondwerk&scope=gras
    expect(geldigeScopes("aanleg", ["gras", "grondwerk", "gras"])).toEqual([
      "grondwerk",
      "gras",
    ]);
  });

  it("levert een lege lijst zonder parameters", () => {
    expect(geldigeScopes("onderhoud", [])).toEqual([]);
  });

  it("kent alle scope-ids van beide paletten als geldig", () => {
    expect(
      geldigeScopes(
        "aanleg",
        AANLEG_SCOPES.map((s) => s.id)
      )
    ).toHaveLength(9);
    expect(
      geldigeScopes(
        "onderhoud",
        ONDERHOUD_SCOPES.map((s) => s.id)
      )
    ).toHaveLength(9);
  });
});

describe("isScopeCompleet", () => {
  it("aanleg: een oppervlakte van 0 is niet compleet", () => {
    expect(isScopeCompleet("aanleg", "gras", { gras: { oppervlakte: 0 } })).toBe(
      false
    );
    expect(isScopeCompleet("aanleg", "gras", { gras: { oppervlakte: 40 } })).toBe(
      true
    );
  });

  it("aanleg: bestrating vraagt ook een onderbouwdikte", () => {
    expect(
      isScopeCompleet("aanleg", "bestrating", {
        bestrating: { oppervlakte: 30, onderbouw: { dikteOnderlaag: 0 } },
      })
    ).toBe(false);
    expect(
      isScopeCompleet("aanleg", "bestrating", {
        bestrating: { oppervlakte: 30, onderbouw: { dikteOnderlaag: 5 } },
      })
    ).toBe(true);
  });

  it("aanleg: kolken vragen een aantal", () => {
    expect(
      isScopeCompleet("aanleg", "parkeerplaats", {
        parkeerplaats: { oppervlakte: 50, afwatering: "kolken" },
      })
    ).toBe(false);
    expect(
      isScopeCompleet("aanleg", "parkeerplaats", {
        parkeerplaats: { oppervlakte: 50, afwatering: "kolken", aantalKolken: 2 },
      })
    ).toBe(true);
  });

  it("onderhoud: gras zonder gras is compleet, gras mét gras vraagt m²", () => {
    expect(
      isScopeCompleet("onderhoud", "gras", { gras: { grasAanwezig: false } })
    ).toBe(true);
    expect(
      isScopeCompleet("onderhoud", "gras", {
        gras: { grasAanwezig: true, grasOppervlakte: 0 },
      })
    ).toBe(false);
  });

  it("onderhoud: werkzaamheden zonder maatvoering zijn meteen compleet", () => {
    expect(isScopeCompleet("onderhoud", "reiniging", { reiniging: {} })).toBe(true);
    expect(isScopeCompleet("onderhoud", "bemesting", {})).toBe(true);
  });

  it("crasht niet op ontbrekende of vreemde data uit Convex", () => {
    expect(isScopeCompleet("aanleg", "gras", {})).toBe(false);
    expect(isScopeCompleet("aanleg", "gras", { gras: null })).toBe(false);
    expect(
      isScopeCompleet("aanleg", "gras", { gras: { oppervlakte: "veertig" } })
    ).toBe(false);
    expect(isScopeCompleet("aanleg", "specials", { specials: {} })).toBe(false);
  });
});

describe("scopeDataVoorOfferte", () => {
  it("stuurt alleen de gekozen scopes mee — geen spookdata", () => {
    const data = { gras: { oppervlakte: 40 }, borders: { oppervlakte: 10 } };
    expect(scopeDataVoorOfferte(["gras"], data)).toEqual({
      gras: { oppervlakte: 40 },
    });
  });

  it("levert een leeg object als er niets gekozen is", () => {
    expect(scopeDataVoorOfferte([], { gras: {} })).toEqual({});
  });
});

describe("garantie", () => {
  it("geen keuze = geen regel (nul klikken voor de standaard)", () => {
    expect(garantieRegel(null)).toBeNull();
    expect(garantieRegel("bestaat-niet")).toBeNull();
  });

  it("een keuze wordt een echte offerteregel zonder marge-opslag", () => {
    const regel = garantieRegel("garantie-premium");
    expect(regel).not.toBeNull();
    expect(regel!.id).toBe(GARANTIE_REGEL_ID);
    expect(regel!.totaal).toBe(599);
    expect(regel!.margePercentage).toBe(0);
    expect(regel!.omschrijving).toContain("7 jaar");
  });

  it("herberekenen levert nooit een tweede garantieregel op", () => {
    const eerste = werkbankRegels({
      type: "aanleg",
      berekendeRegels: [regel({ scope: "gras" })],
      garantieId: "garantie-basis",
    }).regels;
    const tweede = werkbankRegels({
      type: "aanleg",
      berekendeRegels: [regel({ scope: "gras" })],
      garantieId: "garantie-basis",
    }).regels;
    expect(eerste.filter((r) => r.id === GARANTIE_REGEL_ID)).toHaveLength(1);
    expect(tweede.filter((r) => r.id === GARANTIE_REGEL_ID)).toHaveLength(1);
  });
});

describe("dubbele werkzaamheden (onderhoud)", () => {
  it("herkent dezelfde werkzaamheid onder twee namen", () => {
    expect(activiteitSleutel("Gras maaien")).toBe("maaien");
    expect(activiteitSleutel("Gazon maaien")).toBe("maaien");
    expect(activiteitSleutel("Heg snoeien")).toBe("heggen");
    expect(activiteitSleutel("Boomstronk frezen")).toBeNull();
  });

  it("laat het contract winnen en meldt wat er vervalt", () => {
    const berekend = [
      regel({ id: "a", omschrijving: "Gras maaien" }),
      regel({ id: "b", omschrijving: "Kanten steken" }),
    ];
    const contract = [regel({ id: "c", omschrijving: "Gazon maaien" })];

    const { regels, vervallen } = ontdubbelOnderhoudRegels(berekend, contract);
    expect(regels.map((r) => r.id)).toEqual(["b"]);
    expect(vervallen).toEqual(["Gras maaien"]);
  });

  it("laat alles staan als er geen contract is", () => {
    const berekend = [regel({ id: "a", omschrijving: "Gras maaien" })];
    const { regels, vervallen } = ontdubbelOnderhoudRegels(berekend, []);
    expect(regels).toHaveLength(1);
    expect(vervallen).toEqual([]);
  });

  it("aanleg kent deze laag niet en houdt al zijn regels", () => {
    const { regels, vervallen } = werkbankRegels({
      type: "aanleg",
      berekendeRegels: [regel({ id: "a", omschrijving: "Gras maaien" })],
      bouwsteenRegels: [regel({ id: "c", omschrijving: "Gazon maaien" })],
    });
    expect(regels).toHaveLength(2);
    expect(vervallen).toEqual([]);
  });

  it("onderhoud telt maaien nog maar één keer, inclusief garantie erachter", () => {
    const { regels } = werkbankRegels({
      type: "onderhoud",
      berekendeRegels: [
        regel({ id: "a", omschrijving: "Gras maaien" }),
        regel({ id: "b", omschrijving: "Bomen snoeien" }),
      ],
      bouwsteenRegels: [regel({ id: "c", omschrijving: "Gazon maaien" })],
      garantieId: "garantie-basis",
    });
    expect(regels.map((r) => r.id)).toEqual(["b", "c", GARANTIE_REGEL_ID]);
  });
});

describe("voortgang & afronden", () => {
  const compleet = {
    naam: "Hoveniersbedrijf Jansen",
    adres: "Dorpsstraat 1",
    postcode: "1234 AB",
    plaats: "Ede",
  };

  it("volgt exact dezelfde vier velden als de guard in Convex", () => {
    const gevallen = [
      compleet,
      { ...compleet, postcode: "" },
      { ...compleet, plaats: "   " },
      null,
      undefined,
    ];
    for (const geval of gevallen) {
      expect(isKlantCompleetVoorWerkbank(geval)).toBe(isKlantCompleet(geval));
    }
  });

  it("zonder klant mag het concept blijven bestaan, maar niet definitief worden", () => {
    const voortgang = werkbankVoortgang({
      type: "aanleg",
      scopes: ["gras"],
      scopeData: { gras: { oppervlakte: 40 } },
      klant: null,
      aantalRegels: 5,
    });
    expect(voortgang.klantCompleet).toBe(false);
    expect(voortgang.kanDefinitief).toBe(false);
  });

  it("zonder regels evenmin", () => {
    const voortgang = werkbankVoortgang({
      type: "aanleg",
      scopes: [],
      scopeData: {},
      klant: compleet,
      aantalRegels: 0,
    });
    expect(voortgang.kanDefinitief).toBe(false);
  });

  it("met klant én regels wel, en onvolledige scopes worden benoemd", () => {
    const voortgang = werkbankVoortgang({
      type: "aanleg",
      scopes: ["gras", "borders"],
      scopeData: { gras: { oppervlakte: 40 }, borders: { oppervlakte: 0 } },
      klant: compleet,
      aantalRegels: 5,
    });
    expect(voortgang.kanDefinitief).toBe(true);
    expect(voortgang.scopesCompleet).toBe(1);
    expect(voortgang.onvolledig).toEqual(["borders"]);
  });
});

describe("terugbouwen uit het document (na herladen)", () => {
  it("leest de garantiekeuze terug uit de regel op de offerte", () => {
    const opgeslagen = garantieRegel("garantie-premium-plus")!;
    expect(garantieUitRegels([regel(), opgeslagen])).toBe("garantie-premium-plus");
  });

  it("geeft null als er geen garantieregel staat", () => {
    expect(garantieUitRegels([regel()])).toBeNull();
    expect(garantieUitRegels([])).toBeNull();
  });

  it("verwart Premium Plus niet met Premium", () => {
    // Zelfde prefix in de naam; de prijs beslist.
    expect(garantieUitRegels([garantieRegel("garantie-premium")!])).toBe(
      "garantie-premium"
    );
  });

  it("bouwt de contractselectie terug uit de bouwsteen-regels", () => {
    const bouwsteenRegels = [
      {
        bouwsteenId: "bs1",
        naam: "Gazon maaien",
        soort: "terugkerend",
        frequentiePerJaar: 18,
        prijsPerBeurt: 25,
        prijsPerBeurtHandmatig: true,
        btwCode: 21,
        eenmalig: false,
      },
      {
        bouwsteenId: "bs2",
        naam: "Voegzand",
        soort: "keuzeregel",
        frequentiePerJaar: 1,
        prijsPerBeurt: 80,
        prijsPerBeurtHandmatig: false,
        btwCode: 21,
        eenmalig: true,
        zandKeuze: {
          keuze: "straatzand",
          prijsVoegzand: 120,
          prijsStraatzand: 80,
        },
      },
    ] as unknown as OfferteBouwsteenRegel[];

    const selectie = catalogusUitBouwsteenRegels(bouwsteenRegels);
    expect(selectie.regels.bs1).toEqual({
      aan: true,
      frequentiePerJaar: 18,
      prijsPerBeurt: 25,
    });
    // Niet handmatig ingevoerd = volg de catalogusprijs van vandaag.
    expect(selectie.regels.bs2.prijsPerBeurt).toBeNull();
    expect(selectie.zandKeuze).toBe("straatzand");
    expect(selectie.zandPrijzen).toEqual({ voegzand: 120, straatzand: 80 });
  });

  it("levert een lege selectie zonder bouwsteen-regels", () => {
    expect(catalogusUitBouwsteenRegels(undefined).regels).toEqual({});
    expect(catalogusUitBouwsteenRegels([]).regels).toEqual({});
  });
});
