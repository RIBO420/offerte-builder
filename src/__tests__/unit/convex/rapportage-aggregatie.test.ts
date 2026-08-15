// @vitest-environment node
/**
 * De vier vraagsecties van /rapportages, op het niveau van de pure
 * aggregatiehelpers (convex/lib/rapportageAggregatie.ts).
 *
 * Belangrijkste doel: de voor/nacalculatie-aggregatie vastleggen. Die zat tot
 * 15 aug 2026 in een query die niemand aanriep, terwijl het Calculatie-tab een
 * verzonnen `accuracyScore={78}` toonde. Wat hier staat is wat de nieuwe
 * pagina gaat tonen — dus mag het niet stilletjes verschuiven.
 */

import { describe, it, expect } from "vitest";
import {
  berekenOpenstaandOverzicht,
  berekenPipelineSectie,
  berekenScopeMarges,
  berekenTopKlanten,
  berekenVoorNaCalculatie,
  bucketVanOuderdom,
  telOfferteStatussen,
  type VoorNaPaar,
} from "../../../../convex/lib/rapportageAggregatie";

const DAG = 24 * 60 * 60 * 1000;
const NU = new Date(2026, 7, 15, 12, 0, 0).getTime();

// ─── Voor- vs. nacalculatie ──────────────────────────────────────────────────

function paar(overrides: Partial<VoorNaPaar> = {}): VoorNaPaar {
  return {
    projectId: "projecten:1",
    projectNaam: "Tuin Van Dijk",
    klantNaam: "Van Dijk",
    peildatum: NU - 10 * DAG,
    geplandeUren: 100,
    werkelijkeUren: 100,
    normUrenPerScope: { bestrating: 60, grondwerk: 40 },
    afwijkingenPerScope: {},
    ...overrides,
  };
}

describe("berekenVoorNaCalculatie", () => {
  it("vertaalt uren-afwijking naar euro's tegen het uurtarief", () => {
    const resultaat = berekenVoorNaCalculatie(
      [paar({ geplandeUren: 100, werkelijkeUren: 120 })],
      50
    );
    expect(resultaat.afwijkingUren).toBe(20);
    expect(resultaat.afwijkingPercentage).toBe(20);
    expect(resultaat.afwijkingEuro).toBe(1000);
    expect(resultaat.uurtarief).toBe(50);
  });

  it("rekent projecten binnen 10% als accuraat en daarbuiten niet", () => {
    const resultaat = berekenVoorNaCalculatie(
      [
        paar({ projectId: "p1", geplandeUren: 100, werkelijkeUren: 109 }),
        paar({ projectId: "p2", geplandeUren: 100, werkelijkeUren: 90 }),
        paar({ projectId: "p3", geplandeUren: 100, werkelijkeUren: 130 }),
        paar({ projectId: "p4", geplandeUren: 100, werkelijkeUren: 70 }),
      ],
      45
    );
    expect(resultaat.aantalProjecten).toBe(4);
    expect(resultaat.accurateProjecten).toBe(2);
    expect(resultaat.accuratessePercentage).toBe(50);
  });

  it("telt de scope-afwijkingen op over projecten heen", () => {
    const resultaat = berekenVoorNaCalculatie(
      [
        paar({
          projectId: "p1",
          normUrenPerScope: { bestrating: 60, grondwerk: 40 },
          afwijkingenPerScope: { bestrating: 12, grondwerk: -4 },
          geplandeUren: 100,
          werkelijkeUren: 108,
        }),
        paar({
          projectId: "p2",
          normUrenPerScope: { bestrating: 40 },
          afwijkingenPerScope: { bestrating: 8 },
          geplandeUren: 40,
          werkelijkeUren: 48,
        }),
      ],
      50
    );

    const bestrating = resultaat.scopes.find((s) => s.scope === "bestrating");
    expect(bestrating).toMatchObject({
      geplandeUren: 100,
      werkelijkeUren: 120,
      afwijkingUren: 20,
      afwijkingPercentage: 20,
      afwijkingEuro: 1000,
      aantalProjecten: 2,
    });

    const grondwerk = resultaat.scopes.find((s) => s.scope === "grondwerk");
    expect(grondwerk?.afwijkingUren).toBe(-4);
    expect(grondwerk?.afwijkingEuro).toBe(-200);

    // Zwaarste geldlek staat bovenaan.
    expect(resultaat.scopes[0].scope).toBe("bestrating");
  });

  it("geeft nullen zonder deling door nul bij een project zonder begrote uren", () => {
    const resultaat = berekenVoorNaCalculatie(
      [paar({ geplandeUren: 0, werkelijkeUren: 12 })],
      50
    );
    expect(resultaat.afwijkingPercentage).toBe(0);
    expect(resultaat.projecten[0].afwijkingPercentage).toBe(0);
    expect(resultaat.afwijkingEuro).toBe(600);
  });

  it("meldt hoeveel afgeronde projecten nog geen nacalculatie hebben", () => {
    const resultaat = berekenVoorNaCalculatie([paar()], 50, 3);
    expect(resultaat.projectenZonderNacalculatie).toBe(3);
  });

  it("is leeg en veilig zonder enig paar", () => {
    const resultaat = berekenVoorNaCalculatie([], 50);
    expect(resultaat.aantalProjecten).toBe(0);
    expect(resultaat.accuratessePercentage).toBe(0);
    expect(resultaat.scopes).toEqual([]);
    expect(resultaat.afwijkingEuro).toBe(0);
  });
});

