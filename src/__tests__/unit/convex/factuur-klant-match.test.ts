import { describe, expect, it } from "vitest";
import {
  huisnummerUitAdres,
  matchFactuurKlant,
  naamOvereenkomst,
  type FactuurKlantGegevens,
  type KlantKandidaat,
} from "../../../../convex/lib/factuurKlantMatch";

const ORG = "org_top";
const ANDERE_ORG = "org_ander";

function klant(id: string, velden: Partial<KlantKandidaat> & { naam: string }): KlantKandidaat {
  return { _id: id, orgId: ORG, adres: "", postcode: "", ...velden };
}

function factuur(velden: Partial<FactuurKlantGegevens> & { naam: string }): FactuurKlantGegevens {
  return { orgId: ORG, ...velden };
}

// Naar de echte gevallen uit de dev-klanten (okt 2026)
const KLANTEN: KlantKandidaat[] = [
  klant("dohmen", { naam: "Pierre Dohmen", adres: "Dijk 24A", postcode: "6127 AG", email: "p.dohmen@example.nl" }),
  klant("sanden", { naam: "Annemiek van der Sanden", adres: "Dijk 24A", postcode: "6127 AG", klantnummer: "1003" }),
  klant("buckx-bv", { naam: "Buckx Decor Verhuur", adres: "Markt 3", postcode: "6121 XA", klantnummer: "10003", kvkNummer: "12345678" }),
  klant("buckx", { naam: "Peter Buckx", adres: "Markt 3", postcode: "6121 XA", klantnummer: "1091" }),
  klant("vve-a", { naam: "VvE Ir. Lelystraat / Frankenlaan", adres: "Lelystraat 1", postcode: "6131 AA", email: "beheer@hetonvve.nl" }),
  klant("vve-b", { naam: "VvE Engelenkampstraat Sittard", adres: "Engelenkampstraat 2", postcode: "6131 BB", email: "beheer@hetonvve.nl" }),
  klant("meijer", { naam: "Sandra Meijer", adres: "Kerkstraat 39", postcode: "6127 EK" }),
  klant("meijers", { naam: "Sandra Meijers", adres: "Kerkstraat 39", postcode: "6127 EK" }),
  klant("frissen", { naam: "Bouwbedrijf Frissen B.V.", adres: "Industrieweg 33", postcode: "6135 KK", btwNummer: "NL001234567B01" }),
];

describe("naamOvereenkomst", () => {
  it("ziet volgorde, hoofdletters, rechtsvorm en aanhef niet als verschil", () => {
    expect(naamOvereenkomst("Janssen, Harrie", "harrie janssen")).toBe("gelijk");
    expect(naamOvereenkomst("Bouwbedrijf Frissen", "Bouwbedrijf Frissen B.V.")).toBe("gelijk");
    expect(naamOvereenkomst("Dhr. Harrie Janssen", "Harrie Janssen")).toBe("gelijk");
  });

  it("noemt een tikfout of voorletters 'lijkt'", () => {
    expect(naamOvereenkomst("Sandra Meijer", "Sandra Meijers")).toBe("lijkt");
    expect(naamOvereenkomst("H. Janssen", "Harrie Janssen")).toBe("lijkt");
    expect(naamOvereenkomst("Fam. van der Sanden", "Annemiek van der Sanden")).toBe("lijkt");
  });

  it("houdt andere namen apart, ook met een gedeeld tussenvoegsel", () => {
    expect(naamOvereenkomst("Pierre Dohmen", "Annemiek van der Sanden")).toBe("anders");
    expect(naamOvereenkomst("van Dijk", "van der Sanden")).toBe("anders");
    expect(naamOvereenkomst("", "Pierre Dohmen")).toBe("anders");
  });
});

describe("huisnummerUitAdres", () => {
  it("haalt nummer en letter uit de adresregel", () => {
    expect(huisnummerUitAdres("Dijk 24A")).toBe("24A");
    expect(huisnummerUitAdres("Dijk 24 a")).toBe("24A");
    expect(huisnummerUitAdres("Hoofdstraat 12-3")).toBe("12");
    expect(huisnummerUitAdres("Kerkstraat 7 bus 2")).toBe("7");
    expect(huisnummerUitAdres("Zonder nummer")).toBe("");
  });
});

describe("matchFactuurKlant — keten", () => {
  it("koppelt zeker via de offerte, ook als het klantblok iets anders zegt", () => {
    const uit = matchFactuurKlant(
      factuur({ naam: "Iemand Anders", offerteKlantId: "dohmen" }),
      KLANTEN
    );
    expect(uit.niveau).toBe("zeker");
    expect(uit.klantId).toBe("dohmen");
  });

  it("vraagt bevestiging als offerte en project verschillende klanten noemen", () => {
    const uit = matchFactuurKlant(
      factuur({ naam: "Pierre Dohmen", offerteKlantId: "dohmen", projectKlantId: "sanden" }),
      KLANTEN
    );
    expect(uit.niveau).toBe("waarschijnlijk");
    expect(uit.klantId).toBeUndefined();
    expect(uit.kandidaten.map((k) => k.klantId)).toEqual(["dohmen", "sanden"]);
  });

  it("negeert een ketenklant van een andere org", () => {
    const vreemd = klant("vreemd", { naam: "Pierre Dohmen", orgId: ANDERE_ORG });
    const uit = matchFactuurKlant(
      factuur({ naam: "Onbekend", offerteKlantId: "vreemd" }),
      [...KLANTEN, vreemd]
    );
    expect(uit.niveau).toBe("geen");
  });
});

