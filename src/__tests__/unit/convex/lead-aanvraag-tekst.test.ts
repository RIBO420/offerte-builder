import { describe, it, expect } from "vitest";
import {
  aanvraagTekst,
  parseAanvraagTekst,
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
  it("bouwt een contactaanvraag op met kop, kenmerken, adres en het bericht als laatste", () => {
    const t = aanvraagTekst(contactLead());
    expect(t.split("\n")).toEqual([
      "Aanvraag via website contactformulier (AV-2026-0042)",
      "Onderwerp: Tuinonderhoud",
      "Tuinoppervlak: Groter dan 300 m²",
      "Onderhoudsfrequentie: Weet ik niet",
      "Gevonden via: Google",
      "Adres aanvraag: Seringenlaan 78, 6163 EZ Geleen",
      "Bericht: Graag een offerte voor het onderhoud van onze achtertuin.",
    ]);
  });

  it("laat een omschrijving weg die het bericht herhaalt, maar toont een eigen omschrijving wel", () => {
    const dubbel = aanvraagTekst(
      contactLead({ omschrijving: "[Tuinonderhoud] Graag een offerte voor het onderhoud van onze achtertuin." })
    );
    expect(dubbel).not.toContain("[Tuinonderhoud]");
    const eigen = aanvraagTekst(contactLead({ omschrijving: "Grote tuin, vooral snoeiwerk" }));
    expect(eigen.split("\n")[1]).toBe("Grote tuin, vooral snoeiwerk");
  });

  it("plakt het huisnummer niet dubbel als het al in het adresveld staat", () => {
    const t = aanvraagTekst(contactLead({ klantAdres: "Seringenlaan 78", klantHuisnummer: "78" }));
    expect(t).toContain("Adres aanvraag: Seringenlaan 78, 6163 EZ Geleen");
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

  it("toont een indicatieprijs en telt de foto's niet in de tekst", () => {
    const t = aanvraagTekst(contactLead({ fotoIds: ["s1"], indicatiePrijs: 1750 }));
    expect(t).toContain("Indicatieprijs: € 1.750");
    expect(t).not.toContain("bijgevoegd");
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

describe("parseAanvraagTekst", () => {
  it("splitst een nieuwe tekst in kop, kenmerken en bericht", () => {
    const d = parseAanvraagTekst(aanvraagTekst(contactLead()));
    expect(d.kop).toBe("Aanvraag via website contactformulier (AV-2026-0042)");
    expect(d.kenmerken.map((k) => k.label)).toEqual([
      "Onderwerp",
      "Tuinoppervlak",
      "Onderhoudsfrequentie",
      "Gevonden via",
      "Adres aanvraag",
    ]);
    expect(d.bericht).toBe("Graag een offerte voor het onderhoud van onze achtertuin.");
    expect(d.overig).toEqual([]);
  });

  it("houdt een meerregelig bericht met dubbele punten bij elkaar", () => {
    const d = parseAanvraagTekst(
      aanvraagTekst(contactLead({ specificaties: { bericht: "Beste,\nLet op: hond los.\nGroet" } }))
    );
    expect(d.bericht).toBe("Beste,\nLet op: hond los.\nGroet");
    expect(d.kenmerken.map((k) => k.label)).toEqual(["Adres aanvraag"]);
  });
});
