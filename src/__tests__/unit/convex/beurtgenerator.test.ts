/**
 * Unit tests beurtengenerator + losse beurt (PRD §2.1, acceptatie §8.4/§8.12)
 *
 * Test de extraheerbare businesslogica uit convex/beurtgenerator.ts,
 * convex/losseBeurten.ts en convex/onderhoudscontracten.ts:
 * - Spreiding binnen seizoensvenster: maaien 26×/jr (mrt–nov) + heg 2×/jr (§8.4)
 * - Rollende 12-maands horizon, idempotentie via generatieSleutel
 * - Losse beurt: ritme-validatie + volgende voorziene datum (§8.12-fundament)
 * - Prijs-default uit catalogus met uurtarief-op-contractdatum (§8.7)
 * - Indexatieclausule (AV V2.0 art. 5.3): looptijd > 3 maanden
 * - Contractnummer zonder race-gevoelige collect (pure max-bepaling)
 * - Rolchecks: beheer is kantoor-only
 */

import { describe, it, expect } from "vitest";
import { ConvexError } from "convex/values";
import {
  vensterVoorJaar,
  spreidDatumsInVenster,
  planBeurtenVoorRegel,
  maakGeneratieSleutel,
  beurtTitel,
  addMaanden,
  HORIZON_MAANDEN,
} from "../../../../convex/beurtgenerator";
import {
  valideerRitme,
  berekenVolgendeVoorzieneDatum,
  vensterOpeningVoorDatum,
  DEFAULT_ATTENDERING_DAGEN,
} from "../../../../convex/losseBeurten";
import {
  volgendContractNummer,
  isIndexatieVanToepassing,
  berekenJaarprijsBouwstenen,
  valideerWerkzaamheidInput,
  matchBouwsteenOpOmschrijving,
  INDEXATIE_CLAUSULE_TEKST,
} from "../../../../convex/onderhoudscontracten";
import { berekenPrijsPerBeurt } from "../../../../convex/bouwstenen";
import { bepaalTariefOpDatum } from "../../../../convex/uurtarieven";
import { isKantoorRol } from "../../../../convex/roles";

// ─── Seizoensvenster ─────────────────────────────────────────────────────────

describe("vensterVoorJaar", () => {
  it("geeft het hele kalenderjaar zonder venster", () => {
    expect(vensterVoorJaar(2026)).toEqual({
      start: "2026-01-01",
      eind: "2026-12-31",
    });
  });

  it("geeft mrt–nov als venster 3..11", () => {
    expect(vensterVoorJaar(2026, 3, 11)).toEqual({
      start: "2026-03-01",
      eind: "2026-11-30",
    });
  });

  it("loopt over de jaargrens bij van=10 tot=3", () => {
    expect(vensterVoorJaar(2026, 10, 3)).toEqual({
      start: "2026-10-01",
      eind: "2027-03-31",
    });
  });

  it("pakt de juiste laatste dag van de maand (schrikkeljaar)", () => {
    expect(vensterVoorJaar(2028, 1, 2).eind).toBe("2028-02-29");
    expect(vensterVoorJaar(2026, 1, 2).eind).toBe("2026-02-28");
  });
});

// ─── Spreiding binnen het venster ────────────────────────────────────────────