// ─── Openstaande facturen ────────────────────────────────────────────────────

function openstaandeFactuur(overrides: Record<string, unknown> = {}) {
  return {
    _id: "facturen:1",
    factuurnummer: "F-001",
    klant: { naam: "Van Dijk", adres: "A 1", postcode: "1000 AA", plaats: "P" },
    totaalInclBtw: 1210,
    openstaand: 1210,
    factuurdatum: NU - 40 * DAG,
    vervaldatum: NU - 10 * DAG,
    ...overrides,
  };
}

describe("berekenOpenstaandOverzicht", () => {
  it("deelt openstaand geld in ouderdomsbakken in", () => {
    expect(bucketVanOuderdom(-5)).toBe("nog_niet_vervallen");
    expect(bucketVanOuderdom(0)).toBe("nog_niet_vervallen");
    expect(bucketVanOuderdom(1)).toBe("1_30_dagen");
    expect(bucketVanOuderdom(30)).toBe("1_30_dagen");
    expect(bucketVanOuderdom(31)).toBe("31_60_dagen");
    expect(bucketVanOuderdom(61)).toBe("ouder_dan_60_dagen");
  });

  it("telt bedragen per bak en zet de oudste bovenaan", () => {
    const overzicht = berekenOpenstaandOverzicht(
      [
        openstaandeFactuur({ _id: "f1", vervaldatum: NU + 5 * DAG }),
        openstaandeFactuur({ _id: "f2", vervaldatum: NU - 10 * DAG }),
        openstaandeFactuur({ _id: "f3", vervaldatum: NU - 90 * DAG }),
      ],
      NU
    );

    expect(overzicht.totaalOpenstaand).toBe(3630);
    expect(overzicht.perBucket.nog_niet_vervallen).toEqual({ bedrag: 1210, aantal: 1 });
    expect(overzicht.perBucket["1_30_dagen"]).toEqual({ bedrag: 1210, aantal: 1 });
    expect(overzicht.perBucket.ouder_dan_60_dagen).toEqual({ bedrag: 1210, aantal: 1 });
    expect(overzicht.regels[0].factuurId).toBe("f3");
    expect(overzicht.regels[0].dagenTeLaat).toBe(90);
  });

  it("negeert facturen die al helemaal betaald zijn", () => {
    const overzicht = berekenOpenstaandOverzicht(
      [openstaandeFactuur({ openstaand: 0 })],
      NU
    );
    expect(overzicht.totaalOpenstaand).toBe(0);
    expect(overzicht.regels).toEqual([]);
    expect(overzicht.gemiddeldeOuderdomDagen).toBe(0);
  });
});

// ─── Pipeline ────────────────────────────────────────────────────────────────

function offerte(overrides: Record<string, unknown> = {}) {
  return {
    _id: "offertes:1",
    offerteNummer: "TT-001",
    type: "aanleg",
    status: "verzonden",
    klant: { naam: "Van Dijk", adres: "A 1", postcode: "1000 AA", plaats: "P" },
    createdAt: NU - 30 * DAG,
    updatedAt: NU - 30 * DAG,
    verzondenAt: NU - 30 * DAG,
    totalen: { totaalExBtw: 10000, totaalInclBtw: 12100, marge: 2000 },
    ...overrides,
  };
}

describe("telOfferteStatussen", () => {
  it("laat concepten buiten het pipelinetotaal", () => {
    const telling = telOfferteStatussen([
      { status: "concept" },
      { status: "concept" },
      { status: "verzonden" },
      { status: "geaccepteerd" },
    ]);
    expect(telling.concept).toBe(2);
    expect(telling.pipelineTotaal).toBe(2);
  });

  it("telt de deprecated status definitief bij voorcalculatie", () => {
    const telling = telOfferteStatussen([
      { status: "definitief" },
      { status: "voorcalculatie" },
    ]);
    expect(telling.voorcalculatie).toBe(2);
    expect(telling.pipelineTotaal).toBe(2);
  });
});

