/**
 * Unit tests tekstblokkenbibliotheek (PRD §2.5b)
 *
 * Test de extraheerbare businesslogica uit convex/tekstblokken.ts en
 * convex/migrations/seedTekstblokken.ts:
 * - Validatie tekstblok-invoer (naam/inhoud verplicht, categorie, volgorde)
 * - Categorieën en labels (aanhef / voorwaarden / standaardtekst / e-mail)
 * - Rolchecks: beheer is kantoor-only
 * - Seed-startvulling: 3 neutrale blokken, platte tekst, unieke sleutels
 *   (basis van de idempotentie: overslaan op categorie + naam)
 */

import { describe, it, expect } from "vitest";
import { ConvexError } from "convex/values";
import {
  TEKSTBLOK_CATEGORIEEN,
  TEKSTBLOK_CATEGORIE_LABELS,
  valideerTekstblok,
  type TekstblokInvoer,
} from "../../../../convex/tekstblokken";
import { TEKSTBLOKKEN_STARTVULLING } from "../../../../convex/migrations/seedTekstblokken";
import { isKantoorRol } from "../../../../convex/roles";
import {
  TEKSTBLOK_CATEGORIEEN as UI_CATEGORIEEN,
  TEKSTBLOK_CATEGORIE_LABELS as UI_LABELS,
} from "@/lib/tekstblokken";

function geldigBlok(overrides: Partial<TekstblokInvoer> = {}): TekstblokInvoer {
  return {
    naam: "Standaard aanhef",
    categorie: "aanhef",
    inhoud: "Geachte heer/mevrouw,",
    ...overrides,
  };
}

// ─── Validatie ───────────────────────────────────────────────────────────────

describe("valideerTekstblok", () => {
  it("accepteert een geldig tekstblok (volgorde mag leeg)", () => {
    expect(() => valideerTekstblok(geldigBlok())).not.toThrow();
    expect(() => valideerTekstblok(geldigBlok({ volgorde: 3 }))).not.toThrow();
  });

  it("weigert een lege naam of lege inhoud", () => {
    expect(() => valideerTekstblok(geldigBlok({ naam: "  " }))).toThrow(
      ConvexError
    );
    expect(() => valideerTekstblok(geldigBlok({ inhoud: "\n \t" }))).toThrow(
      ConvexError
    );
  });

  it("weigert een onbekende categorie", () => {
    expect(() =>
      valideerTekstblok(geldigBlok({ categorie: "footer" }))
    ).toThrow(ConvexError);
  });

  it("weigert een negatieve volgorde", () => {
    expect(() => valideerTekstblok(geldigBlok({ volgorde: -1 }))).toThrow(
      ConvexError
    );
    expect(() => valideerTekstblok(geldigBlok({ volgorde: 0 }))).not.toThrow();
  });
});

// ─── Categorieën ─────────────────────────────────────────────────────────────

describe("tekstblok-categorieën", () => {
  it("kent precies de vier PRD-categorieën", () => {
    expect(TEKSTBLOK_CATEGORIEEN).toEqual([
      "aanhef",
      "voorwaarden",
      "standaardtekst",
      "email",
    ]);
  });

  it("heeft een label voor elke categorie", () => {
    for (const categorie of TEKSTBLOK_CATEGORIEEN) {
      expect(TEKSTBLOK_CATEGORIE_LABELS[categorie]).toBeTruthy();
    }
  });

  it("de UI-spiegel (src/lib/tekstblokken) loopt gelijk met de convex-constanten", () => {
    expect(UI_CATEGORIEEN).toEqual(TEKSTBLOK_CATEGORIEEN);
    expect(UI_LABELS).toEqual(TEKSTBLOK_CATEGORIE_LABELS);
  });
});

// ─── Rolchecks (kantoor-only beheer) ─────────────────────────────────────────

describe("rolchecks tekstblokken", () => {
  it("alleen kantoor (directie/projectleider) mag de bibliotheek beheren", () => {
    expect(isKantoorRol("directie")).toBe(true);
    expect(isKantoorRol("projectleider")).toBe(true);
    for (const rol of ["voorman", "medewerker", "klant", "onderaannemer_zzp"]) {
      expect(isKantoorRol(rol)).toBe(false);
    }
  });
});

// ─── Seed-startvulling ───────────────────────────────────────────────────────

describe("TEKSTBLOKKEN_STARTVULLING", () => {
  it("bevat 3 neutrale voorbeeldblokken die de validatie doorstaan", () => {
    expect(TEKSTBLOKKEN_STARTVULLING).toHaveLength(3);
    for (const record of TEKSTBLOKKEN_STARTVULLING) {
      expect(() => valideerTekstblok(record)).not.toThrow();
    }
  });

  it("heeft unieke sleutels (categorie + naam) — de basis van de idempotente seed", () => {
    const sleutels = TEKSTBLOKKEN_STARTVULLING.map(
      (record) => `${record.categorie}::${record.naam.trim().toLowerCase()}`
    );
    expect(new Set(sleutels).size).toBe(TEKSTBLOKKEN_STARTVULLING.length);
  });

  it("is platte tekst — geen HTML of markdown-opmaak (principe 3)", () => {
    for (const record of TEKSTBLOKKEN_STARTVULLING) {
      expect(record.inhoud).not.toMatch(/<[a-z][\s\S]*>/i);
      expect(record.inhoud).not.toMatch(/[*_#`]{2,}/);
    }
  });
});