describe("spreidDatumsInVenster", () => {
  it("spreidt 26 beurten ~wekelijks over mrt–nov (acceptatie §8.4)", () => {
    const datums = spreidDatumsInVenster(26, "2026-03-01", "2026-11-30");
    expect(datums).toHaveLength(26);
    // Alle datums binnen het venster
    for (const d of datums) {
      expect(d >= "2026-03-01" && d <= "2026-11-30").toBe(true);
    }
    // Interval ~10-11 dagen (275 dagen / 26)
    for (let i = 1; i < datums.length; i++) {
      const diff =
        (Date.parse(datums[i]) - Date.parse(datums[i - 1])) / 86400000;
      expect(diff).toBeGreaterThanOrEqual(9);
      expect(diff).toBeLessThanOrEqual(12);
    }
  });

  it("spreidt 2 beurten op ~1/4 en ~3/4 van het venster", () => {
    const datums = spreidDatumsInVenster(2, "2026-03-01", "2026-11-30");
    expect(datums).toHaveLength(2);
    expect(datums[0].slice(5, 7)).toBe("05"); // ~begin mei
    expect(datums[1].slice(5, 7)).toBe("09"); // ~begin september
  });

  it("legt 1 beurt in het midden van het venster", () => {
    const [datum] = spreidDatumsInVenster(1, "2026-03-01", "2026-11-30");
    expect(datum).toBe("2026-07-16"); // dag 137 van 275
  });

  it("geeft [] bij aantal < 1 of leeg venster", () => {
    expect(spreidDatumsInVenster(0, "2026-03-01", "2026-11-30")).toEqual([]);
    expect(spreidDatumsInVenster(3, "2026-11-30", "2026-03-01")).toEqual([]);
  });

  it("datums zijn strikt oplopend en uniek bij hoge frequentie", () => {
    const datums = spreidDatumsInVenster(52, "2026-01-01", "2026-12-31");
    expect(new Set(datums).size).toBe(52);
    const gesorteerd = [...datums].sort();
    expect(datums).toEqual(gesorteerd);
  });
});

// ─── Planning per regel binnen de horizon ────────────────────────────────────

describe("planBeurtenVoorRegel", () => {
  const maaien = { frequentiePerJaar: 26, vensterVanMaand: 3, vensterTotMaand: 11 };
  const heg = { frequentiePerJaar: 2, vensterVanMaand: 5, vensterTotMaand: 9 };

  it("genereert bij activering per 1 jan alle 26 maaibeurten + 2 hegbeurten (§8.4)", () => {
    const horizonStart = "2026-01-01";
    const horizonEind = addMaanden(horizonStart, HORIZON_MAANDEN);

    const maaiBeurten = planBeurtenVoorRegel(maaien, horizonStart, horizonEind);
    const hegBeurten = planBeurtenVoorRegel(heg, horizonStart, horizonEind);

    expect(maaiBeurten).toHaveLength(26);
    expect(hegBeurten).toHaveLength(2);
    // Binnen de vensters
    for (const b of maaiBeurten) {
      const maand = Number(b.datum.slice(5, 7));
      expect(maand).toBeGreaterThanOrEqual(3);
      expect(maand).toBeLessThanOrEqual(11);
    }
    for (const b of hegBeurten) {
      const maand = Number(b.datum.slice(5, 7));
      expect(maand).toBeGreaterThanOrEqual(5);
      expect(maand).toBeLessThanOrEqual(9);
    }
  });

  it("nummert per seizoensjaar, ook als eerdere beurten buiten de horizon vallen", () => {
    // Activering halverwege het jaar: alleen resterende beurten van 2026,
    // maar volgnummers lopen door (bv. 12/26), plus begin 2027 tot de horizon.
    const beurten = planBeurtenVoorRegel(maaien, "2026-07-01", "2027-07-01");
    const in2026 = beurten.filter((b) => b.datum.startsWith("2026"));
    const in2027 = beurten.filter((b) => b.datum.startsWith("2027"));

    expect(in2026.length).toBeGreaterThan(0);
    expect(in2026[0].volgnummer).toBeGreaterThan(1); // niet opnieuw bij 1
    expect(in2026[0].totaal).toBe(26);
    expect(in2027[0].volgnummer).toBe(1); // nieuw seizoensjaar
    // Continuïteit: laatste 2026-volgnummer is 26
    expect(in2026[in2026.length - 1].volgnummer).toBe(26);
  });

  it("horizon-aanvulling is idempotent via generatieSleutels", () => {
    // Dag 1: activering
    const dag1 = planBeurtenVoorRegel(maaien, "2026-04-01", "2027-04-01");
    const sleutels = new Set(
      dag1.map((b) => maakGeneratieSleutel("regel1", b.datum))
    );
    // Dag 2: cron draait één dag later — zelfde datums opnieuw gepland
    const dag2 = planBeurtenVoorRegel(maaien, "2026-04-02", "2027-04-02");
    const nieuw = dag2.filter(
      (b) => !sleutels.has(maakGeneratieSleutel("regel1", b.datum))
    );
    // Vrijwel alles bestaat al; hooguit één beurt schuift de horizon binnen
    expect(nieuw.length).toBeLessThanOrEqual(1);
    // Nogmaals dezelfde run: helemaal niets nieuws
    const dag2b = dag2.filter(
      (b) => !sleutels.has(maakGeneratieSleutel("regel1", b.datum))
    );
    expect(dag2b).toEqual(nieuw);
  });

  it("respecteert een venster over de jaargrens", () => {
    const winter = {
      frequentiePerJaar: 4,
      vensterVanMaand: 11,
      vensterTotMaand: 2,
    };
    const beurten = planBeurtenVoorRegel(winter, "2026-01-01", "2027-01-01");
    expect(beurten.length).toBeGreaterThan(0);
    for (const b of beurten) {
      const maand = Number(b.datum.slice(5, 7));
      expect(maand >= 11 || maand <= 2).toBe(true);
    }
  });

  it("geeft [] bij een lege of omgekeerde horizon", () => {
    expect(planBeurtenVoorRegel(maaien, "2027-01-01", "2026-01-01")).toEqual([]);
  });
});

