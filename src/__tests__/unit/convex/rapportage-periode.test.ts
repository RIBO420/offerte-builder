// @vitest-environment node
/**
 * R5 — eerlijke periodekiezer.
 *
 * De oude kiezer mapte 11 presets lossy op 4: "vorige maand" toonde déze
 * maand en "vorig jaar" gaf exact dezelfde cijfers als "dit jaar". Deze suite
 * legt de grenzen vast — vooral de seizoenen, want die lopen niet gelijk met
 * kwartalen en de winter loopt over de jaargrens heen.
 */

import { describe, it, expect } from "vitest";
import {
  bepaalPeriode,
  grenzenVan,
  laatsteSeizoenUitvoering,
  seizoenVan,
  vorigSeizoen,
  SEIZOEN_START_MAAND,
} from "../../../../convex/lib/rapportagePeriode";

/** 15 augustus 2026, midden in de zomer. */
const NU = new Date(2026, 7, 15, 12, 0, 0).getTime();

function datum(jaar: number, maand: number, dag: number): number {
  return new Date(jaar, maand, dag).getTime();
}

describe("seizoensgrenzen", () => {
  it("gebruikt meteorologische seizoenen van hele maanden", () => {
    expect(SEIZOEN_START_MAAND).toEqual({
      voorjaar: 2, // maart
      zomer: 5, // juni
      najaar: 8, // september
      winter: 11, // december
    });
  });

  it("voorjaar loopt van 1 maart tot 1 juni", () => {
    const { start, eind, label } = grenzenVan({
      soort: "seizoen",
      seizoen: "voorjaar",
      seizoenJaar: 2026,
    });
    expect(start).toBe(datum(2026, 2, 1));
    expect(eind).toBe(datum(2026, 5, 1));
    expect(label).toBe("Voorjaar 2026");
  });

  it("winter loopt over de jaargrens: 1 dec 2026 tot 1 mrt 2027", () => {
    const { start, eind, label } = grenzenVan({
      soort: "seizoen",
      seizoen: "winter",
      seizoenJaar: 2026,
    });
    expect(start).toBe(datum(2026, 11, 1));
    expect(eind).toBe(datum(2027, 2, 1));
    expect(label).toBe("Winter 2026/2027");
  });

  it("de vier seizoenen sluiten naadloos op elkaar aan", () => {
    const volgorde = [
      { seizoen: "voorjaar" as const, seizoenJaar: 2026 },
      { seizoen: "zomer" as const, seizoenJaar: 2026 },
      { seizoen: "najaar" as const, seizoenJaar: 2026 },
      { seizoen: "winter" as const, seizoenJaar: 2026 },
    ];
    for (let i = 0; i < volgorde.length - 1; i++) {
      const huidig = grenzenVan({ soort: "seizoen", ...volgorde[i] });
      const volgend = grenzenVan({ soort: "seizoen", ...volgorde[i + 1] });
      expect(huidig.eind).toBe(volgend.start);
    }
  });

  it("plaatst januari en februari in de winter van het vórige seizoensjaar", () => {
    expect(seizoenVan(datum(2027, 0, 15))).toEqual({
      seizoen: "winter",
      seizoenJaar: 2026,
    });
    expect(seizoenVan(datum(2027, 1, 28))).toEqual({
      seizoen: "winter",
      seizoenJaar: 2026,
    });
    expect(seizoenVan(datum(2026, 11, 5))).toEqual({
      seizoen: "winter",
      seizoenJaar: 2026,
    });
  });

  it("plaatst de randdagen van maart en mei in het voorjaar", () => {
    expect(seizoenVan(datum(2026, 2, 1)).seizoen).toBe("voorjaar");
    expect(seizoenVan(datum(2026, 4, 31)).seizoen).toBe("voorjaar");
    expect(seizoenVan(datum(2026, 5, 1)).seizoen).toBe("zomer");
  });

  it("het seizoen vóór het voorjaar is de winter van het jaar ervoor", () => {
    expect(vorigSeizoen("voorjaar", 2026)).toEqual({
      seizoen: "winter",
      seizoenJaar: 2025,
    });
    expect(vorigSeizoen("winter", 2026)).toEqual({
      seizoen: "najaar",
      seizoenJaar: 2026,
    });
  });

  it("kiest voor een nog niet begonnen seizoen de laatste uitvoering die wél liep", () => {
    // Op 15 aug 2026 is het najaar van 2026 nog niet begonnen.
    expect(laatsteSeizoenUitvoering("najaar", NU)).toEqual({
      seizoen: "najaar",
      seizoenJaar: 2025,
    });
    expect(laatsteSeizoenUitvoering("voorjaar", NU)).toEqual({
      seizoen: "voorjaar",
      seizoenJaar: 2026,
    });
  });
});

