/**
 * Vaste teksten op documenten (HERO-nabouw fase 2): placeholders vullen,
 * tikfouten weigeren, lege waarden houden het versturen tegen, en de
 * startset uit standaardteksten.md is foutloos.
 */

import { describe, it, expect } from "vitest";
import {
  DOCUMENT_SOORTEN,
  blokkadeMelding,
  bouwTekstWaarden,
  onbekendePlaceholders,
  vindPlaceholders,
  voorbeeldWaarden,
  vulDocumentTeksten,
  vulTekst,
} from "../../../../convex/lib/documentTekst";
import { STANDAARDTEKSTEN } from "../../../../convex/lib/standaardteksten";

describe("vulTekst", () => {
  it("vult bekende placeholders, ook met spaties binnen de haken", () => {
    const r = vulTekst("Beste {{ klant.naam }}, IBAN {{bedrijf.iban}}", {
      "klant.naam": "Jan",
      "bedrijf.iban": "NL01",
    });
    expect(r).toEqual({ tekst: "Beste Jan, IBAN NL01", ontbrekend: [], onbekend: [] });
  });

  it("een lege waarde blijft staan en komt in ontbrekend (test DOCUMENTEN-MODULE #3)", () => {
    const r = vulTekst("Over te maken op {{bedrijf.iban}}.", { "bedrijf.iban": "  " });
    expect(r.tekst).toBe("Over te maken op {{bedrijf.iban}}.");
    expect(r.ontbrekend).toEqual(["Bedrijf: IBAN"]);
    expect(blokkadeMelding(r.ontbrekend, r.onbekend)).toMatch(/Bedrijf: IBAN/);
  });

  it("een onbekende placeholder blijft staan en komt in onbekend", () => {
    const r = vulTekst("{{klant.nam}}", {});
    expect(r.onbekend).toEqual(["klant.nam"]);
    expect(blokkadeMelding(r.ontbrekend, r.onbekend)).toMatch(/\{\{klant\.nam\}\}/);
  });

  it("de oude notatie {{klant_naam}} blijft werken", () => {
    expect(vulTekst("Geachte {{klant_naam}},", { "klant.naam": "Jan" }).tekst).toBe(
      "Geachte Jan,"
    );
    expect(onbekendePlaceholders("{{klant_naam}}", "offerte_aanleg")).toEqual([]);
  });

  it("geen blokkade als alles gevuld is", () => {
    expect(blokkadeMelding([], [])).toBeUndefined();
  });
});

describe("onbekendePlaceholders", () => {
  it("weigert tikfouten en velden van een andere soort", () => {
    expect(onbekendePlaceholders("{{klant.nam}}", "factuur")).toEqual(["klant.nam"]);
    expect(onbekendePlaceholders("{{offerte.geldigTot}}", "factuur")).toEqual([
      "offerte.geldigTot",
    ]);
    expect(onbekendePlaceholders("{{factuur.vervaldatum}}", "factuur")).toEqual([]);
    // Zonder soort (tekst voor alle documenten) mag elk bekend veld
    expect(onbekendePlaceholders("{{offerte.geldigTot}}", undefined)).toEqual([]);
  });
});

describe("bouwTekstWaarden", () => {
  it("rekent geldig-tot uit de offertedatum en de geldigheid", () => {
    const datum = Date.UTC(2026, 9, 21, 10); // 21 okt 2026
    const w = bouwTekstWaarden({
      document: { nummer: "01400", datum, bedragInclBtw: 29805.27 },
      offerte: {
        geldigheidDagen: 30,
        termijnschema: [
          { percentage: 50, label: "na gunning" },
          { percentage: 30, label: "bij de start" },
          { percentage: 20, label: "bij oplevering" },
        ],
      },
      bedrijf: { adres: "Tuinweg 1", postcode: "1234 AB", plaats: "Groenstad", betaaltermijnDagen: 14 },
    });
    expect(w["document.datum"]).toBe("21 oktober 2026");
    expect(w["offerte.geldigTot"]).toBe("20 november 2026");
    expect(w["document.bedrag"]).toMatch(/29\.805,27/);
    expect(w["offerte.termijnschema"]).toBe(
      "- 50% na gunning\n- 30% bij de start\n- 20% bij oplevering"
    );
    expect(w["bedrijf.adres"]).toBe("Tuinweg 1, 1234 AB Groenstad");
    expect(w["bedrijf.betaaltermijn"]).toBe("14");
  });

  it("zonder geldigheid geen geldig-tot (dan blokkeert het versturen)", () => {
    const w = bouwTekstWaarden({ document: { datum: Date.now() } });
    expect(w["offerte.geldigTot"]).toBeUndefined();
  });
});

describe("startset (standaardteksten.md deel C)", () => {
  it("elke soort heeft precies één inleiding en één afsluiting", () => {
    for (const soort of DOCUMENT_SOORTEN) {
      for (const positie of ["inleiding", "afsluiting"] as const) {
        expect(
          STANDAARDTEKSTEN.filter((t) => t.documentSoort === soort && t.positie === positie),
          `${soort} ${positie}`
        ).toHaveLength(1);
      }
    }
  });

  it("bevat alleen geldige placeholders voor de eigen soort", () => {
    for (const t of STANDAARDTEKSTEN) {
      expect(onbekendePlaceholders(t.inhoud, t.documentSoort), t.naam).toEqual([]);
    }
  });

  it("is met voorbeeldwaarden volledig in te vullen", () => {
    for (const t of STANDAARDTEKSTEN) {
      const r = vulDocumentTeksten({ [t.positie]: t.inhoud }, voorbeeldWaarden());
      expect(r.ontbrekend, t.naam).toEqual([]);
      expect(vindPlaceholders(r.teksten[t.positie] ?? ""), t.naam).toEqual([]);
    }
  });

  it("typt geen IBAN, betaaltermijn of geldigheid in de tekst (K1, K2, K6)", () => {
    for (const t of STANDAARDTEKSTEN) {
      expect(t.inhoud).not.toMatch(/NL\d{2}[A-Z]{4}/);
      expect(t.inhoud).not.toMatch(/binnen \d+ dagen/);
      expect(t.inhoud).not.toMatch(/vier weken|één maand/);
    }
  });
});
