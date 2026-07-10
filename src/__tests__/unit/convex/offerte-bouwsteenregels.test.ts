/**
 * Unit tests offerte→contract-keten met bouwsteen-regels (PRD §2.5a + §2.1)
 *
 * Test de pure businesslogica uit convex/onderhoudscontracten.ts:
 * - Gestructureerde offerte-bouwsteenregels → contractwerkzaamheden
 *   (exacte voorvulling, geen naam-matching nodig)
 * - Historische offertes behouden hun eigen tarief (§8.7): de prijs komt
 *   van de offerte zelf, niet opnieuw uit de catalogus
 * - Eenmalige regels genereren geen beurtenreeks (structuurregel 2)
 * - Default-prijs = normuren × uurtarief-op-datum (acceptatie §8.7)
 */

import { describe, it, expect } from "vitest";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
  offerteBouwsteenRegelsNaarWerkzaamheden,
  berekenJaarprijsBouwstenen,
  type OfferteBouwsteenRegelInput,
} from "../../../../convex/onderhoudscontracten";
import { berekenPrijsPerBeurt } from "../../../../convex/bouwstenen";
import { bepaalTariefOpDatum } from "../../../../convex/uurtarieven";

const id = (s: string) => s as unknown as Id<"bouwstenen">;

const bouwstenen = [
  {
    _id: id("b-maaien"),
    seizoensvensterVan: 3,
    seizoensvensterTot: 11,
    urenPerBeurt: 1.5,
  },
  { _id: id("b-analyse"), urenPerBeurt: 2 },
  { _id: id("b-zand") },
];

function regel(
  overrides: Partial<OfferteBouwsteenRegelInput> = {}
): OfferteBouwsteenRegelInput {
  return {
    bouwsteenId: id("b-maaien"),
    naam: "Gazon maaien",
    soort: "terugkerend",
    frequentiePerJaar: 26,
    prijsPerBeurt: 97.5,
    prijsPerBeurtHandmatig: false,
    eenmalig: false,
    ...overrides,
  };
}

describe("offerteBouwsteenRegelsNaarWerkzaamheden", () => {
  it("vult contractregels exact voor vanaf de offerte (bouwsteenId + frequentie + prijs)", () => {
    const [w] = offerteBouwsteenRegelsNaarWerkzaamheden([regel()], bouwstenen);
    expect(w).toEqual({
      omschrijving: "Gazon maaien",
      bouwsteenId: id("b-maaien"),
      frequentiePerJaar: 26,
      prijsPerBeurt: 97.5,
      prijsPerBeurtHandmatig: false,
      vensterVanMaand: 3, // seizoensvenster uit de bouwsteen (planbord §2.2)
      vensterTotMaand: 11,
      geschatteUrenPerBeurt: 1.5,
    });
  });

  it("behoudt het offerte-tarief — herberekent NIET met de actuele catalogusprijs (§8.7)", () => {
    // Offerte van vorig jaar: prijs per beurt €90 vastgelegd op de offerte.
    // Wat de catalogus vandaag ook zegt, het contract wordt met €90 voorgevuld.
    const [w] = offerteBouwsteenRegelsNaarWerkzaamheden(
      [regel({ prijsPerBeurt: 90, prijsPerBeurtHandmatig: true })],
      bouwstenen
    );
    expect(w.prijsPerBeurt).toBe(90);
    expect(w.prijsPerBeurtHandmatig).toBe(true);
  });

  it("eenmalige regels krijgen geen frequentiePerJaar → geen beurtenreeks (structuurregel 2)", () => {
    const [w] = offerteBouwsteenRegelsNaarWerkzaamheden(
      [
        regel({
          bouwsteenId: id("b-analyse"),
          naam: "Gazonanalyse",
          soort: "eenmalig",
          frequentiePerJaar: 1,
          prijsPerBeurt: 130,
          eenmalig: true,
        }),
      ],
      bouwstenen
    );
    expect(w.frequentiePerJaar).toBeUndefined();
    expect(w.prijsPerBeurt).toBe(130);
    expect(w.geschatteUrenPerBeurt).toBe(2);
  });

  it("zet de zandkeuze in de omschrijving van de contractregel", () => {
    const werkzaamheden = offerteBouwsteenRegelsNaarWerkzaamheden(
      [
        regel({
          bouwsteenId: id("b-zand"),
          naam: "Invegen — zand-keuzeregel",
          soort: "keuzeregel",
          frequentiePerJaar: 2,
          prijsPerBeurt: 35,
          zandKeuze: {
            keuze: "straatzand",
            prijsVoegzand: 60,
            prijsStraatzand: 35,
          },
        }),
        regel({
          bouwsteenId: id("b-zand"),
          naam: "Invegen — zand-keuzeregel",
          soort: "keuzeregel",
          frequentiePerJaar: 2,
          prijsPerBeurt: 60,
          zandKeuze: {
            keuze: "voegzand",
            prijsVoegzand: 60,
            prijsStraatzand: 35,
          },
        }),
      ],
      bouwstenen
    );
    expect(werkzaamheden[0].omschrijving).toBe(
      "Invegen — zand-keuzeregel — straatzand"
    );
    expect(werkzaamheden[1].omschrijving).toBe(
      "Invegen — zand-keuzeregel — onkruidvrij voegzand"
    );
  });

  it("blijft werken als de bouwsteen inmiddels gedeactiveerd is (venster onbekend)", () => {
    const [w] = offerteBouwsteenRegelsNaarWerkzaamheden(
      [regel({ bouwsteenId: id("b-verwijderd") })],
      bouwstenen
    );
    expect(w.bouwsteenId).toBe(id("b-verwijderd"));
    expect(w.vensterVanMaand).toBeUndefined();
    expect(w.geschatteUrenPerBeurt).toBe(0);
  });
});

describe("jaarprijs van de voorgevulde werkzaamheden", () => {
  it("telt alleen terugkerende regels mee (eenmalig heeft geen frequentie)", () => {
    const werkzaamheden = offerteBouwsteenRegelsNaarWerkzaamheden(
      [
        regel(), // 26 × 97,50
        regel({
          bouwsteenId: id("b-analyse"),
          naam: "Gazonanalyse",
          soort: "eenmalig",
          frequentiePerJaar: 1,
          prijsPerBeurt: 130,
          eenmalig: true,
        }),
      ],
      bouwstenen
    );
    expect(berekenJaarprijsBouwstenen(werkzaamheden)).toBe(26 * 97.5);
  });
});

describe("default-prijs met uurtarief-op-datum (acceptatie §8.7)", () => {
  const tarieven = [
    { bedrag: 65, ingangsdatum: "2026-01-01" },
    { bedrag: 70, ingangsdatum: "2026-07-01" },
  ];
  const maaienCatalogus = { prijsmodel: "uren" as const, urenPerBeurt: 1.5 };

  it("een offerte vóór de tariefwijziging rekent met het oude tarief", () => {
    const tarief = bepaalTariefOpDatum(tarieven, "2026-06-15");
    expect(berekenPrijsPerBeurt(maaienCatalogus, tarief!.bedrag)).toBe(97.5);
  });

  it("een offerte ná de tariefwijziging krijgt zonder deploy de nieuwe default", () => {
    const tarief = bepaalTariefOpDatum(tarieven, "2026-07-10");
    expect(berekenPrijsPerBeurt(maaienCatalogus, tarief!.bedrag)).toBe(105);
  });
});
