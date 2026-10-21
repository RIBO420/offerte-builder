/**
 * Tijdbord (HERO-nabouw fase 4): kwartierstappen, verplaatsen, randen aan
 * beide kanten, voorstel uit de bak en geplande manuren
 * (acceptatiescenario's 1 en 2 uit PLANNING-MODULE.md).
 */

import { describe, it, expect } from "vitest";
import {
  STANDAARD_WERKDAG,
  afwezigLabel,
  afwezigOp,
  blokkeertInplannen,
  type BordAfwezigheid,
  geplandeManuren,
  minutenNaarTijd,
  schuif,
  snap,
  stapVoorKwartierBreedte,
  tijdNaarMinuten,
  trekEind,
  trekStart,
  vensterVan,
  verplaats,
  voorstelUitBak,
  type Plan,
} from "../../../../convex/tijdbordLogica";

const DI = "2026-10-20"; // dinsdag
const plan: Plan = {
  geplandeStart: DI,
  geplandeEind: "2026-10-21",
  geplandeStartTijd: "08:00",
  geplandeEindTijd: "16:00",
};

describe("tijden en stappen", () => {
  it("rekent HH:MM om en snapt op 15 minuten", () => {
    expect(tijdNaarMinuten("07:45")).toBe(465);
    expect(minutenNaarTijd(465)).toBe("07:45");
    expect(snap(8 * 60 + 7)).toBe(8 * 60);
    expect(snap(8 * 60 + 8)).toBe(8 * 60 + 15);
  });

  it("de stap is een kwartier, en 1 uur als een kwartier te smal wordt (nooit een dag)", () => {
    expect(stapVoorKwartierBreedte(10)).toBe(15);
    expect(stapVoorKwartierBreedte(1)).toBe(60);
  });
});

describe("slepen en vergroten (scenario 2)", () => {
  it("verplaatsen houdt dagen en vensterlengte", () => {
    expect(verplaats(plan, "2026-10-22", 9 * 60 + 15)).toEqual({
      geplandeStart: "2026-10-22",
      geplandeEind: "2026-10-23",
      geplandeStartTijd: "09:15",
      geplandeEindTijd: "17:15",
    });
  });

  it("rechterrand op de laatste dag verandert de eindtijd per kwartier", () => {
    expect(trekEind(plan, "2026-10-21", 16 * 60 + 15).geplandeEindTijd).toBe("16:15");
  });

  it("rechterrand naar een andere dag verandert het aantal dagen, niet de tijd", () => {
    const r = trekEind(plan, "2026-10-23", 10 * 60);
    expect(r.geplandeEind).toBe("2026-10-23");
    expect(r.geplandeEindTijd).toBe("16:00");
    // nooit vóór de eerste dag
    expect(trekEind(plan, "2026-10-19", 10 * 60).geplandeEind).toBe(DI);
  });

  it("linkerrand werkt net zo aan de beginkant", () => {
    expect(trekStart(plan, DI, 7 * 60 + 30).geplandeStartTijd).toBe("07:30");
    expect(trekStart(plan, "2026-10-19", 10 * 60).geplandeStart).toBe("2026-10-19");
  });

  it("een blok is minimaal een kwartier", () => {
    expect(trekEind(plan, "2026-10-21", 7 * 60).geplandeEindTijd).toBe("08:15");
    expect(trekStart(plan, DI, 17 * 60).geplandeStartTijd).toBe("15:45");
  });

  it("toetsenbord: ±15 minuten en ±1 dag", () => {
    expect(schuif(plan, 15, 0).geplandeStartTijd).toBe("08:15");
    expect(schuif(plan, 0, 1).geplandeStart).toBe("2026-10-21");
  });
});

describe("uit de bak (scenario 1)", () => {
  it("16 begrote uren, 1 man, dinsdag 08:00 → twee dagen 08:00–16:00", () => {
    expect(voorstelUitBak(DI, 8 * 60, 16, 1, STANDAARD_WERKDAG)).toEqual({
      geplandeStart: DI,
      geplandeEind: "2026-10-21",
      geplandeStartTijd: "08:00",
      geplandeEindTijd: "16:00",
    });
  });

  it("met 2 man past 16 uur in één dag", () => {
    expect(voorstelUitBak(DI, 8 * 60, 16, 2, STANDAARD_WERKDAG).geplandeEind).toBe(DI);
  });

  it("slaat het weekend over bij meerdere dagen", () => {
    expect(voorstelUitBak("2026-10-23", 8 * 60, 16, 1, STANDAARD_WERKDAG).geplandeEind).toBe(
      "2026-10-26"
    );
  });

  it("na 10:00 loslaten stopt het venster op het eind van de werkdag", () => {
    expect(voorstelUitBak(DI, 14 * 60, 4, 1, STANDAARD_WERKDAG).geplandeEindTijd).toBe("18:00");
  });
});

describe("begroot / gepland", () => {
  it("geplande manuren = werkdagen × venster × bemanning", () => {
    expect(geplandeManuren(plan, () => 1)).toBe(16);
    expect(geplandeManuren(plan, (d) => (d === DI ? 3 : 2))).toBe(40);
  });

  it("zonder vaste tijden geldt het standaardvenster vanaf de werkdagstart", () => {
    expect(vensterVan({}, STANDAARD_WERKDAG)).toEqual({ start: 420, eind: 900, vast: false });
  });
});

describe("verlof op het bord (ontwerpbeslissing 3)", () => {
  const lijst: BordAfwezigheid[] = [
    { medewerkerId: "jan", startDatum: "2026-10-26", eindDatum: "2026-10-30", status: "aangevraagd", soort: "vakantie" },
    { medewerkerId: "piet", startDatum: "2026-10-20", eindDatum: "2026-10-20", status: "goedgekeurd", soort: "bijzonder" },
    { medewerkerId: "kees", startDatum: "2026-10-19", eindDatum: "2026-10-25", status: "ziek" },
  ];

  it("een aanvraag waarschuwt, goedgekeurd verlof en ziekte blokkeren (scenario 5 en 9)", () => {
    expect(blokkeertInplannen("aangevraagd")).toBe(false);
    expect(blokkeertInplannen("goedgekeurd")).toBe(true);
    expect(blokkeertInplannen("ziek")).toBe(true);
  });

  it("vindt de afwezigheid op een dag", () => {
    expect(afwezigOp(lijst, "jan", "2026-10-27")?.status).toBe("aangevraagd");
    expect(afwezigOp(lijst, "jan", "2026-10-25")).toBeUndefined();
    expect(afwezigOp(lijst, "piet", "2026-10-20")?.status).toBe("goedgekeurd");
  });

  it("collega's zien alleen 'Afwezig', kantoor ziet de reden (scenario 11)", () => {
    expect(afwezigLabel(lijst[0])).toBe("Vakantie aangevraagd");
    expect(afwezigLabel({ ...lijst[0], soort: undefined })).toBe("Afwezig");
    expect(afwezigLabel(lijst[2])).toBe("Afwezig");
    expect(afwezigLabel({ ...lijst[2], soort: "ziek" })).toBe("Ziek");
  });
});
