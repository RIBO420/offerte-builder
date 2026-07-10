/**
 * Unit tests catalogus-laag onderhoud-wizard (PRD §2.5a + bijlage A)
 *
 * - Live doorrekening: frequentie × prijs per beurt → jaarprijs/maandbedrag,
 *   eenmalige bouwstenen apart (niet in het maandbedrag)
 * - Default-prijs uit de catalogus (normuren × uurtarief-op-datum / vast),
 *   handmatig overschrijfbaar per regel
 * - Pakket-tegels: preselectie per categorie, daarna vrij aanpasbaar
 * - Zand-keuzeregel (#17): twee prijzen, de keuze bepaalt de prijs
 * - Mapping naar offerte-regels (additief naast de bestaande engine)
 */

import { describe, it, expect } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  PAKKETTEN,
  LEGE_CATALOGUS_SELECTIE,
  berekenCatalogusTotalen,
  berekenRegelJaarprijs,
  bouwOfferteBouwsteenRegels,
  catalogusRegelsNaarOfferteRegels,
  defaultPrijsToelichting,
  effectievePrijsPerBeurt,
  hoortBijPakket,
  isEenmaligeSoort,
  pasPakketToe,
  type BouwsteenDefault,
  type CatalogusSelectie,
} from "../../lib/bouwsteen-offerte";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const id = (s: string) => s as unknown as Id<"bouwstenen">;

function bouwsteen(overrides: Partial<BouwsteenDefault> = {}): BouwsteenDefault {
  return {
    _id: id("b-maaien"),
    naam: "Gazon maaien",
    code: "GM",
    categorie: "gras_gazon",
    soort: "terugkerend",
    defaultFrequentiePerJaar: 26,
    urenPerBeurt: 1.5,
    prijsmodel: "uren",
    btwCode: 21,
    defaultPrijsPerBeurt: 1.5 * 65, // normuren × uurtarief-op-offertedatum
    uurtarief: 65,
    ...overrides,
  };
}

const maaien = bouwsteen();
const verticuteren = bouwsteen({
  _id: id("b-verticuteren"),
  naam: "Verticuteren",
  code: "VT",
  defaultFrequentiePerJaar: 2,
  vensterVanMaand: 3,
  vensterTotMaand: 10,
  defaultPrijsPerBeurt: 130,
});
const gazonanalyse = bouwsteen({
  _id: id("b-analyse"),
  naam: "Gazonanalyse",
  code: "GA",
  soort: "eenmalig",
  defaultFrequentiePerJaar: undefined,
  urenPerBeurt: 2,
  defaultPrijsPerBeurt: 130,
});
const reinigingsbeurt = bouwsteen({
  _id: id("b-reiniging"),
  naam: "Reinigingsbeurt",
  code: "RB",
  categorie: "reiniging",
  defaultFrequentiePerJaar: 2,
  defaultPrijsPerBeurt: 195,
  receptuurstappen: [
    { volgorde: 1, omschrijving: "Onkruid machinaal borstelen" },
    { volgorde: 2, omschrijving: "Reinigen (Biomix of hogedruk)" },
    { volgorde: 3, omschrijving: "Invegen" },
  ],
});
const zandKeuzeregel = bouwsteen({
  _id: id("b-zand"),
  naam: "Invegen — zand-keuzeregel",
  code: "IZ",
  categorie: "reiniging",
  soort: "keuzeregel",
  prijsmodel: "vast",
  urenPerBeurt: undefined,
  defaultFrequentiePerJaar: 2,
  defaultPrijsPerBeurt: 45,
  uurtarief: 65,
});
const voorjaarsbeurt = bouwsteen({
  _id: id("b-voorjaar"),
  naam: "Voorjaarsbeurt",
  code: "VJ",
  categorie: "seizoen",
  soort: "bundel",
  defaultFrequentiePerJaar: 1,
  defaultPrijsPerBeurt: 260,
});
const catalogus = [
  maaien,
  verticuteren,
  gazonanalyse,
  reinigingsbeurt,
  zandKeuzeregel,
  voorjaarsbeurt,
];

function selectieMet(
  overrides: Partial<CatalogusSelectie> = {}
): CatalogusSelectie {
  return { ...LEGE_CATALOGUS_SELECTIE, regels: {}, ...overrides };
}

const pakket = (pakketId: "onderhoud" | "reiniging" | "compleet") =>
  PAKKETTEN.find((p) => p.id === pakketId)!;

// ─── Doorrekening ────────────────────────────────────────────────────────────

