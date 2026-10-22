import { describe, it, expect } from "vitest";
import { beschrijvingNaarBlokken } from "@/components/pdf/beschrijving-blokken";

describe("beschrijvingNaarBlokken (artikelbeschrijving op de PDF)", () => {
  it("leeg of alleen witruimte → geen blokken", () => {
    expect(beschrijvingNaarBlokken(undefined)).toEqual([]);
    expect(beschrijvingNaarBlokken(null)).toEqual([]);
    expect(beschrijvingNaarBlokken("")).toEqual([]);
    expect(beschrijvingNaarBlokken("  \n \n")).toEqual([]);
  });

  it("één alinea, regeleinden blijven behouden", () => {
    expect(
      beschrijvingNaarBlokken("Verwijderen van onkruid.\nBeurt uitgevoerd op 26.11.2025")
    ).toEqual([
      {
        soort: "alinea",
        regels: ["Verwijderen van onkruid.", "Beurt uitgevoerd op 26.11.2025"],
      },
    ]);
  });

  it("lege regels scheiden alinea's; meerdere lege regels tellen als één", () => {
    expect(beschrijvingNaarBlokken("Eerste.\n\n\n Tweede. \r\n\r\nDerde.")).toEqual([
      { soort: "alinea", regels: ["Eerste."] },
      { soort: "alinea", regels: ["Tweede."] },
      { soort: "alinea", regels: ["Derde."] },
    ]);
  });

  it('regels met "- ", "• " of "* " worden één opsomming', () => {
    expect(
      beschrijvingNaarBlokken(
        "Wij verzorgen:\n- Houtsoort: grenen\n• Aantal planken: 19\n* Montage met snelbeton"
      )
    ).toEqual([
      { soort: "kop", tekst: "Wij verzorgen:" },
      {
        soort: "opsomming",
        punten: ["Houtsoort: grenen", "Aantal planken: 19", "Montage met snelbeton"],
      },
    ]);
  });

  it("HERO-export: los streepje, lege regel, dan de tekst van het punt", () => {
    const hero =
      "Uitgevoerd tuinonderhoud, inclusief: \n- \n\nOnkruid bestrijden \n- \n\nSnoeiwerk \n- \n\nGroenafval afvoeren";
    expect(beschrijvingNaarBlokken(hero)).toEqual([
      { soort: "kop", tekst: "Uitgevoerd tuinonderhoud, inclusief:" },
      { soort: "opsomming", punten: ["Onkruid bestrijden", "Snoeiwerk", "Groenafval afvoeren"] },
    ]);
  });

  it("tekst na een opsomming (na lege regel) is weer een alinea; kopjes blijven alinea", () => {
    const tekst =
      "1) Grondwerk \n- \n\nUitzetten van lijnen. \n- \n\nAfvoeren grond. \n\n2) Terras \n- \n\nAanleggen terras.";
    expect(beschrijvingNaarBlokken(tekst)).toEqual([
      { soort: "alinea", regels: ["1) Grondwerk"] },
      { soort: "opsomming", punten: ["Uitzetten van lijnen.", "Afvoeren grond."] },
      { soort: "alinea", regels: ["2) Terras"] },
      { soort: "opsomming", punten: ["Aanleggen terras."] },
    ]);
  });

  it("ingesprongen regel direct onder een punt is het vervolg van dat punt", () => {
    expect(beschrijvingNaarBlokken("- Lang punt dat\n  doorloopt\nNieuwe alinea")).toEqual([
      { soort: "opsomming", punten: ["Lang punt dat doorloopt"] },
      { soort: "alinea", regels: ["Nieuwe alinea"] },
    ]);
  });

  it("een streepje zonder spatie is geen opsommingsteken (bv. -5%)", () => {
    expect(beschrijvingNaarBlokken("-5% korting op beplanting")).toEqual([
      { soort: "alinea", regels: ["-5% korting op beplanting"] },
    ]);
  });

  it("HTML-entiteiten uit HERO worden leesbare tekens", () => {
    expect(beschrijvingNaarBlokken("Hang &amp; sluitwerk, pergola&#039;s")).toEqual([
      { soort: "alinea", regels: ["Hang & sluitwerk, pergola's"] },
    ]);
  });

  it("een los teken zonder tekst erna levert geen leeg punt op", () => {
    expect(beschrijvingNaarBlokken("Tekst\n- \n")).toEqual([
      { soort: "alinea", regels: ["Tekst"] },
    ]);
  });

  it("opsommingstekens midden in de tekst worden een echte lijst (HERO: Afvoerkosten)", () => {
    const hero =
      "De afvoerkosten worden per onderhoudsbeurt berekend. Om de verrekening eerlijk te houden, hanteren wij onderstaande staffel: • Minder dan ¼ aanhanger: €15,00 • Tussen ¼ en ½ aanhanger: €27,50 • Tussen ½ en 1 volle aanhanger: €52,50 \nMeer dan 1 volle aanhanger: in overleg en naar rato berekend De prijs is inclusief:• Laden en afvoeren van het groenafval• Transport naar een erkende verwerker • Arbeidstijd voor het afvoeren De afvoerkosten worden per beurt vastgesteld.";
    expect(beschrijvingNaarBlokken(hero)).toEqual([
      {
        soort: "alinea",
        regels: [
          "De afvoerkosten worden per onderhoudsbeurt berekend. Om de verrekening eerlijk te houden, hanteren wij onderstaande staffel:",
        ],
      },
      {
        soort: "opsomming",
        punten: [
          "Minder dan ¼ aanhanger: €15,00",
          "Tussen ¼ en ½ aanhanger: €27,50",
          "Tussen ½ en 1 volle aanhanger: €52,50",
          "Meer dan 1 volle aanhanger: in overleg en naar rato berekend",
        ],
      },
      { soort: "kop", tekst: "De prijs is inclusief:" },
      {
        soort: "opsomming",
        punten: [
          "Laden en afvoeren van het groenafval",
          "Transport naar een erkende verwerker",
          "Arbeidstijd voor het afvoeren",
        ],
      },
      { soort: "alinea", regels: ["De afvoerkosten worden per beurt vastgesteld."] },
    ]);
  });

  it("een lange alinea wordt op zinsgrenzen opgedeeld, niet midden in 'ca. 88 m²'", () => {
    const zin = "Wij adviseren om de bestrating vier keer per jaar onkruidvrij te maken, vooral tijdens het groeiseizoen. ";
    const tekst = (zin + "Voor ca. 88 m² is dat een flinke klus met de borstelmachine. ").repeat(3).trim();
    const blokken = beschrijvingNaarBlokken(tekst);
    expect(blokken.length).toBeGreaterThan(1);
    for (const b of blokken) {
      expect(b.soort).toBe("alinea");
      if (b.soort === "alinea") {
        expect(b.regels[0].length).toBeLessThanOrEqual(260);
        expect(b.regels[0]).not.toMatch(/ca\.$/);
      }
    }
    expect(blokken.map((b) => (b.soort === "alinea" ? b.regels[0] : "")).join(" ")).toBe(tekst);
  });

  it("een lange zin met een dubbele punt aan het eind blijft een alinea, geen kopje", () => {
    const lang = "Om de verrekening eerlijk en transparant te houden, hanteren wij onderstaande staffel:";
    expect(beschrijvingNaarBlokken(lang)[0].soort).toBe("alinea");
  });
});