describe("matchFactuurKlant — signalen", () => {
  it("koppelt zeker op relatienummer, ook met voorloopnullen", () => {
    const uit = matchFactuurKlant(
      factuur({ naam: "A. van der Sanden", klantnummer: "01003" }),
      KLANTEN
    );
    expect(uit.niveau).toBe("zeker");
    expect(uit.klantId).toBe("sanden");
  });

  it("maakt van relatienummer + andere naam alleen een voorstel", () => {
    const uit = matchFactuurKlant(factuur({ naam: "Pierre Dohmen", klantnummer: "1003" }), KLANTEN);
    expect(uit.niveau).toBe("waarschijnlijk");
    expect(uit.klantId).toBeUndefined();
    expect(uit.kandidaten[0].redenen).toContain("naam wijkt af");
  });

  it("koppelt zeker op KvK of btw-nummer", () => {
    expect(matchFactuurKlant(factuur({ naam: "Buckx", kvkNummer: "1234 5678" }), KLANTEN).klantId).toBe("buckx-bv");
    expect(
      matchFactuurKlant(factuur({ naam: "Frissen", btwNummer: "nl 0012.34.567.b01" }), KLANTEN).klantId
    ).toBe("frissen");
  });

  it("onderscheidt twee klanten op één adres aan de naam", () => {
    const uit = matchFactuurKlant(
      factuur({ naam: "Pierre Dohmen", adres: "Dijk 24A", postcode: "6127AG" }),
      KLANTEN
    );
    expect(uit.niveau).toBe("zeker");
    expect(uit.klantId).toBe("dohmen");
  });

  it("koppelt nooit zeker op adres alleen", () => {
    const uit = matchFactuurKlant(
      factuur({ naam: "Nieuwe Bewoner", adres: "Dijk 24A", postcode: "6127 AG" }),
      KLANTEN
    );
    expect(uit.niveau).toBe("geen");
  });

  it("koppelt nooit zeker op een gedeelde mailbox", () => {
    const uit = matchFactuurKlant(factuur({ naam: "Het ON VvE-beheer", email: "Beheer@HetOnVvE.nl" }), KLANTEN);
    expect(uit.niveau).toBe("waarschijnlijk");
    expect(uit.klantId).toBeUndefined();
    expect(uit.kandidaten.map((k) => k.klantId).sort()).toEqual(["vve-a", "vve-b"]);
  });

  it("koppelt zeker op e-mail met dezelfde naam", () => {
    const uit = matchFactuurKlant(
      factuur({ naam: "VvE Engelenkampstraat Sittard", email: "beheer@hetonvve.nl" }),
      KLANTEN
    );
    expect(uit.niveau).toBe("zeker");
    expect(uit.klantId).toBe("vve-b");
  });

  it("kiest bij Meijer/Meijers de exacte naam en toont de ander als kandidaat", () => {
    const uit = matchFactuurKlant(
      factuur({ naam: "Sandra Meijer", adres: "Kerkstraat 39", postcode: "6127 EK" }),
      KLANTEN
    );
    expect(uit.niveau).toBe("zeker");
    expect(uit.klantId).toBe("meijer");
    expect(uit.kandidaten.map((k) => k.klantId)).toEqual(["meijer", "meijers"]);
  });

  it("zakt naar een voorstel als twee klanten allebei zeker zijn", () => {
    const dubbel = [...KLANTEN, klant("dohmen-2", { naam: "Pierre Dohmen", adres: "Dijk 24A", postcode: "6127 AG" })];
    const uit = matchFactuurKlant(
      factuur({ naam: "Pierre Dohmen", adres: "Dijk 24A", postcode: "6127 AG" }),
      dubbel
    );
    expect(uit.niveau).toBe("waarschijnlijk");
    expect(uit.klantId).toBeUndefined();
    expect(uit.kandidaten.every((k) => k.niveau === "waarschijnlijk")).toBe(true);
  });

  it("stelt voor op naam + postcode zonder huisnummer", () => {
    const uit = matchFactuurKlant(factuur({ naam: "P. Dohmen", postcode: "6127 AG" }), KLANTEN);
    expect(uit.niveau).toBe("waarschijnlijk");
    expect(uit.kandidaten[0].klantId).toBe("dohmen");
  });

  it("laat klanten van een andere org en geanonimiseerde klanten buiten beschouwing", () => {
    const extra = [
      klant("x-org", { naam: "Pierre Dohmen", orgId: ANDERE_ORG, klantnummer: "777" }),
      klant("gdpr", { naam: "Pierre Dohmen", klantnummer: "778", gdprAnonymized: true }),
    ];
    expect(matchFactuurKlant(factuur({ naam: "Pierre Dohmen", klantnummer: "777" }), extra).niveau).toBe("geen");
    expect(matchFactuurKlant(factuur({ naam: "Pierre Dohmen", klantnummer: "778" }), extra).niveau).toBe("geen");
  });

  it("geeft 'geen' bij een onbekende klant", () => {
    const uit = matchFactuurKlant(
      factuur({ naam: "Jan Onbekend", adres: "Nergens 1", postcode: "9999 ZZ" }),
      KLANTEN
    );
    expect(uit).toEqual({ niveau: "geen", kandidaten: [], toelichting: "Geen passende klant gevonden." });
  });
});