describe("berekenCatalogusTotalen", () => {
  it("rekent frequentie × prijs per beurt door naar jaarprijs en maandbedrag", () => {
    const totalen = berekenCatalogusTotalen([
      { soort: "terugkerend", frequentiePerJaar: 26, prijsPerBeurt: 97.5 },
      { soort: "terugkerend", frequentiePerJaar: 2, prijsPerBeurt: 130 },
    ]);
    expect(totalen.jaarprijs).toBe(26 * 97.5 + 2 * 130); // 2795
    expect(totalen.maandbedrag).toBe(Math.round((2795 / 12) * 100) / 100);
    expect(totalen.eenmalig).toBe(0);
  });

  it("telt eenmalige bouwstenen als eenmalig bedrag, niet in het maandbedrag", () => {
    const totalen = berekenCatalogusTotalen([
      { soort: "terugkerend", frequentiePerJaar: 12, prijsPerBeurt: 100 },
      { soort: "eenmalig", frequentiePerJaar: 1, prijsPerBeurt: 130 },
      { soort: "op_afroep", frequentiePerJaar: 3, prijsPerBeurt: 80 },
    ]);
    expect(totalen.jaarprijs).toBe(1200);
    expect(totalen.maandbedrag).toBe(100);
    // eenmalig + op afroep: bedrag zelf, frequentie telt niet
    expect(totalen.eenmalig).toBe(130 + 80);
  });

  it("geeft nul-totalen zonder regels", () => {
    expect(berekenCatalogusTotalen([])).toEqual({
      jaarprijs: 0,
      maandbedrag: 0,
      eenmalig: 0,
    });
  });
});

describe("berekenRegelJaarprijs / isEenmaligeSoort", () => {
  it("terugkerend = frequentie × prijs, eenmalig = het bedrag zelf", () => {
    expect(
      berekenRegelJaarprijs({
        soort: "terugkerend",
        frequentiePerJaar: 4,
        prijsPerBeurt: 50,
      })
    ).toBe(200);
    expect(
      berekenRegelJaarprijs({
        soort: "eenmalig",
        frequentiePerJaar: 4,
        prijsPerBeurt: 50,
      })
    ).toBe(50);
  });

  it("kostenregels en bundels zijn terugkerend, eenmalig/op afroep niet", () => {
    expect(isEenmaligeSoort("terugkerend")).toBe(false);
    expect(isEenmaligeSoort("kostenregel")).toBe(false);
    expect(isEenmaligeSoort("bundel")).toBe(false);
    expect(isEenmaligeSoort("keuzeregel")).toBe(false);
    expect(isEenmaligeSoort("eenmalig")).toBe(true);
    expect(isEenmaligeSoort("op_afroep")).toBe(true);
  });
});

// ─── Default-prijs & handmatige override (leermodus, principe 6) ─────────────

describe("effectievePrijsPerBeurt", () => {
  it("gebruikt de catalogus-default (normuren × uurtarief-op-datum)", () => {
    const prijs = effectievePrijsPerBeurt(maaien, undefined, selectieMet());
    expect(prijs).toBe(97.5); // 1,5 uur × €65
  });

  it("laat een handmatige prijs per regel winnen van de default", () => {
    const prijs = effectievePrijsPerBeurt(
      maaien,
      { aan: true, frequentiePerJaar: 26, prijsPerBeurt: 85 },
      selectieMet()
    );
    expect(prijs).toBe(85);
  });

  it("zand-keuzeregel: de keuze bepaalt de prijs van de invegen-regel", () => {
    const selectie = selectieMet({
      zandKeuze: "straatzand",
      zandPrijzen: { voegzand: 60, straatzand: 35 },
    });
    expect(
      effectievePrijsPerBeurt(zandKeuzeregel, undefined, selectie)
    ).toBe(35);
    expect(
      effectievePrijsPerBeurt(zandKeuzeregel, undefined, {
        ...selectie,
        zandKeuze: "voegzand",
      })
    ).toBe(60);
  });

  it("zand-keuzeregel valt terug op de catalogus-default zonder ingevulde prijs", () => {
    expect(
      effectievePrijsPerBeurt(zandKeuzeregel, undefined, selectieMet())
    ).toBe(45);
  });

  it("zand-keuzeregel: catalogus-optieprijzen gaan vóór het enkele prijsveld (bijlage A #17)", () => {
    const metOptieprijzen = {
      ...zandKeuzeregel,
      optiePrijsVoegzand: 95,
      optiePrijsStraatzand: 75,
    };
    // Zonder handmatige invoer: per-optie-default uit de catalogus
    expect(
      effectievePrijsPerBeurt(metOptieprijzen, undefined, selectieMet())
    ).toBe(95);
    expect(
      effectievePrijsPerBeurt(
        metOptieprijzen,
        undefined,
        selectieMet({ zandKeuze: "straatzand" })
      )
    ).toBe(75);
    // Handmatige invoer wint van de optieprijs
    expect(
      effectievePrijsPerBeurt(
        metOptieprijzen,
        undefined,
        selectieMet({ zandPrijzen: { voegzand: 50, straatzand: null } })
      )
    ).toBe(50);
    // Beide offerte-prijzen krijgen de per-optie-default mee
    const regels = bouwOfferteBouwsteenRegels([metOptieprijzen], {
      ...selectieMet(),
      regels: {
        [metOptieprijzen._id]: {
          aan: true,
          frequentiePerJaar: 2,
          prijsPerBeurt: null,
        },
      },
    });
    expect(regels[0].zandKeuze).toEqual({
      keuze: "voegzand",
      prijsVoegzand: 95,
      prijsStraatzand: 75,
    });
  });
});