describe("bepaalPeriode", () => {
  it("dit-seizoen is in augustus de zomer, en loopt nog", () => {
    const periode = bepaalPeriode("dit-seizoen", NU);
    expect(periode.label).toBe("Zomer 2026");
    expect(periode.soort).toBe("seizoen");
    expect(periode.isLopend).toBe(true);
    expect(periode.voortgangFractie).toBeGreaterThan(0.5);
    expect(periode.voortgangFractie).toBeLessThan(1);
  });

  it("levert twee echte vergelijkingen bij een seizoen", () => {
    const periode = bepaalPeriode("dit-seizoen", NU);
    expect(periode.vorigePeriode?.label).toBe("Voorjaar 2026");
    expect(periode.zelfdePeriodeVorigJaar?.label).toBe("Zomer 2025");
    expect(periode.zelfdePeriodeVorigJaar?.start).toBe(datum(2025, 5, 1));
    expect(periode.zelfdePeriodeVorigJaar?.eind).toBe(datum(2025, 8, 1));
  });

  it("vorig-jaar geeft aantoonbaar een ander venster dan dit-jaar", () => {
    const ditJaar = bepaalPeriode("dit-jaar", NU);
    const vorigJaar = bepaalPeriode("vorig-jaar", NU);

    expect(ditJaar.label).toBe("2026");
    expect(vorigJaar.label).toBe("2025");
    expect(vorigJaar.start).not.toBe(ditJaar.start);
    expect(vorigJaar.eind).toBe(ditJaar.start);
    expect(ditJaar.isLopend).toBe(true);
    expect(vorigJaar.isLopend).toBe(false);
  });

  it("vorige-maand is juli, niet augustus", () => {
    const periode = bepaalPeriode("vorige-maand", NU);
    expect(periode.label).toBe("Juli 2026");
    expect(periode.start).toBe(datum(2026, 6, 1));
    expect(periode.eind).toBe(datum(2026, 7, 1));
    expect(periode.isLopend).toBe(false);
    expect(periode.voortgangFractie).toBe(1);
  });

  it("deze-maand vergelijkt met juli én met augustus vorig jaar", () => {
    const periode = bepaalPeriode("deze-maand", NU);
    expect(periode.label).toBe("Augustus 2026");
    expect(periode.vorigePeriode?.label).toBe("Juli 2026");
    expect(periode.zelfdePeriodeVorigJaar?.label).toBe("Augustus 2025");
  });

  it("rolt het kwartaal correct over de jaargrens", () => {
    const q1 = bepaalPeriode("dit-kwartaal", datum(2026, 1, 10));
    expect(q1.label).toBe("Q1 2026");
    expect(q1.vorigePeriode?.label).toBe("Q4 2025");
  });

  it("gebruikt bij aangepast de meegegeven grenzen en schuift kalendercorrect terug", () => {
    const periode = bepaalPeriode("aangepast", NU, {
      start: datum(2026, 2, 1),
      eind: datum(2026, 4, 1),
    });
    expect(periode.soort).toBe("vrij");
    expect(periode.start).toBe(datum(2026, 2, 1));
    expect(periode.zelfdePeriodeVorigJaar?.start).toBe(datum(2025, 2, 1));
    expect(periode.zelfdePeriodeVorigJaar?.eind).toBe(datum(2025, 4, 1));
    // Vorige periode van gelijke lengte, direct ervoor.
    expect(periode.vorigePeriode?.eind).toBe(periode.start);
  });

  it("valt bij aangepast zonder datums terug op alles in plaats van iets te verzinnen", () => {
    const periode = bepaalPeriode("aangepast", NU);
    expect(periode.soort).toBe("alles");
    expect(periode.label).toBe("Alle tijd");
  });

  it("alles heeft geen vergelijkingsperiodes", () => {
    const periode = bepaalPeriode("alles", NU);
    expect(periode.vorigePeriode).toBeNull();
    expect(periode.zelfdePeriodeVorigJaar).toBeNull();
  });

  it("de seizoenspresets zijn los kiesbaar en leveren elk hun eigen venster", () => {
    const labels = (["voorjaar", "zomer", "najaar", "winter"] as const).map(
      (preset) => bepaalPeriode(preset, NU).label
    );
    expect(labels).toEqual([
      "Voorjaar 2026",
      "Zomer 2026",
      "Najaar 2025",
      "Winter 2025/2026",
    ]);
    expect(new Set(labels).size).toBe(4);
  });

  it("houdt rekening met de schrikkeldag bij een jaar terugschuiven", () => {
    const periode = bepaalPeriode("deze-maand", datum(2028, 1, 15)); // feb 2028
    expect(periode.eind - periode.start).toBe(29 * 24 * 60 * 60 * 1000);
    expect(periode.zelfdePeriodeVorigJaar?.label).toBe("Februari 2027");
    expect(
      periode.zelfdePeriodeVorigJaar!.eind - periode.zelfdePeriodeVorigJaar!.start
    ).toBe(28 * 24 * 60 * 60 * 1000);
  });
});
