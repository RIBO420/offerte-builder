/**
 * Unit tests vervallogica-engine (PRD §3.3, fase 2 stap 3)
 *
 * Test de pure kern uit convex/vervalLogica.ts:
 * - termijnBereikt: taak vanaf precies vervaldatum − termijn (grensgeval),
 *   ook ná de vervaldatum; jaargrens-wrap via addDagen/dagenTussen
 * - vervalTaakNodig: respecteert actief=false
 * - maakVervalSleutel: idempotentiesleutel `verval:{id}:{datum}` — nieuwe
 *   vervaldatum = nieuwe occurrence
 * - vervalTaakTekst: APK-voorbeeldscenario ("over 20 dagen moet de bus naar
 *   de APK"), morgen/vandaag/verlopen-varianten
 * - resolveVervalOntvanger: specifieke gebruiker > rol voorman > kantoor
 * - generalisatie: planningsattendering draait op dezelfde kern
 *   (her-export addDagen/dagenTussen + termijnBereikt) zonder gedragsbreuk
 * - mail-verbod: de vervallogica-modules importeren géén mail-infrastructuur
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  addDagen,
  dagenTussen,
  maakVervalSleutel,
  resolveVervalOntvanger,
  termijnBereikt,
  vervalTaakNodig,
  vervalTaakTekst,
  VERVAL_TYPE_LABEL,
} from "../../../../convex/vervalLogica";
import {
  addDagen as attenderingAddDagen,
  dagenTussen as attenderingDagenTussen,
  attenderingVandaagNodig,
} from "../../../../convex/planningsattendering";

const kern = (extra: Partial<Parameters<typeof vervalTaakNodig>[0]> = {}) => ({
  naam: "APK bus",
  type: "apk" as const,
  vervaldatum: "2026-07-30",
  waarschuwtermijnDagen: 20,
  actief: true,
  ...extra,
});

describe("datumhelpers (gedeelde engine-kern)", () => {
  it("addDagen telt op en trekt af, ook over de jaargrens", () => {
    expect(addDagen("2026-07-10", 20)).toBe("2026-07-30");
    expect(addDagen("2026-01-05", -10)).toBe("2025-12-26");
    expect(addDagen("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("dagenTussen is heel en tekent negatief voor het verleden", () => {
    expect(dagenTussen("2026-07-10", "2026-07-30")).toBe(20);
    expect(dagenTussen("2026-07-10", "2026-07-10")).toBe(0);
    expect(dagenTussen("2026-07-10", "2026-07-08")).toBe(-2);
    expect(dagenTussen("2025-12-26", "2026-01-05")).toBe(10);
  });
});

describe("termijnBereikt (generiek engine-criterium)", () => {
  it("wordt true op PRECIES doeldatum − termijn (grensgeval)", () => {
    const item = { doeldatum: "2026-07-30", termijnDagen: 20 };
    expect(termijnBereikt(item, "2026-07-09")).toBe(false); // 1 dag te vroeg
    expect(termijnBereikt(item, "2026-07-10")).toBe(true); // precies
    expect(termijnBereikt(item, "2026-07-11")).toBe(true); // daarna
  });

  it("blijft true ná de doeldatum (verlopen item blijft een taak waard)", () => {
    expect(
      termijnBereikt({ doeldatum: "2026-07-30", termijnDagen: 20 }, "2026-08-15")
    ).toBe(true);
  });

  it("termijn 0 = taak pas op de doeldatum zelf", () => {
    const item = { doeldatum: "2026-07-30", termijnDagen: 0 };
    expect(termijnBereikt(item, "2026-07-29")).toBe(false);
    expect(termijnBereikt(item, "2026-07-30")).toBe(true);
  });

  it("negatieve termijn wordt fail-closed als 0 behandeld", () => {
    expect(
      termijnBereikt({ doeldatum: "2026-07-30", termijnDagen: -5 }, "2026-07-29")
    ).toBe(false);
  });
});

describe("vervalTaakNodig", () => {
  it("volgt de termijn voor actieve items", () => {
    expect(vervalTaakNodig(kern(), "2026-07-09")).toBe(false);
    expect(vervalTaakNodig(kern(), "2026-07-10")).toBe(true);
  });

  it("respecteert actief=false — óók na de vervaldatum", () => {
    expect(vervalTaakNodig(kern({ actief: false }), "2026-07-10")).toBe(false);
    expect(vervalTaakNodig(kern({ actief: false }), "2026-09-01")).toBe(false);
  });
});

describe("maakVervalSleutel (idempotentie)", () => {
  it("volgt het bord-sleutelpatroon `verval:{id}:{datum}`", () => {
    expect(maakVervalSleutel("abc123", "2026-07-30")).toBe(
      "verval:abc123:2026-07-30"
    );
  });

  it("is stabiel per occurrence en verandert bij verlenging", () => {
    const a = maakVervalSleutel("abc123", "2026-07-30");
    expect(maakVervalSleutel("abc123", "2026-07-30")).toBe(a); // idempotent
    expect(maakVervalSleutel("abc123", "2027-07-30")).not.toBe(a); // verlengd
    expect(maakVervalSleutel("ander", "2026-07-30")).not.toBe(a);
  });
});

describe("vervalTaakTekst (PRD-voorbeeldscenario APK)", () => {
  const apk = {
    naam: "Bus VW Crafter (12-AB-34)",
    type: "apk" as const,
    vervaldatum: "2026-07-30",
  };

  it('zegt "over 20 dagen" — het §3.3-voorbeeld (Michel/APK)', () => {
    expect(vervalTaakTekst(apk, "2026-07-10")).toBe(
      "APK: Bus VW Crafter (12-AB-34) — verloopt over 20 dagen (2026-07-30)"
    );
  });

  it("kent morgen/vandaag/verlopen-varianten", () => {
    expect(vervalTaakTekst(apk, "2026-07-29")).toContain("verloopt morgen");
    expect(vervalTaakTekst(apk, "2026-07-30")).toContain("verloopt vandaag");
    expect(vervalTaakTekst(apk, "2026-08-02")).toContain(
      "is 3 dagen geleden verlopen"
    );
  });

  it("gebruikt het typelabel (keuring/certificaat/verzekering/anders)", () => {
    expect(VERVAL_TYPE_LABEL.keuring).toBe("Keuring");
    expect(
      vervalTaakTekst({ ...apk, type: "verzekering" }, "2026-07-10")
    ).toMatch(/^Verzekering:/);
  });
});

describe("resolveVervalOntvanger (specifieke gebruiker > rol > eigenaar)", () => {
  const normalize = (r: string | undefined | null) => r ?? "medewerker";
  const eigenaar = { _id: "eigenaar", role: "directie" };
  const voorman = { _id: "michel", role: "voorman" };
  const medewerker = { _id: "jan", role: "medewerker" };
  const iedereen = [eigenaar, voorman, medewerker];

  it("specifieke gebruiker wint van de rol", () => {
    expect(
      resolveVervalOntvanger(
        { ontvangerGebruikerId: "jan", ontvangerRol: "voorman" },
        iedereen,
        eigenaar,
        normalize
      )
    ).toBe(medewerker);
  });

  it('rol "voorman" → de voorman (Michel brengt de bus weg)', () => {
    expect(
      resolveVervalOntvanger(
        { ontvangerRol: "voorman" },
        iedereen,
        eigenaar,
        normalize
      )
    ).toBe(voorman);
  });

  it('rol "kantoor" (en default) → de eigenaar', () => {
    expect(
      resolveVervalOntvanger({ ontvangerRol: "kantoor" }, iedereen, eigenaar, normalize)
    ).toBe(eigenaar);
    expect(resolveVervalOntvanger({}, iedereen, eigenaar, normalize)).toBe(
      eigenaar
    );
  });

  it("valt terug op de eigenaar bij onbekende gebruiker of ontbrekende voorman", () => {
    expect(
      resolveVervalOntvanger(
        { ontvangerGebruikerId: "bestaat-niet" },
        iedereen,
        eigenaar,
        normalize
      )
    ).toBe(eigenaar);
    expect(
      resolveVervalOntvanger(
        { ontvangerRol: "voorman" },
        [eigenaar, medewerker],
        eigenaar,
        normalize
      )
    ).toBe(eigenaar);
  });
});

describe("generalisatie zonder attendering-breuk", () => {
  it("planningsattendering her-exporteert exact de gedeelde datumhelpers", () => {
    expect(attenderingAddDagen).toBe(addDagen);
    expect(attenderingDagenTussen).toBe(dagenTussen);
  });

  it("attenderingVandaagNodig gedraagt zich als vanouds op de kern", () => {
    const beurt = {
      ritme: { type: "vaste_datum" as const, maand: 8, dag: 1 },
      volgendeVoorzieneDatum: "2026-08-01",
      attenderingDagenVooraf: 14,
    };
    // Ver voor het venster: geen attendering; erbinnen wel
    expect(
      attenderingVandaagNodig(
        beurt as Parameters<typeof attenderingVandaagNodig>[0],
        "2026-05-01"
      )
    ).toBeNull();
    expect(
      attenderingVandaagNodig(
        beurt as Parameters<typeof attenderingVandaagNodig>[0],
        "2026-07-31"
      )
    ).not.toBeNull();
  });
});

describe("mail-verbod (§3.3: taken, geen mails)", () => {
  it("vervallogica- en machinepark-modules raken geen mail-infrastructuur", () => {
    const root = path.resolve(__dirname, "../../../../convex");
    for (const bestand of [
      "vervalLogica.ts",
      "vervalItems.ts",
      "machinepark.ts",
      "machineparkLogica.ts",
    ]) {
      const bron = fs.readFileSync(path.join(root, bestand), "utf8");
      expect(bron).not.toMatch(
        /resend|nodemailer|sendEmail|verstuurMail|zetTriggerMailKlaar|conceptMails|@react-email/i
      );
    }
  });
});