describe("defaultPrijsToelichting", () => {
  it("legt bij uurbasis uit: uren × uurtarief op offertedatum", () => {
    const tekst = defaultPrijsToelichting(maaien);
    expect(tekst).toContain("1.5 uur");
    expect(tekst).toContain("65.00");
    expect(tekst).toContain("97.50");
  });

  it("legt bij prijsmodel vast het vaste bedrag uit", () => {
    expect(defaultPrijsToelichting(zandKeuzeregel)).toContain("Vast bedrag");
  });
});

// ─── Pakket-tegels (bijlage A) ───────────────────────────────────────────────

describe("pakketten", () => {
  it("kent de drie tegels uit bijlage A", () => {
    expect(PAKKETTEN.map((p) => p.naam)).toEqual([
      "Onderhoud Tuin",
      "Reiniging",
      "Compleet",
    ]);
  });

  it("Onderhoud Tuin preselecteert groene terugkerende bouwstenen, geen reiniging", () => {
    const selectie = pasPakketToe(selectieMet(), pakket("onderhoud"), catalogus);
    expect(selectie.pakket).toBe("onderhoud");
    expect(selectie.regels[maaien._id].aan).toBe(true);
    expect(selectie.regels[verticuteren._id].aan).toBe(true);
    expect(selectie.regels[reinigingsbeurt._id].aan).toBe(false);
    expect(selectie.regels[zandKeuzeregel._id].aan).toBe(false);
    // eenmalig en bundel niet automatisch aan — vrij bij te schakelen
    expect(selectie.regels[gazonanalyse._id].aan).toBe(false);
    expect(selectie.regels[voorjaarsbeurt._id].aan).toBe(false);
  });

  it("Reiniging preselecteert de receptuur én de zand-keuzeregel", () => {
    const selectie = pasPakketToe(selectieMet(), pakket("reiniging"), catalogus);
    expect(selectie.regels[reinigingsbeurt._id].aan).toBe(true);
    expect(selectie.regels[zandKeuzeregel._id].aan).toBe(true);
    expect(selectie.regels[maaien._id].aan).toBe(false);
  });

  it("Compleet = onderhoud + reiniging", () => {
    const selectie = pasPakketToe(selectieMet(), pakket("compleet"), catalogus);
    expect(selectie.regels[maaien._id].aan).toBe(true);
    expect(selectie.regels[reinigingsbeurt._id].aan).toBe(true);
    expect(selectie.regels[zandKeuzeregel._id].aan).toBe(true);
  });

  it("neemt de default-frequentie uit de bouwsteen over en bewaart handmatige prijzen", () => {
    const metHandmatigePrijs = selectieMet({
      regels: {
        [maaien._id]: { aan: false, frequentiePerJaar: 20, prijsPerBeurt: 90 },
      },
    });
    const selectie = pasPakketToe(
      metHandmatigePrijs,
      pakket("onderhoud"),
      catalogus
    );
    expect(selectie.regels[maaien._id]).toEqual({
      aan: true,
      frequentiePerJaar: 20,
      prijsPerBeurt: 90,
    });
    expect(selectie.regels[verticuteren._id].frequentiePerJaar).toBe(2);
  });

  it("hoortBijPakket laat kostenregels buiten elke preselectie", () => {
    const kostenregel = bouwsteen({
      _id: id("b-voorrij"),
      naam: "Voorrijkosten",
      categorie: "kosten_regels",
      soort: "kostenregel",
    });
    for (const p of PAKKETTEN) {
      expect(hoortBijPakket(kostenregel, p)).toBe(false);
    }
  });
});

// ─── Naar offerte-record ─────────────────────────────────────────────────────