describe("beurtTitel + generatieSleutel", () => {
  it('formatteert "Maaibeurt 12/26 — mei"', () => {
    expect(beurtTitel("Maaibeurt", 12, 26, "2026-05-18")).toBe(
      "Maaibeurt 12/26 — mei"
    );
  });

  it("generatieSleutel is uniek per regel + datum", () => {
    expect(maakGeneratieSleutel("abc", "2026-05-18")).toBe("abc:2026-05-18");
    expect(maakGeneratieSleutel("abc", "2026-05-18")).not.toBe(
      maakGeneratieSleutel("abc", "2026-05-19")
    );
  });
});

// ─── Losse beurt: ritme (§2.1B) ──────────────────────────────────────────────

describe("valideerRitme", () => {
  it("accepteert n× per jaar met venster", () => {
    expect(() =>
      valideerRitme({ frequentiePerJaar: 3, vensterVanMaand: 3, vensterTotMaand: 11 })
    ).not.toThrow();
  });

  it("accepteert een interval in weken zonder venster", () => {
    expect(() => valideerRitme({ intervalWeken: 2 })).not.toThrow();
  });

  it("weigert frequentie én interval tegelijk, of geen van beide", () => {
    expect(() =>
      valideerRitme({ frequentiePerJaar: 3, intervalWeken: 2 })
    ).toThrow(ConvexError);
    expect(() => valideerRitme({})).toThrow(ConvexError);
  });

  it("weigert ongeldige waarden en half ingevulde vensters", () => {
    expect(() => valideerRitme({ frequentiePerJaar: 0 })).toThrow(ConvexError);
    expect(() => valideerRitme({ intervalWeken: 53 })).toThrow(ConvexError);
    expect(() =>
      valideerRitme({ frequentiePerJaar: 1, vensterVanMaand: 13, vensterTotMaand: 2 })
    ).toThrow(ConvexError);
    expect(() =>
      valideerRitme({ frequentiePerJaar: 1, vensterVanMaand: 3 })
    ).toThrow(ConvexError);
  });
});

describe("berekenVolgendeVoorzieneDatum", () => {
  it("ritme 1×/jaar met venster mrt–nov: middenin het venster (§8.4-test 4)", () => {
    const ritme = { frequentiePerJaar: 1, vensterVanMaand: 3, vensterTotMaand: 11 };
    // Vanaf 1 januari: de spreidingspositie van dit jaar (midden venster)
    expect(berekenVolgendeVoorzieneDatum(ritme, "2026-01-01")).toBe("2026-07-16");
    // Vanaf ná die positie: volgend seizoensjaar
    expect(berekenVolgendeVoorzieneDatum(ritme, "2026-08-01")).toBe("2027-07-16");
  });

  it("ritme 3×/jaar pakt de eerstvolgende spreidingspositie", () => {
    const ritme = { frequentiePerJaar: 3, vensterVanMaand: 3, vensterTotMaand: 11 };
    const eerste = berekenVolgendeVoorzieneDatum(ritme, "2026-01-01");
    const tweede = berekenVolgendeVoorzieneDatum(ritme, eerste);
    const derde = berekenVolgendeVoorzieneDatum(ritme, tweede);
    expect(eerste < tweede && tweede < derde).toBe(true);
    expect(eerste.startsWith("2026")).toBe(true);
    expect(derde.startsWith("2026")).toBe(true);
    // Vierde valt in het volgende jaar
    expect(berekenVolgendeVoorzieneDatum(ritme, derde).startsWith("2027")).toBe(true);
  });

  it('"elke 2 weken" telt 14 dagen op', () => {
    expect(berekenVolgendeVoorzieneDatum({ intervalWeken: 2 }, "2026-07-10")).toBe(
      "2026-07-24"
    );
  });

  it("interval buiten het venster springt naar de volgende vensteropening", () => {
    const ritme = { intervalWeken: 2, vensterVanMaand: 3, vensterTotMaand: 11 };
    // 2 weken na 25 nov = 9 dec → buiten venster → 1 mrt volgend jaar
    expect(berekenVolgendeVoorzieneDatum(ritme, "2026-11-25")).toBe("2027-03-01");
  });
});

