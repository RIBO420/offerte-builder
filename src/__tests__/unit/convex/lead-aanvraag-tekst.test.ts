import { describe, it, expect } from "vitest";
import {
  aanvraagTekst,
  AANVRAAG_TEKST_MAX,
  type LeadVoorAanvraagTekst,
} from "../../../../convex/lib/leadAanvraagTekst";

function contactLead(
  overrides: Partial<LeadVoorAanvraagTekst> = {}
): LeadVoorAanvraagTekst {
  return {
    type: "contact",
    bron: "website_contact",
    referentie: "AV-2026-0042",
    specificaties: {
      onderwerp: "Tuinonderhoud",
      bericht: "Graag een offerte voor het onderhoud van onze achtertuin.",
      tuinoppervlak: "Groter dan 300 m²",
      onderhoudFrequentie: "Weet ik niet",
      hoeGevonden: "Google",
    },
    klantAdres: "Seringenlaan",
    klantHuisnummer: "78",
    klantPostcode: "6163 EZ",
    klantPlaats: "Geleen",
    indicatiePrijs: 0,
    fotoIds: ["s1", "s2", "s3"],
    ...overrides,
  };
}

describe("aanvraagTekst", () => {
  it("bouwt een contactaanvraag op met kop, velden, adres en fototelling", () => {
    const t = aanvraagTekst(contactLead());
    expect(t.split("\n")).toEqual([
      "Aanvraag via website contactformulier (AV-2026-0042)",
      "Onderwerp: Tuinonderhoud",
      "Bericht: Graag een offerte voor het onderhoud van onze achtertuin.",
      "Tuinoppervlak: Groter dan 300 m²",
      "Onderhoudsfrequentie: Weet ik niet",
      "Gevonden via: Google",
      "Adres aanvraag: Seringenlaan 78, 6163 EZ Geleen",
      "3 foto's bijgevoegd",
    ]);
  });

  it("slaat lege velden, prijs 0 en ontbrekende foto's over", () => {
    const t = aanvraagTekst(
      contactLead({
        specificaties: { onderwerp: "  ", bericht: "Hallo" },
        klantAdres: "",
        klantHuisnummer: undefined,
        klantPostcode: "",
        klantPlaats: "",
        fotoIds: [],
        indicatiePrijs: 0,
      })
    );
    expect(t).toBe(
      "Aanvraag via website contactformulier (AV-2026-0042)\nBericht: Hallo"
    );
  });

  it("gebruikt enkelvoud bij één foto en toont een indicatieprijs", () => {
    const t = aanvraagTekst(contactLead({ fotoIds: ["s1"], indicatiePrijs: 1750 }));
    expect(t).toContain("Indicatieprijs: € 1.750");
    expect(t).toContain("1 foto bijgevoegd");
  });

  it("beschrijft een gazonconfiguratie met ja/nee-velden", () => {
    const t = aanvraagTekst({
      type: "gazon",
      bron: "configurator_gazon",
      referentie: "GZ-7",
      specificaties: {
        oppervlakte: 120,
        typeGras: "Speelgazon",
        ondergrond: "Klei",
        drainage: false,
        opsluitbanden: true,
        opsluitbandenMeters: 40,
        gewensteStartdatum: "2026-10-01",
      },
      indicatiePrijs: 2300,
    });
    expect(t.split("\n")).toEqual([
      "Aanvraag via configurator (gazon) (GZ-7)",
      "Oppervlakte: 120 m²",
      "Type gras: Speelgazon",
      "Ondergrond: Klei",
      "Drainage: nee",
      "Opsluitbanden: ja (40 m)",
      "Gewenste startdatum: 2026-10-01",
      "Indicatieprijs: € 2.300",
    ]);
  });

  it("valt terug op een neutrale kop zonder bron en toont een onbekende bron letterlijk", () => {
    expect(
      aanvraagTekst({ type: "contact", referentie: "X-1", specificaties: {} })
    ).toBe("Aanvraag X-1");
    expect(
      aanvraagTekst({ type: "contact", bron: "beurs", referentie: "X-2", specificaties: {} })
    ).toBe("Aanvraag via beurs (X-2)");
  });

  it("kapt een te lang bericht af op het maximum", () => {
    const t = aanvraagTekst(
      contactLead({ specificaties: { bericht: "x".repeat(AANVRAAG_TEKST_MAX + 500) } })
    );
    expect(t.length).toBe(AANVRAAG_TEKST_MAX);
    expect(t.endsWith("…")).toBe(true);
  });
});