describe("bouwOfferteBouwsteenRegels", () => {
  it("bevat alleen aan-gezette regels, met prijs en btw uit de catalogus", () => {
    const selectie = selectieMet({
      regels: {
        [maaien._id]: { aan: true, frequentiePerJaar: 26, prijsPerBeurt: null },
        [verticuteren._id]: {
          aan: false,
          frequentiePerJaar: 2,
          prijsPerBeurt: null,
        },
      },
    });
    const regels = bouwOfferteBouwsteenRegels(catalogus, selectie);
    expect(regels).toHaveLength(1);
    expect(regels[0]).toMatchObject({
      bouwsteenId: maaien._id,
      naam: "Gazon maaien",
      frequentiePerJaar: 26,
      prijsPerBeurt: 97.5, // default: 1,5 uur × €65 op offertedatum
      prijsPerBeurtHandmatig: false,
      btwCode: 21,
      eenmalig: false,
    });
  });

  it("markeert handmatig overschreven prijzen en eenmalige soorten", () => {
    const selectie = selectieMet({
      regels: {
        [gazonanalyse._id]: {
          aan: true,
          frequentiePerJaar: 1,
          prijsPerBeurt: 150,
        },
      },
    });
    const [regel] = bouwOfferteBouwsteenRegels(catalogus, selectie);
    expect(regel.prijsPerBeurt).toBe(150);
    expect(regel.prijsPerBeurtHandmatig).toBe(true);
    expect(regel.eenmalig).toBe(true);
  });

  it("zand-keuzeregel: keuze + beide prijzen komen op de offerte-regel", () => {
    const selectie = selectieMet({
      zandKeuze: "voegzand",
      zandPrijzen: { voegzand: 60, straatzand: 35 },
      regels: {
        [zandKeuzeregel._id]: {
          aan: true,
          frequentiePerJaar: 2,
          prijsPerBeurt: null,
        },
      },
    });
    const [regel] = bouwOfferteBouwsteenRegels(catalogus, selectie);
    expect(regel.prijsPerBeurt).toBe(60); // keuze bepaalt de prijs
    expect(regel.zandKeuze).toEqual({
      keuze: "voegzand",
      prijsVoegzand: 60,
      prijsStraatzand: 35,
    });
  });

  it("slaat regels zonder enige prijs over (catalogus nog niet ingevuld)", () => {
    const zonderPrijs = bouwsteen({
      _id: id("b-leeg"),
      naam: "Nog te prijzen",
      urenPerBeurt: undefined,
      defaultPrijsPerBeurt: null,
    });
    const selectie = selectieMet({
      regels: {
        [zonderPrijs._id]: {
          aan: true,
          frequentiePerJaar: 1,
          prijsPerBeurt: null,
        },
      },
    });
    expect(bouwOfferteBouwsteenRegels([zonderPrijs], selectie)).toHaveLength(0);
  });
});

describe("catalogusRegelsNaarOfferteRegels", () => {
  it("mapt terugkerende regels naar hoeveelheid × prijs per beurt (marge 0)", () => {
    const [rij] = catalogusRegelsNaarOfferteRegels([
      {
        bouwsteenId: maaien._id,
        naam: "Gazon maaien",
        soort: "terugkerend",
        frequentiePerJaar: 26,
        prijsPerBeurt: 97.5,
        prijsPerBeurtHandmatig: false,
        btwCode: 21,
        eenmalig: false,
      },
    ]);
    expect(rij).toMatchObject({
      id: `bouwsteen-${maaien._id}`,
      scope: "catalogus",
      omschrijving: "Gazon maaien",
      eenheid: "beurt",
      hoeveelheid: 26,
      prijsPerEenheid: 97.5,
      totaal: 2535,
      type: "arbeid",
      margePercentage: 0,
    });
  });

  it("eenmalige regels krijgen hoeveelheid 1 en eenheid 'eenmalig'", () => {
    const [rij] = catalogusRegelsNaarOfferteRegels([
      {
        bouwsteenId: gazonanalyse._id,
        naam: "Gazonanalyse",
        soort: "eenmalig",
        frequentiePerJaar: 1,
        prijsPerBeurt: 130,
        prijsPerBeurtHandmatig: false,
        btwCode: 21,
        eenmalig: true,
      },
    ]);
    expect(rij.hoeveelheid).toBe(1);
    expect(rij.eenheid).toBe("eenmalig");
    expect(rij.totaal).toBe(130);
  });

  it("zet de zandkeuze in de omschrijving (herleidbaar op de offerte)", () => {
    const [rij] = catalogusRegelsNaarOfferteRegels([
      {
        bouwsteenId: zandKeuzeregel._id,
        naam: "Invegen — zand-keuzeregel",
        soort: "keuzeregel",
        frequentiePerJaar: 2,
        prijsPerBeurt: 35,
        prijsPerBeurtHandmatig: true,
        btwCode: 21,
        eenmalig: false,
        zandKeuze: {
          keuze: "straatzand",
          prijsVoegzand: 60,
          prijsStraatzand: 35,
        },
      },
    ]);
    expect(rij.omschrijving).toBe("Invegen — zand-keuzeregel — Straatzand");
    expect(rij.totaal).toBe(70);
  });
});