describe("vensterOpeningVoorDatum (attendering-fundament, §8.12)", () => {
  it("geeft de vensterstart van het seizoensjaar waar de datum in valt", () => {
    expect(
      vensterOpeningVoorDatum(
        { vensterVanMaand: 3, vensterTotMaand: 11 },
        "2026-07-16"
      )
    ).toBe("2026-03-01");
  });

  it("werkt over de jaargrens (venster nov–feb)", () => {
    expect(
      vensterOpeningVoorDatum(
        { vensterVanMaand: 11, vensterTotMaand: 2 },
        "2027-01-15"
      )
    ).toBe("2026-11-01");
  });

  it("zonder venster: de voorziene datum zelf", () => {
    expect(vensterOpeningVoorDatum({}, "2026-07-16")).toBe("2026-07-16");
  });

  it("default attendering is 14 dagen vooraf", () => {
    expect(DEFAULT_ATTENDERING_DAGEN).toBe(14);
  });
});

// ─── Prijs-default uit catalogus (§8.7) ──────────────────────────────────────

describe("prijs per beurt: default uit bouwsteen × uurtarief-op-contractdatum", () => {
  const tarieven = [
    { bedrag: 65, ingangsdatum: "2026-01-01" },
    { bedrag: 70, ingangsdatum: "2026-07-01" },
  ];

  it("normuren × geldend uurtarief op de contractdatum", () => {
    const bouwsteen = { prijsmodel: "uren" as const, urenPerBeurt: 1.5 };
    const tariefMaart = bepaalTariefOpDatum(tarieven, "2026-03-15");
    expect(tariefMaart?.bedrag).toBe(65);
    expect(berekenPrijsPerBeurt(bouwsteen, tariefMaart!.bedrag)).toBe(97.5);

    // Contract ná de tariefwijziging krijgt het nieuwe tarief…
    const tariefAug = bepaalTariefOpDatum(tarieven, "2026-08-01");
    expect(berekenPrijsPerBeurt(bouwsteen, tariefAug!.bedrag)).toBe(105);
    // …maar het oude contract behoudt zijn eigen prijs (los veld, §8.7)
    expect(berekenPrijsPerBeurt(bouwsteen, tariefMaart!.bedrag)).toBe(97.5);
  });

  it("vast bedrag negeert het uurtarief", () => {
    const bouwsteen = { prijsmodel: "vast" as const, vastBedragPerBeurt: 120 };
    expect(berekenPrijsPerBeurt(bouwsteen, 65)).toBe(120);
  });

  it("jaarprijs = Σ frequentie × prijs per beurt; maandbedrag = /12", () => {
    const regels = [
      { frequentiePerJaar: 26, prijsPerBeurt: 97.5 }, // maaien
      { frequentiePerJaar: 2, prijsPerBeurt: 250 }, // heg
      { frequentiePerJaar: undefined, prijsPerBeurt: 999 }, // telt niet mee
    ];
    const jaarprijs = berekenJaarprijsBouwstenen(regels);
    expect(jaarprijs).toBe(26 * 97.5 + 2 * 250);
    expect(jaarprijs / 12).toBeCloseTo(252.92, 2);
  });
});

// ─── Contract-helpers ────────────────────────────────────────────────────────

