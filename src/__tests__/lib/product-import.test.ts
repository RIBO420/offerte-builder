/**
 * Unit tests kolommapping voor de productbestand-import (PRD §2.5c)
 *
 * Test src/lib/product-import.ts: getal-/btw-parsing (NL- en EN-notatie),
 * mapping-raad op de kopregel en het bouwen van import-rijen uit een
 * generiek CSV/Excel-bestand (geen voorbeeldbestand beschikbaar, §7.4 —
 * fixtures zijn zelfgemaakt).
 */

import { describe, it, expect } from "vitest";
import {
  parseGetal,
  parseBtwCode,
  raadMapping,
  bouwImportRijen,
} from "@/lib/product-import";

describe("parseGetal", () => {
  it("parseert NL-notatie (komma als decimaalteken)", () => {
    expect(parseGetal("12,50")).toBe(12.5);
    expect(parseGetal("1.234,56")).toBe(1234.56);
  });

  it("parseert EN-notatie (punt als decimaalteken)", () => {
    expect(parseGetal("12.50")).toBe(12.5);
    expect(parseGetal("1,234.56")).toBe(1234.56);
  });

  it("negeert valutatekens en whitespace", () => {
    expect(parseGetal("€ 45,00")).toBe(45);
    expect(parseGetal(" 3.5 ")).toBe(3.5);
  });

  it("geeft undefined voor lege of onleesbare cellen", () => {
    expect(parseGetal(undefined)).toBeUndefined();
    expect(parseGetal("")).toBeUndefined();
    expect(parseGetal("n.v.t.")).toBeUndefined();
  });
});

describe("parseBtwCode", () => {
  it("parseert '21', '21%' en '9,0' naar hele codes", () => {
    expect(parseBtwCode("21")).toBe(21);
    expect(parseBtwCode("21%")).toBe(21);
    expect(parseBtwCode("9,0")).toBe(9);
  });

  it("geeft undefined voor lege cellen", () => {
    expect(parseBtwCode("")).toBeUndefined();
  });
});

describe("raadMapping", () => {
  it("herkent gangbare kolomkoppen", () => {
    const mapping = raadMapping([
      "Artikelnaam",
      "Inkoopprijs",
      "Eenheid",
      "BTW",
    ]);
    expect(mapping.naam).toBe(0);
    expect(mapping.inkoopprijs).toBe(1);
    expect(mapping.eenheid).toBe(2);
    expect(mapping.btwCode).toBe(3);
  });

  it("wijs een kolom nooit aan twee velden toe", () => {
    const mapping = raadMapping(["Prijs"]);
    const indices = Object.values(mapping);
    expect(new Set(indices).size).toBe(indices.length);
  });
});

describe("bouwImportRijen", () => {
  const rijen = [
    ["Voorrijkosten", "45,00", "stuk", "21", "Vast tarief per bezoek"],
    ["Graszoden", "3,50", "m²", "9", ""],
    ["", "", "", "", ""], // lege rij → overslaan
    ["Artikel zonder prijs", "", "uur", "21", ""],
  ];
  const mapping = {
    naam: 0,
    inkoopprijs: 1,
    eenheid: 2,
    btwCode: 3,
    omschrijving: 4,
  };

  it("bouwt import-rijen volgens de mapping en slaat lege rijen over", () => {
    const resultaat = bouwImportRijen(rijen, mapping);
    expect(resultaat).toHaveLength(3);
    expect(resultaat[0]).toEqual({
      naam: "Voorrijkosten",
      inkoopprijs: 45,
      eenheid: "stuk",
      btwCode: 21,
      omschrijving: "Vast tarief per bezoek",
      categorie: undefined,
    });
    expect(resultaat[1].btwCode).toBe(9);
  });

  it("laat de inkoopprijs leeg (→ prijs op regel) bij een lege prijscel", () => {
    const resultaat = bouwImportRijen(rijen, mapping);
    expect(resultaat[2].naam).toBe("Artikel zonder prijs");
    expect(resultaat[2].inkoopprijs).toBeUndefined();
  });

  it("weigert een mapping zonder naam-kolom", () => {
    expect(() => bouwImportRijen(rijen, { inkoopprijs: 1 })).toThrow(
      /Naam/
    );
  });

  it("negeert niet-gemapte kolommen", () => {
    const resultaat = bouwImportRijen(rijen, { naam: 0 });
    expect(resultaat[0]).toEqual({
      naam: "Voorrijkosten",
      inkoopprijs: undefined,
      eenheid: undefined,
      btwCode: undefined,
      omschrijving: undefined,
      categorie: undefined,
    });
  });
});