describe("berekenPipelineSectie", () => {
  it("meet ouderdom vanaf het verzendmoment en sorteert de stilste bovenaan", () => {
    const sectie = berekenPipelineSectie(
      [
        offerte({ _id: "o1", verzondenAt: NU - 3 * DAG }),
        offerte({ _id: "o2", verzondenAt: NU - 45 * DAG }),
        offerte({ _id: "o3", status: "voorcalculatie", verzondenAt: undefined, createdAt: NU - 20 * DAG }),
      ],
      null,
      NU
    );

    expect(sectie.blijftLiggen[0].offerteId).toBe("o2");
    expect(sectie.blijftLiggen[0].dagenStil).toBe(45);
    // o3 heeft nooit een verzonddatum: dan telt de aanmaakdatum.
    expect(sectie.blijftLiggen.find((r) => r.offerteId === "o3")?.dagenStil).toBe(20);
    expect(sectie.aantalBlijftLiggen).toBe(2); // drempel 14 dagen
    expect(sectie.drempelDagen).toBe(14);
  });

  it("rekent open offertes los van de gekozen periode", () => {
    // Offerte van vorig jaar, nog steeds open: hoort in de pipeline te blijven
    // staan ook als de periodekiezer op deze maand staat.
    const venster = { start: new Date(2026, 7, 1).getTime(), eind: new Date(2026, 8, 1).getTime() };
    const sectie = berekenPipelineSectie(
      [offerte({ createdAt: new Date(2025, 3, 1).getTime(), verzondenAt: new Date(2025, 3, 5).getTime() })],
      venster,
      NU
    );
    expect(sectie.openStatussen.verzonden).toBe(1);
    expect(sectie.openWaardeInclBtw).toBe(12100);
    // Conversie kijkt wél naar de periode: geen instroom in augustus.
    expect(sectie.aangemaaktInPeriode).toBe(0);
  });

  it("laat gearchiveerde offertes buiten de pipeline", () => {
    const sectie = berekenPipelineSectie(
      [offerte({ _id: "o1" }), offerte({ _id: "o2", isArchived: true })],
      null,
      NU
    );
    expect(sectie.openStatussen.verzonden).toBe(1);
  });
});

// ─── Marge per scope ─────────────────────────────────────────────────────────

describe("berekenScopeMarges", () => {
  it("verdeelt de omzet naar de werkelijke regelbedragen per scope", () => {
    const marges = berekenScopeMarges(
      [
        offerte({
          status: "geaccepteerd",
          scopes: ["bestrating", "borders"],
          regels: [
            { scope: "bestrating", totaal: 7500 },
            { scope: "borders", totaal: 2500 },
          ],
          totalen: { totaalExBtw: 10000, totaalInclBtw: 12100, marge: 2000 },
        }),
      ],
      null
    );

    const bestrating = marges.find((m) => m.scope === "bestrating");
    const borders = marges.find((m) => m.scope === "borders");
    expect(bestrating?.omzetExclBtw).toBe(7500);
    expect(borders?.omzetExclBtw).toBe(2500);
    expect(bestrating?.marge).toBe(1500);
    expect(bestrating?.margePercentage).toBe(20);
    expect(bestrating?.aandeelPercentage).toBe(75);
  });

  it("valt terug op een gelijke verdeling als er geen bruikbare regels zijn", () => {
    const marges = berekenScopeMarges(
      [
        offerte({
          status: "geaccepteerd",
          scopes: ["bestrating", "borders"],
          regels: [],
        }),
      ],
      null
    );
    expect(marges.map((m) => m.omzetExclBtw)).toEqual([5000, 5000]);
  });

  it("telt alleen getekende offertes", () => {
    const marges = berekenScopeMarges(
      [offerte({ status: "verzonden", scopes: ["bestrating"] })],
      null
    );
    expect(marges).toEqual([]);
  });
});

// ─── Topklanten ──────────────────────────────────────────────────────────────

describe("berekenTopKlanten", () => {
  it("groepeert op klantId en markeert terugkerende klanten", () => {
    const resultaat = berekenTopKlanten(
      [
        offerte({ _id: "o1", status: "geaccepteerd", klantId: "klanten:1" }),
        offerte({ _id: "o2", status: "geaccepteerd", klantId: "klanten:1" }),
        offerte({
          _id: "o3",
          status: "geaccepteerd",
          klantId: "klanten:2",
          klant: { naam: "Jansen", adres: "B 2", postcode: "2000 BB", plaats: "P" },
          totalen: { totaalExBtw: 30000, totaalInclBtw: 36300, marge: 9000 },
        }),
      ],
      null
    );

    expect(resultaat.aantalKlanten).toBe(2);
    expect(resultaat.aantalTerugkerend).toBe(1);
    expect(resultaat.klanten[0].klantNaam).toBe("Jansen");
    expect(resultaat.klanten[0].getekendeOmzetExclBtw).toBe(30000);
    expect(resultaat.klanten[0].margePercentage).toBe(30);
    expect(resultaat.klanten[1].aantalGetekend).toBe(2);
    expect(resultaat.klanten[1].isTerugkerend).toBe(true);
  });

  it("groepeert op naam als er geen klantId is", () => {
    const resultaat = berekenTopKlanten(
      [
        offerte({ _id: "o1", status: "geaccepteerd", klantId: undefined }),
        offerte({ _id: "o2", status: "geaccepteerd", klantId: undefined }),
      ],
      null
    );
    expect(resultaat.aantalKlanten).toBe(1);
    expect(resultaat.klanten[0].klantId).toBeNull();
  });
});