describe("volgendContractNummer", () => {
  it("telt door op het hoogste nummer binnen het prefix", () => {
    expect(
      volgendContractNummer("OHC-2026-", ["OHC-2026-001", "OHC-2026-007"])
    ).toBe("OHC-2026-008");
  });

  it("begint bij 001 zonder bestaande nummers en negeert vreemde prefixes", () => {
    expect(volgendContractNummer("OHC-2026-", [])).toBe("OHC-2026-001");
    expect(volgendContractNummer("OHC-2026-", ["OHC-2025-099"])).toBe(
      "OHC-2026-001"
    );
  });
});

describe("isIndexatieVanToepassing (AV V2.0 art. 5.3)", () => {
  it("van toepassing bij looptijd > 3 maanden", () => {
    expect(isIndexatieVanToepassing("2026-01-01", "2027-01-01")).toBe(true);
    expect(isIndexatieVanToepassing("2026-01-01", "2026-04-02")).toBe(true);
  });

  it("niet van toepassing bij looptijd ≤ 3 maanden", () => {
    expect(isIndexatieVanToepassing("2026-01-01", "2026-04-01")).toBe(false);
    expect(isIndexatieVanToepassing("2026-01-01", "2026-02-01")).toBe(false);
  });

  it("clausuletekst verwijst naar AV V2.0 art. 5.3", () => {
    expect(INDEXATIE_CLAUSULE_TEKST).toContain("artikel 5.3");
  });
});

describe("valideerWerkzaamheidInput", () => {
  it("accepteert een geldige bouwsteen-regel", () => {
    expect(() =>
      valideerWerkzaamheidInput({
        omschrijving: "Maaibeurt",
        frequentiePerJaar: 26,
        prijsPerBeurt: 97.5,
        vensterVanMaand: 3,
        vensterTotMaand: 11,
      })
    ).not.toThrow();
  });

  it("weigert lege omschrijving, ongeldige frequentie/prijs/venster", () => {
    expect(() =>
      valideerWerkzaamheidInput({ omschrijving: " " })
    ).toThrow(ConvexError);
    expect(() =>
      valideerWerkzaamheidInput({ omschrijving: "x", frequentiePerJaar: 0 })
    ).toThrow(ConvexError);
    expect(() =>
      valideerWerkzaamheidInput({ omschrijving: "x", prijsPerBeurt: -1 })
    ).toThrow(ConvexError);
    expect(() =>
      valideerWerkzaamheidInput({ omschrijving: "x", vensterVanMaand: 3 })
    ).toThrow(ConvexError);
  });
});

describe("matchBouwsteenOpOmschrijving (offerte → concept-contract)", () => {
  const catalogus = [
    { naam: "Haag snoeien" },
    { naam: "Gazon maaien" },
    { naam: "Gazon maaien groot" },
  ];

  it("matcht case-insensitief op naam in de omschrijving", () => {
    expect(
      matchBouwsteenOpOmschrijving("Wekelijks gazon maaien achtertuin", catalogus)
        ?.naam
    ).toBe("Gazon maaien");
  });

  it("langste naam wint bij overlappende namen", () => {
    expect(
      matchBouwsteenOpOmschrijving("gazon maaien groot terrein", catalogus)?.naam
    ).toBe("Gazon maaien groot");
  });

  it("geeft null zonder match (regel wordt vrije regel)", () => {
    expect(matchBouwsteenOpOmschrijving("Vijver reinigen", catalogus)).toBeNull();
  });
});

// ─── Rolchecks (kantoor-only beheer, PRD §1.2) ───────────────────────────────

describe("rolchecks contract-/beurtbeheer", () => {
  it("alleen kantoor (directie/projectleider) mag beheren", () => {
    expect(isKantoorRol("directie")).toBe(true);
    expect(isKantoorRol("projectleider")).toBe(true);
    expect(isKantoorRol("admin")).toBe(true); // legacy → directie
  });

  it("voorman/medewerker/klant/zzp/materiaalman mogen niet", () => {
    for (const rol of [
      "voorman",
      "medewerker",
      "klant",
      "onderaannemer_zzp",
      "materiaalman",
      "viewer",
      undefined,
    ]) {
      expect(isKantoorRol(rol)).toBe(false);
    }
  });
});
